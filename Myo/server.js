/**
 * Myo Armband WebApp & OSC Bridge Server
 * Provides:
 * 1. HTTP server serving the Web UI dashboard on http://localhost:3000
 * 2. WebSocket server streaming real-time EMG, IMU, Poses, Status to the UI
 * 3. OSC UDP sender (default 127.0.0.1:22345) for Ableton, Resolume, TouchDesigner, Max/MSP
 * 4. OSC UDP receiver (default port 22346) for incoming OSC control
 * 5. Native connection to Myo Connect (ws://127.0.0.1:10138/myo/3)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const dgram = require('dgram');
const osc = require('osc-min');
const WebSocket = require('ws');

// ----------------------------------------------------
// Configuration & Defaults
// ----------------------------------------------------
const HTTP_PORT = parseInt(process.env.PORT || 3000, 10);
let oscTargetHost = '127.0.0.1';
let oscTargetPort = parseInt(process.argv[2] || 22345, 10);
let oscListenPort = 22346;

const oscConfig = {
  enabled: true,
  targetHost: oscTargetHost,
  targetPort: oscTargetPort,
  listenPort: oscListenPort,
  sendEmg: true,
  sendOrientation: true,
  sendQuat: true,
  sendPoses: true,
  sendHits: true,
  sendImu: true,
  sendBattery: true,
  addressPrefix: '/myo/0'
};

// Global state cache
const deviceState = {
  myoConnectReady: false,
  connected: false,
  paired: false,
  macAddress: '',
  name: 'Myo Armband',
  connectIndex: 0,
  arm: 'unknown',
  direction: 'unknown',
  synced: false,
  locked: false,
  batteryLevel: 0,
  rssi: 0,
  lastPose: 'rest',
  emgStreaming: true,
  oscConfig: oscConfig
};

// ----------------------------------------------------
// OSC UDP Sockets
// ----------------------------------------------------
const udpSender = dgram.createSocket('udp4');
let udpReceiver = null;

function sendOsc(address, args) {
  if (!oscConfig.enabled) return;
  try {
    const formattedArgs = Array.isArray(args) ? args : [args];
    const buf = osc.toBuffer({
      address: address,
      args: formattedArgs
    });
    udpSender.send(buf, 0, buf.length, oscConfig.targetPort, oscConfig.targetHost, (err) => {
      if (err) {
        console.error('[OSC Send Error]:', err.message);
      }
    });

    // Notify UI of sent OSC (throttled/sampled for non-EMG or summary)
    broadcastToClients({
      type: 'osc_packet_out',
      address,
      args: formattedArgs,
      timestamp: Date.now()
    }, false); // low priority
  } catch (e) {
    // ignore buffer encoding errors
  }
}

function initOscReceiver(port) {
  if (udpReceiver) {
    try { udpReceiver.close(); } catch(e) {}
  }
  udpReceiver = dgram.createSocket('udp4');
  udpReceiver.on('error', (err) => {
    console.warn(`[OSC Receiver Error on port ${port}]:`, err.message);
  });
  udpReceiver.on('message', (msg, rinfo) => {
    try {
      const oscMsg = osc.fromBuffer(msg);
      broadcastToClients({
        type: 'osc_packet_in',
        address: oscMsg.address,
        args: oscMsg.args ? oscMsg.args.map(a => a.value !== undefined ? a.value : a) : [],
        sender: `${rinfo.address}:${rinfo.port}`,
        timestamp: Date.now()
      }, true);

      // Handle direct OSC control commands if received
      handleIncomingOscCommand(oscMsg);
    } catch (e) {
      console.warn('[OSC Decode Error]:', e.message);
    }
  });

  udpReceiver.bind(port, () => {
    console.log(`[OSC Receiver] Listening for incoming OSC on UDP port ${port}`);
  });
}

function handleIncomingOscCommand(oscMsg) {
  const addr = oscMsg.address.toLowerCase();
  const val = oscMsg.args && oscMsg.args[0] ? (oscMsg.args[0].value !== undefined ? oscMsg.args[0].value : oscMsg.args[0]) : null;

  if (addr.includes('/vibrate')) {
    const intensity = (val === 'long' || val === 3) ? 'long' : (val === 'medium' || val === 2) ? 'medium' : 'short';
    triggerVibrate(intensity);
  } else if (addr.includes('/zero')) {
    zeroMyoOrientation();
  } else if (addr.includes('/unlock')) {
    unlockMyo(true);
  } else if (addr.includes('/lock')) {
    lockMyo();
  }
}

// Start OSC receiver
initOscReceiver(oscListenPort);

// ----------------------------------------------------
// Static HTTP Web Server
// ----------------------------------------------------
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const publicDir = path.join(__dirname, 'public');
  const filePath = path.join(publicDir, reqPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// ----------------------------------------------------
// WebSocket Server for Web UI
// ----------------------------------------------------
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  // Send initial snapshot
  ws.send(JSON.stringify({
    type: 'init_state',
    data: deviceState
  }));

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      handleClientMessage(msg, ws);
    } catch (e) {
      console.error('Failed to parse client message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

let lastOscBroadcastTime = 0;
function broadcastToClients(obj, highPriority = true) {
  if (clients.size === 0) return;

  // Throttle high-speed packet logging to UI to prevent UI thread flooding
  if (!highPriority && (obj.type === 'osc_packet_out' || obj.type === 'osc_packet_in')) {
    const now = Date.now();
    if (now - lastOscBroadcastTime < 80) return; // limit to ~12 packets/sec for UI console
    lastOscBroadcastTime = now;
  }

  const payload = JSON.stringify(obj);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// ----------------------------------------------------
// Client WebApp Commands Handler
// ----------------------------------------------------
function handleClientMessage(msg, ws) {
  switch (msg.type) {
    case 'vibrate':
      triggerVibrate(msg.value || 'medium');
      break;

    case 'zero_orientation':
      zeroMyoOrientation();
      break;

    case 'unlock':
      unlockMyo(msg.hold !== false);
      break;

    case 'lock':
      lockMyo();
      break;

    case 'stream_emg':
      toggleEmgStream(Boolean(msg.enabled));
      break;

    case 'update_osc_config':
      if (msg.config) {
        Object.assign(oscConfig, msg.config);
        deviceState.oscConfig = oscConfig;

        if (msg.config.listenPort && msg.config.listenPort !== oscListenPort) {
          oscListenPort = msg.config.listenPort;
          initOscReceiver(oscListenPort);
        }

        broadcastToClients({
          type: 'osc_config_updated',
          data: oscConfig
        });
        console.log(`[OSC Config] Target updated to ${oscConfig.targetHost}:${oscConfig.targetPort}, OSC Enabled: ${oscConfig.enabled}`);
      }
      break;

    case 'send_test_osc':
      sendOsc(msg.address || '/myo/test', msg.args || [1]);
      break;

    case 'request_status':
      if (activeMyo) {
        activeMyo.requestBatteryLevel();
        activeMyo.requestBluetoothStrength();
      }
      break;

    default:
      console.log('Unknown message from client:', msg);
  }
}

// ----------------------------------------------------
// Myo Connect Integration (Node backend)
// ----------------------------------------------------
var Myo = require('myo');
let activeMyo = null;

function triggerVibrate(intensity) {
  if (activeMyo) {
    activeMyo.vibrate(intensity);
    console.log(`[Haptics] Vibrate: ${intensity}`);
  }
}

function zeroMyoOrientation() {
  if (activeMyo) {
    activeMyo.zeroOrientation();
    console.log('[IMU] Orientation Zeroed (Tare)');
    broadcastToClients({ type: 'notification', message: 'Orientation Zeroed (Tare)' });
  }
}

function unlockMyo(hold) {
  if (activeMyo) {
    activeMyo.unlock(hold ? 'hold' : 'timed');
    deviceState.locked = false;
    broadcastToClients({ type: 'lock_state', locked: false });
  }
}

function lockMyo() {
  if (activeMyo) {
    activeMyo.lock();
    deviceState.locked = true;
    broadcastToClients({ type: 'lock_state', locked: true });
  }
}

function toggleEmgStream(enabled) {
  if (activeMyo) {
    activeMyo.streamEMG(enabled);
    deviceState.emgStreaming = enabled;
    broadcastToClients({ type: 'emg_streaming_state', enabled });
    console.log(`[EMG] Stream: ${enabled ? 'Enabled' : 'Disabled'}`);
  }
}

function setupMyoListeners() {
  Myo.connect('com.helix.myo');

  Myo.on('ready', () => {
    console.log('[Myo Connect] WebSocket connected to Myo Connect (ws://127.0.0.1:10138)');
    deviceState.myoConnectReady = true;
    broadcastToClients({ type: 'myo_connect_status', ready: true });
  });

  Myo.on('socket_closed', () => {
    console.warn('[Myo Connect] Socket closed. Will retry connecting...');
    deviceState.myoConnectReady = false;
    deviceState.connected = false;
    broadcastToClients({ type: 'myo_connect_status', ready: false });
    // Reconnect attempt
    setTimeout(() => {
      try { Myo.connect('com.helix.myo'); } catch(e) {}
    }, 3000);
  });

  Myo.on('connected', function() {
    activeMyo = this;
    deviceState.connected = true;
    deviceState.connectIndex = this.connectIndex;
    deviceState.macAddress = this.macAddress || '';
    deviceState.name = this.name || 'Myo Armband';
    console.log(`[Myo Armband] Connected! Index: ${this.connectIndex}, MAC: ${this.macAddress}`);

    Myo.setLockingPolicy('none');
    this.unlock('hold');
    this.streamEMG(true);
    deviceState.emgStreaming = true;

    this.requestBatteryLevel();
    this.requestBluetoothStrength();

    broadcastToClients({
      type: 'device_connected',
      data: {
        connectIndex: this.connectIndex,
        macAddress: this.macAddress,
        name: this.name
      }
    });
  });

  Myo.on('disconnected', function() {
    console.log('[Myo Armband] Disconnected');
    deviceState.connected = false;
    deviceState.synced = false;
    broadcastToClients({ type: 'device_disconnected' });
  });

  Myo.on('arm_synced', function(data) {
    deviceState.synced = true;
    deviceState.arm = this.arm || data.arm;
    deviceState.direction = this.direction || data.x_direction;
    console.log(`[Myo Armband] Arm Synced: ${deviceState.arm}, Direction: ${deviceState.direction}`);

    // Ensure EMG stream remains active on sync
    this.streamEMG(true);

    broadcastToClients({
      type: 'arm_synced',
      arm: deviceState.arm,
      direction: deviceState.direction,
      warmupState: data.warmup_state
    });
  });

  Myo.on('arm_unsynced', function() {
    deviceState.synced = false;
    console.log('[Myo Armband] Arm Unsynced');
    broadcastToClients({ type: 'arm_unsynced' });
  });

  Myo.on('locked', function() {
    deviceState.locked = true;
    broadcastToClients({ type: 'lock_state', locked: true });
  });

  Myo.on('unlocked', function() {
    deviceState.locked = false;
    broadcastToClients({ type: 'lock_state', locked: false });
  });

  // Battery & RSSI
  Myo.on('battery_level', function(val) {
    deviceState.batteryLevel = val;
    broadcastToClients({ type: 'battery_level', value: val });
    if (oscConfig.sendBattery) {
      sendOsc(`${oscConfig.addressPrefix}/battery_level`, val);
    }
  });

  Myo.on('bluetooth_strength', function(val) {
    deviceState.rssi = val;
    broadcastToClients({ type: 'bluetooth_strength', value: val });
    if (oscConfig.sendBattery) {
      sendOsc(`${oscConfig.addressPrefix}/bluetooth_strength`, val);
    }
  });

  // EMG Stream (8 channels)
  Myo.on('emg', function(data) {
    broadcastToClients({ type: 'emg', data: data }, true);
    if (oscConfig.sendEmg) {
      sendOsc(`${oscConfig.addressPrefix}/emg`, data);
    }
  });

  // Orientation (Quaternions + Euler Roll/Pitch/Yaw)
  Myo.on('orientation', function(quat) {
    // Quat is {x, y, z, w}
    const qx = quat.x, qy = quat.y, qz = quat.z, qw = quat.w;
    const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (qw * qy - qz * qx))));
    const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));

    const oriData = {
      quaternion: { x: qx, y: qy, z: qz, w: qw },
      roll: roll,
      pitch: pitch,
      yaw: yaw
    };

    broadcastToClients({ type: 'orientation', data: oriData }, false);

    if (oscConfig.sendOrientation) {
      sendOsc(`${oscConfig.addressPrefix}/roll`, roll);
      sendOsc(`${oscConfig.addressPrefix}/pitch`, pitch);
      sendOsc(`${oscConfig.addressPrefix}/yaw`, yaw);

      // Pitch-based directional zones (as in original app.js)
      const atForward = (pitch < 0.4 && pitch > -0.6) ? 1 : 0;
      const atGround = (pitch <= -0.6) ? 1 : 0;
      const atSky = (pitch >= 0.4) ? 1 : 0;

      sendOsc(`${oscConfig.addressPrefix}/atForward`, atForward);
      sendOsc(`${oscConfig.addressPrefix}/atGround`, atGround);
      sendOsc(`${oscConfig.addressPrefix}/atSky`, atSky);
    }

    if (oscConfig.sendQuat) {
      sendOsc(`${oscConfig.addressPrefix}/quaternion`, [qx, qy, qz, qw]);
    }
  });

  // Accelerometer
  Myo.on('accelerometer', function(data) {
    broadcastToClients({ type: 'accelerometer', data: data }, false);
    if (oscConfig.sendImu) {
      sendOsc(`${oscConfig.addressPrefix}/accel`, [data.x, data.y, data.z]);
    }
  });

  // Gyroscope & Hit detection
  Myo.on('gyroscope', function(data) {
    const isHit = (Math.abs(data.x) > 200 || Math.abs(data.y) > 200 || Math.abs(data.z) > 200) ? 1 : 0;

    broadcastToClients({
      type: 'gyroscope',
      data: data,
      isHit: isHit
    }, false);

    if (oscConfig.sendImu) {
      sendOsc(`${oscConfig.addressPrefix}/gyro`, [data.x, data.y, data.z]);
    }

    if (oscConfig.sendHits && isHit) {
      sendOsc(`${oscConfig.addressPrefix}/hit`, 1);
    }
  });

  // Gestures / Poses
  const poses = ['fist', 'wave_in', 'wave_out', 'fingers_spread', 'double_tap'];
  poses.forEach((poseName) => {
    Myo.on(poseName, function() {
      deviceState.lastPose = poseName;
      broadcastToClients({ type: 'pose', pose: poseName, state: 1 });
      if (oscConfig.sendPoses) {
        sendOsc(`${oscConfig.addressPrefix}/${poseName}`, 1);
        sendOsc(`${oscConfig.addressPrefix}/pose`, poseName);
      }
    });

    Myo.on(poseName + '_off', function() {
      broadcastToClients({ type: 'pose', pose: poseName, state: 0 });
      if (oscConfig.sendPoses) {
        sendOsc(`${oscConfig.addressPrefix}/${poseName}`, 0);
      }
    });
  });

  Myo.on('rest', function() {
    deviceState.lastPose = 'rest';
    broadcastToClients({ type: 'pose', pose: 'rest', state: 1 });
    if (oscConfig.sendPoses) {
      sendOsc(`${oscConfig.addressPrefix}/pose`, 'rest');
    }
  });

  // Polling battery / rssi periodically every 15s
  setInterval(() => {
    if (activeMyo && deviceState.connected) {
      activeMyo.requestBatteryLevel();
      activeMyo.requestBluetoothStrength();
    }
  }, 15000);
}

// ----------------------------------------------------
// Start Server
// ----------------------------------------------------
server.listen(HTTP_PORT, () => {
  console.log('========================================================');
  console.log(`   MYO ARMBAND WEB DASHBOARD & OSC BRIDGE`);
  console.log(`   Web App UI:     http://localhost:${HTTP_PORT}`);
  console.log(`   OSC Out (UDP):  ${oscConfig.targetHost}:${oscConfig.targetPort}`);
  console.log(`   OSC In (UDP):   Port ${oscListenPort}`);
  console.log(`   Myo Connect:    Connecting to ws://127.0.0.1:10138 ...`);
  console.log('========================================================');

  setupMyoListeners();
});
