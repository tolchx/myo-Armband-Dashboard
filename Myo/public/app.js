/**
 * MYO Armband Performance Suite
 * Includes:
 * 1. Telemetry Dashboard & OSC Monitor (3D Armband, 8-CH EMG, Gestures)
 * 2. Harmonic Sound Synthesizer & Melodic Arpeggiator (Web Audio API)
 * 3. Interactive GLSL Shaders & 3D Particle Visuals (Three.js WebGL)
 */

// ----------------------------------------------------
// Global State & Core Properties
// ----------------------------------------------------
const state = {
  mode: 'server', // 'server' or 'direct'
  connected: false,
  deviceConnected: false,
  arm: 'unknown',
  direction: 'unknown',
  synced: false,
  locked: false,
  battery: 0,
  rssi: 0,
  emgStreaming: true,
  emgGain: 2.0,
  emgFrozen: false,
  packetCount: 0,
  orientation: { roll: 0, pitch: 0, yaw: 0, quat: { x: 0, y: 0, z: 0, w: 1 } },
  gyro: { x: 0, y: 0, z: 0, speed: 0 },
  accel: { x: 0, y: 0, z: 0 },
  emg: [0, 0, 0, 0, 0, 0, 0, 0],
  emgHistory: Array.from({ length: 8 }, () => new Array(120).fill(0)),
  emgAvg: 0,
  lastPose: 'rest',
  hitActive: false
};

// UI Element References
const badgeWs = document.getElementById('badge-ws');
const valWs = document.getElementById('val-ws');
const badgeDevice = document.getElementById('badge-device');
const valDevice = document.getElementById('val-device');
const valArm = document.getElementById('val-arm');
const valBattery = document.getElementById('val-battery');
const valRssi = document.getElementById('val-rssi');
const valLock = document.getElementById('val-lock');
const valLockIcon = document.getElementById('val-lock-icon');

// Metric numbers
const valRoll = document.getElementById('val-roll');
const valPitch = document.getElementById('val-pitch');
const valYaw = document.getElementById('val-yaw');
const accX = document.getElementById('acc-x');
const accY = document.getElementById('acc-y');
const accZ = document.getElementById('acc-z');
const gyroX = document.getElementById('gyro-x');
const gyroY = document.getElementById('gyro-y');
const gyroZ = document.getElementById('gyro-z');
const hitBox = document.getElementById('hit-box');

// OSC controls
const oscTerminalLog = document.getElementById('osc-terminal-log');
const oscPacketCounter = document.getElementById('osc-packet-counter');

// Mode toggle buttons
const modeServerBtn = document.getElementById('mode-server-btn');
const modeDirectBtn = document.getElementById('mode-direct-btn');

// ----------------------------------------------------
// Tab Navigation Switcher
// ----------------------------------------------------
const mainTabBtns = document.querySelectorAll('.main-tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

mainTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetTabId = btn.dataset.tab;
    mainTabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    const targetPane = document.getElementById(targetTabId);
    if (targetPane) targetPane.classList.add('active');

    // Trigger canvas resize when switching to 3D or Shader tabs
    if (targetTabId === 'tab-telemetry') {
      window.dispatchEvent(new Event('resize'));
    } else if (targetTabId === 'tab-shaders') {
      if (shadersStudio && shadersStudio.onResize) {
        setTimeout(() => shadersStudio.onResize(), 50);
      }
    }
  });
});

// Mode Switcher (Server + OSC vs Direct Browser)
modeServerBtn.addEventListener('click', () => switchMode('server'));
modeDirectBtn.addEventListener('click', () => switchMode('direct'));

function switchMode(newMode) {
  if (state.mode === newMode) return;
  state.mode = newMode;
  modeServerBtn.classList.toggle('active', newMode === 'server');
  modeDirectBtn.classList.toggle('active', newMode === 'direct');

  appendLog(`[Sistema] Cambiando a modo: ${newMode === 'server' ? 'Server + OSC Bridge' : 'Directo Web (Myo Connect)'}`, 'system');

  if (socket) {
    socket.close();
  }
  initWebSocket();
}

// ----------------------------------------------------
// WebSocket Connection Manager
// ----------------------------------------------------
let socket = null;
let reconnectTimer = null;

function initWebSocket() {
  if (reconnectTimer) clearTimeout(reconnectTimer);

  let wsUrl = '';
  if (state.mode === 'server') {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${loc.host}`;
  } else {
    // Direct connection to Myo Connect desktop app
    wsUrl = 'ws://127.0.0.1:10138/myo/3?appid=com.helix.myo';
  }

  updateWsStatus(false, 'Conectando...');

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      updateWsStatus(true, state.mode === 'server' ? 'Conectado (Server)' : 'Conectado (Directo)');
      appendLog(`[WS] Conectado exitosamente a ${wsUrl}`, 'system');

      if (state.mode === 'direct') {
        setTimeout(() => {
          sendDirectCommand('unlock', { type: 'hold' });
          sendDirectCommand('set_stream_emg', { type: 'enabled' });
          sendDirectCommand('request_battery_level');
          sendDirectCommand('request_rssi');
        }, 500);
      }
    };

    socket.onmessage = (event) => {
      try {
        if (state.mode === 'server') {
          const msg = JSON.parse(event.data);
          handleServerMessage(msg);
        } else {
          const msg = JSON.parse(event.data);
          handleDirectMyoMessage(msg);
        }
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    socket.onclose = () => {
      updateWsStatus(false, 'Desconectado');
      updateDeviceStatus(false);
      reconnectTimer = setTimeout(initWebSocket, 2500);
    };

    socket.onerror = () => {
      updateWsStatus(false, 'Error');
    };
  } catch (e) {
    updateWsStatus(false, 'Error');
    reconnectTimer = setTimeout(initWebSocket, 3000);
  }
}

function sendToServer(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

function sendDirectCommand(cmd, extra = {}) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const payload = ['command', Object.assign({ command: cmd, myo: 0 }, extra)];
    socket.send(JSON.stringify(payload));
  }
}

// ----------------------------------------------------
// Message Handlers
// ----------------------------------------------------
function handleServerMessage(msg) {
  switch (msg.type) {
    case 'init_state':
      applyDeviceState(msg.data);
      break;

    case 'myo_connect_status':
      if (!msg.ready) {
        updateDeviceStatus(false, 'Myo Connect inactivo');
      }
      break;

    case 'device_connected':
      updateDeviceStatus(true, msg.data.name || 'Myo Armband');
      break;

    case 'device_disconnected':
      updateDeviceStatus(false, 'Desconectada');
      break;

    case 'arm_synced':
      state.synced = true;
      state.arm = msg.arm;
      state.direction = msg.direction;
      valArm.textContent = `${msg.arm.toUpperCase()} · ${msg.direction.replace('_', ' ').toUpperCase()}`;
      valArm.style.color = '#00ff9d';
      break;

    case 'arm_unsynced':
      state.synced = false;
      valArm.textContent = 'Sin sincronizar';
      valArm.style.color = '';
      break;

    case 'battery_level':
      state.battery = msg.value;
      valBattery.textContent = `${msg.value}%`;
      break;

    case 'bluetooth_strength':
      state.rssi = msg.value;
      valRssi.textContent = `${msg.value} dBm`;
      break;

    case 'lock_state':
      state.locked = msg.locked;
      valLock.textContent = msg.locked ? 'Bloqueado' : 'Desbloqueado';
      valLockIcon.textContent = msg.locked ? '🔒' : '🔓';
      break;

    case 'emg':
      updateEmgData(msg.data);
      break;

    case 'orientation':
      updateOrientationData(msg.data);
      break;

    case 'accelerometer':
      state.accel = msg.data;
      accX.textContent = msg.data.x.toFixed(2);
      accY.textContent = msg.data.y.toFixed(2);
      accZ.textContent = msg.data.z.toFixed(2);
      break;

    case 'gyroscope':
      state.gyro = {
        x: msg.data.x,
        y: msg.data.y,
        z: msg.data.z,
        speed: Math.sqrt(msg.data.x * msg.data.x + msg.data.y * msg.data.y + msg.data.z * msg.data.z)
      };
      gyroX.textContent = msg.data.x.toFixed(1);
      gyroY.textContent = msg.data.y.toFixed(1);
      gyroZ.textContent = msg.data.z.toFixed(1);

      if (msg.isHit) {
        triggerHitUI();
      }
      onGyroUpdated();
      break;

    case 'pose':
      highlightPose(msg.pose, msg.state === 1);
      break;

    case 'osc_packet_out':
      recordOscPacket('OUT', msg.address, msg.args);
      break;

    case 'osc_packet_in':
      recordOscPacket('IN', msg.address, msg.args, msg.sender);
      break;

    case 'osc_config_updated':
      syncOscConfigForm(msg.data);
      break;
  }
}

function handleDirectMyoMessage(raw) {
  const type = raw[0];
  const data = raw[1];
  if (!data) return;

  if (type === 'event') {
    switch (data.type) {
      case 'paired':
      case 'connected':
        updateDeviceStatus(true, data.name || 'Myo Armband');
        sendDirectCommand('unlock', { type: 'hold' });
        sendDirectCommand('set_stream_emg', { type: 'enabled' });
        break;

      case 'disconnected':
        updateDeviceStatus(false, 'Desconectada');
        break;

      case 'arm_synced':
        state.synced = true;
        state.arm = data.arm;
        state.direction = data.x_direction;
        valArm.textContent = `${data.arm.toUpperCase()} · ${data.x_direction.replace('_', ' ').toUpperCase()}`;
        valArm.style.color = '#00ff9d';
        sendDirectCommand('set_stream_emg', { type: 'enabled' });
        break;

      case 'arm_unsynced':
        state.synced = false;
        valArm.textContent = 'Sin sincronizar';
        valArm.style.color = '';
        break;

      case 'battery_level':
        valBattery.textContent = `${data.battery_level}%`;
        break;

      case 'rssi':
        valRssi.textContent = `${data.rssi} dBm`;
        break;

      case 'locked':
        state.locked = true;
        valLock.textContent = 'Bloqueado';
        valLockIcon.textContent = '🔒';
        break;

      case 'unlocked':
        state.locked = false;
        valLock.textContent = 'Desbloqueado';
        valLockIcon.textContent = '🔓';
        break;

      case 'emg':
        updateEmgData(data.emg);
        break;

      case 'orientation':
        const qx = data.orientation.x, qy = data.orientation.y, qz = data.orientation.z, qw = data.orientation.w;
        const roll = Math.atan2(2 * (qw * qx + qy * qz), 1 - 2 * (qx * qx + qy * qy));
        const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (qw * qy - qz * qx))));
        const yaw = Math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz));

        updateOrientationData({
          quaternion: { x: qx, y: qy, z: qz, w: qw },
          roll, pitch, yaw
        });

        if (data.accelerometer) {
          state.accel = { x: data.accelerometer[0], y: data.accelerometer[1], z: data.accelerometer[2] };
          accX.textContent = data.accelerometer[0].toFixed(2);
          accY.textContent = data.accelerometer[1].toFixed(2);
          accZ.textContent = data.accelerometer[2].toFixed(2);
        }
        if (data.gyroscope) {
          state.gyro = {
            x: data.gyroscope[0],
            y: data.gyroscope[1],
            z: data.gyroscope[2],
            speed: Math.sqrt(data.gyroscope[0] ** 2 + data.gyroscope[1] ** 2 + data.gyroscope[2] ** 2)
          };
          gyroX.textContent = data.gyroscope[0].toFixed(1);
          gyroY.textContent = data.gyroscope[1].toFixed(1);
          gyroZ.textContent = data.gyroscope[2].toFixed(1);
          if (state.gyro.speed > 200) {
            triggerHitUI();
          }
          onGyroUpdated();
        }
        break;

      case 'pose':
        highlightPose(data.pose, true);
        break;
    }
  }
}

function applyDeviceState(dev) {
  if (dev.connected) updateDeviceStatus(true, dev.name);
  if (dev.synced) {
    valArm.textContent = `${dev.arm.toUpperCase()} · ${dev.direction.replace('_', ' ').toUpperCase()}`;
    valArm.style.color = '#00ff9d';
  }
  if (dev.batteryLevel) valBattery.textContent = `${dev.batteryLevel}%`;
  if (dev.rssi) valRssi.textContent = `${dev.rssi} dBm`;
  if (dev.locked !== undefined) {
    state.locked = dev.locked;
    valLock.textContent = dev.locked ? 'Bloqueado' : 'Desbloqueado';
    valLockIcon.textContent = dev.locked ? '🔒' : '🔓';
  }
  if (dev.oscConfig) syncOscConfigForm(dev.oscConfig);
}

// ----------------------------------------------------
// UI Update Functions
// ----------------------------------------------------
function updateWsStatus(connected, text) {
  state.connected = connected;
  const dot = badgeWs.querySelector('.dot');
  dot.className = `dot ${connected ? 'dot-connected' : 'dot-disconnected'}`;
  valWs.textContent = text;
}

function updateDeviceStatus(connected, name) {
  state.deviceConnected = connected;
  const dot = badgeDevice.querySelector('.dot');
  dot.className = `dot ${connected ? 'dot-connected' : 'dot-disconnected'}`;
  valDevice.textContent = connected ? (name || 'Vinculada') : 'No vinculada';
}

function updateOrientationData(data) {
  state.orientation = data;
  const toDeg = 180 / Math.PI;

  valRoll.textContent = `${(data.roll * toDeg).toFixed(1)}°`;
  valPitch.textContent = `${(data.pitch * toDeg).toFixed(1)}°`;
  valYaw.textContent = `${(data.yaw * toDeg).toFixed(1)}°`;

  if (targetArmMesh && data.quaternion) {
    targetQuat.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
  }

  // Update Audio Synth mapping
  if (audioStudio) {
    audioStudio.onOrientationChange(data.roll, data.pitch, data.yaw);
  }

  // Update Shaders
  if (shadersStudio) {
    shadersStudio.onOrientationChange(data);
  }
}

function onGyroUpdated() {
  if (audioStudio) audioStudio.onGyroChange(state.gyro);
  if (shadersStudio) shadersStudio.onGyroChange(state.gyro);
}

let hitTimeout = null;
function triggerHitUI() {
  state.hitActive = true;
  hitBox.classList.add('active');
  if (hitTimeout) clearTimeout(hitTimeout);
  hitTimeout = setTimeout(() => {
    hitBox.classList.remove('active');
    state.hitActive = false;
  }, 220);

  if (audioStudio) audioStudio.onHitTrigger();
  if (shadersStudio) shadersStudio.onHitTrigger();
}

function highlightPose(poseName, isActive) {
  document.querySelectorAll('.pose-card').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.trigger-badge').forEach(b => b.classList.remove('active'));

  if (isActive && poseName) {
    state.lastPose = poseName;
    const card = document.getElementById(`pose-${poseName}`);
    if (card) card.classList.add('active');

    const trigBadge = document.getElementById(`trig-${poseName}`);
    if (trigBadge) trigBadge.classList.add('active');

    // Notify Audio and Shaders
    if (audioStudio) audioStudio.onPoseChange(poseName);
    if (shadersStudio) shadersStudio.onPoseChange(poseName);
  }
}

// ----------------------------------------------------
// EMG Processing & Oscilloscopes
// ----------------------------------------------------
const emgCanvases = [];
const emgCtxs = [];
const emgBars = [];
const emgVals = [];

for (let i = 0; i < 8; i++) {
  const canvas = document.getElementById(`canvas-emg-${i}`);
  emgCanvases.push(canvas);
  emgCtxs.push(canvas.getContext('2d'));
  emgBars.push(document.getElementById(`bar-emg-${i}`));
  emgVals.push(document.getElementById(`val-emg-${i}`));
}

const radialCanvas = document.getElementById('canvas-radial-heatmap');
const radialCtx = radialCanvas.getContext('2d');

function updateEmgData(raw) {
  if (state.emgFrozen) return;

  state.emg = raw;
  let totalAbs = 0;

  for (let i = 0; i < 8; i++) {
    const val = raw[i] !== undefined ? raw[i] : 0;
    state.emgHistory[i].push(val);
    state.emgHistory[i].shift();

    const absVal = Math.abs(val);
    totalAbs += absVal;
    const pct = Math.min(100, (absVal / 128) * 100 * state.emgGain);
    emgBars[i].style.width = `${pct}%`;
    emgVals[i].textContent = val;

    if (podMeshes[i]) {
      const glowIntensity = Math.min(1, absVal / 40);
      podMeshes[i].material.emissiveIntensity = glowIntensity * 2.5;
    }
  }

  state.emgAvg = totalAbs / 8;

  // Audio and Shader reaction to muscle activation
  if (audioStudio) audioStudio.onEmgChange(state.emgAvg, state.emg);
  if (shadersStudio) shadersStudio.onEmgChange(state.emgAvg, state.emg);
}

function renderEmgWaveforms() {
  for (let ch = 0; ch < 8; ch++) {
    const canvas = emgCanvases[ch];
    const ctx = emgCtxs[ch];
    const data = state.emgHistory[ch];
    const w = canvas.width = canvas.clientWidth;
    const h = canvas.height = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(60, 90, 140, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    const step = w / (data.length - 1);
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      const y = (h / 2) - (v / 128) * (h / 2) * state.emgGain;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawRadialHeatmap();
  requestAnimationFrame(renderEmgWaveforms);
}
requestAnimationFrame(renderEmgWaveforms);

function drawRadialHeatmap() {
  const w = radialCanvas.width;
  const h = radialCanvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const outerR = 72;
  const innerR = 40;

  radialCtx.clearRect(0, 0, w, h);

  radialCtx.beginPath();
  radialCtx.arc(cx, cy, innerR - 4, 0, Math.PI * 2);
  radialCtx.fillStyle = '#0f172a';
  radialCtx.fill();
  radialCtx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
  radialCtx.lineWidth = 2;
  radialCtx.stroke();

  radialCtx.fillStyle = '#64748b';
  radialCtx.font = '10px Inter, sans-serif';
  radialCtx.textAlign = 'center';
  radialCtx.textBaseline = 'middle';
  radialCtx.fillText('BRAZO', cx, cy);

  const numSectors = 8;
  const anglePerSector = (Math.PI * 2) / numSectors;
  const pad = 0.08;

  for (let i = 0; i < numSectors; i++) {
    const startA = i * anglePerSector - Math.PI / 2 + pad;
    const endA = (i + 1) * anglePerSector - Math.PI / 2 - pad;

    const absVal = Math.abs(state.emg[i] || 0);
    const intensity = Math.min(1, (absVal / 50) * state.emgGain);

    radialCtx.beginPath();
    radialCtx.arc(cx, cy, outerR, startA, endA);
    radialCtx.arc(cx, cy, innerR, endA, startA, true);
    radialCtx.closePath();

    if (intensity > 0.05) {
      const r = Math.round(intensity * 255);
      const g = Math.round((1 - intensity) * 200 + 55);
      const b = Math.round(255 * (1 - intensity * 0.5));
      radialCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.35 + intensity * 0.65})`;
    } else {
      radialCtx.fillStyle = 'rgba(30, 41, 59, 0.4)';
    }
    radialCtx.fill();
    radialCtx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    radialCtx.lineWidth = 1;
    radialCtx.stroke();

    const midA = (startA + endA) / 2;
    const labelR = outerR + 10;
    const lx = cx + Math.cos(midA) * labelR;
    const ly = cy + Math.sin(midA) * labelR;
    radialCtx.fillStyle = intensity > 0.3 ? '#00f0ff' : '#64748b';
    radialCtx.font = 'bold 9px monospace';
    radialCtx.fillText(`CH${i + 1}`, lx, ly);
  }
}

// ----------------------------------------------------
// 3D Three.js Armband Viewport (Tab 1)
// ----------------------------------------------------
let scene, camera, renderer;
let armGroup, armbandGroup;
let podMeshes = [];
let targetQuat = new THREE.Quaternion();

function initThree() {
  const container = document.getElementById('canvas-3d-container');
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 280;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e17, 0.08);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.2, 4.2);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x00f0ff, 1.4);
  dirLight.position.set(4, 6, 5);
  scene.add(dirLight);

  const purpleLight = new THREE.DirectionalLight(0x9d4edd, 1.0);
  purpleLight.position.set(-4, -2, -3);
  scene.add(purpleLight);

  const grid = new THREE.GridHelper(10, 20, 0x00f0ff, 0x1f293d);
  grid.position.y = -1.2;
  scene.add(grid);

  armGroup = new THREE.Group();
  scene.add(armGroup);

  const armGeo = new THREE.CylinderGeometry(0.55, 0.68, 3.8, 32);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x131d2e,
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0.7
  });
  const armMesh = new THREE.Mesh(armGeo, armMat);
  armMesh.rotation.z = Math.PI / 2;
  armGroup.add(armMesh);

  armbandGroup = new THREE.Group();
  armGroup.add(armbandGroup);

  const podGeo = new THREE.BoxGeometry(0.24, 0.28, 0.14);
  const numPods = 8;
  const radius = 0.72;

  for (let i = 0; i < numPods; i++) {
    const angle = (i / numPods) * Math.PI * 2;
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x0b111e,
      roughness: 0.3,
      metalness: 0.8,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.05
    });

    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set(0, Math.cos(angle) * radius, Math.sin(angle) * radius);
    pod.rotation.x = -angle;

    const ledGeo = new THREE.SphereGeometry(0.04, 8, 8);
    const ledMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const led = new THREE.Mesh(ledGeo, ledMat);
    led.position.set(0, 0, 0.08);
    pod.add(led);

    armbandGroup.add(pod);
    podMeshes.push(pod);
  }

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w > 0 && h > 0) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  });

  function animate() {
    requestAnimationFrame(animate);
    if (armGroup) {
      armGroup.quaternion.slerp(targetQuat, 0.25);
    }
    renderer.render(scene, camera);
  }
  animate();
}

try {
  initThree();
} catch (e) {
  console.warn('Three.js init error:', e);
}

document.getElementById('btn-reset-cam').addEventListener('click', () => {
  if (camera) {
    camera.position.set(0, 1.2, 4.2);
    camera.lookAt(0, 0, 0);
  }
});

// Telemetry Controls
document.getElementById('btn-zero-orientation').addEventListener('click', () => {
  if (state.mode === 'server') sendToServer({ type: 'zero_orientation' });
  else sendDirectCommand('zero_orientation');
  appendLog('[IMU] Calibrando centro (Tare)...', 'system');
});

document.querySelectorAll('.btn-haptic').forEach(btn => {
  btn.addEventListener('click', () => {
    const vibe = btn.dataset.vibe;
    if (state.mode === 'server') sendToServer({ type: 'vibrate', value: vibe });
    else sendDirectCommand('vibrate', { type: vibe });
    appendLog(`[Háptico] Enviando vibración: ${vibe}`, 'system');
  });
});

document.getElementById('btn-toggle-lock').addEventListener('click', () => {
  const newLock = !state.locked;
  if (state.mode === 'server') sendToServer({ type: newLock ? 'lock' : 'unlock', hold: true });
  else sendDirectCommand(newLock ? 'lock' : 'unlock', { type: 'hold' });
});

const btnToggleEmg = document.getElementById('btn-toggle-emg');
btnToggleEmg.addEventListener('click', () => {
  state.emgStreaming = !state.emgStreaming;
  btnToggleEmg.classList.toggle('active-state', state.emgStreaming);
  btnToggleEmg.textContent = state.emgStreaming ? '⚡ Stream EMG: ON' : '⚡ Stream EMG: OFF';
  if (state.mode === 'server') sendToServer({ type: 'stream_emg', enabled: state.emgStreaming });
  else sendDirectCommand('set_stream_emg', { type: state.emgStreaming ? 'enabled' : 'disabled' });
});

const btnFreezeEmg = document.getElementById('btn-freeze-emg');
btnFreezeEmg.addEventListener('click', () => {
  state.emgFrozen = !state.emgFrozen;
  btnFreezeEmg.textContent = state.emgFrozen ? '▶️ Reanudar Graficado' : '⏸️ Pausar Graficado';
  btnFreezeEmg.classList.toggle('btn-secondary', !state.emgFrozen);
  btnFreezeEmg.classList.toggle('btn-dark', state.emgFrozen);
});

const sliderGain = document.getElementById('slider-emg-gain');
const valGain = document.getElementById('val-emg-gain');
sliderGain.addEventListener('input', (e) => {
  state.emgGain = parseFloat(e.target.value);
  valGain.textContent = `${state.emgGain.toFixed(1)}x`;
});

// OSC Controls
document.getElementById('btn-test-osc').addEventListener('click', () => {
  if (state.mode === 'server') {
    sendToServer({ type: 'send_test_osc', address: '/myo/test', args: [1, 2, 3.14, 'hello'] });
    appendLog('[OSC] Paquete de prueba enviado: /myo/test [1, 2, 3.14, "hello"]', 'out');
  } else {
    appendLog('[OSC] El envío OSC requiere el modo "Server + OSC".', 'system');
  }
});

document.getElementById('btn-clear-log').addEventListener('click', () => {
  oscTerminalLog.innerHTML = '';
});

document.getElementById('btn-save-osc-config').addEventListener('click', () => {
  const config = {
    targetHost: document.getElementById('osc-target-host').value.trim() || '127.0.0.1',
    targetPort: parseInt(document.getElementById('osc-target-port').value, 10) || 22345,
    listenPort: parseInt(document.getElementById('osc-listen-port').value, 10) || 22346,
    addressPrefix: document.getElementById('osc-prefix').value.trim() || '/myo/0',
    sendEmg: document.getElementById('osc-toggle-emg').checked,
    sendOrientation: document.getElementById('osc-toggle-angles').checked,
    sendQuat: document.getElementById('osc-toggle-quat').checked,
    sendPoses: document.getElementById('osc-toggle-poses').checked,
    sendHits: document.getElementById('osc-toggle-hits').checked,
    sendImu: document.getElementById('osc-toggle-imu').checked
  };

  if (state.mode === 'server') {
    sendToServer({ type: 'update_osc_config', config });
    appendLog(`[OSC] Configuración guardada: Destino ${config.targetHost}:${config.targetPort}`, 'system');
  }
});

function syncOscConfigForm(cfg) {
  if (!cfg) return;
  if (cfg.targetHost) document.getElementById('osc-target-host').value = cfg.targetHost;
  if (cfg.targetPort) document.getElementById('osc-target-port').value = cfg.targetPort;
  if (cfg.listenPort) document.getElementById('osc-listen-port').value = cfg.listenPort;
  if (cfg.addressPrefix) document.getElementById('osc-prefix').value = cfg.addressPrefix;
  if (cfg.sendEmg !== undefined) document.getElementById('osc-toggle-emg').checked = cfg.sendEmg;
  if (cfg.sendOrientation !== undefined) document.getElementById('osc-toggle-angles').checked = cfg.sendOrientation;
  if (cfg.sendQuat !== undefined) document.getElementById('osc-toggle-quat').checked = cfg.sendQuat;
  if (cfg.sendPoses !== undefined) document.getElementById('osc-toggle-poses').checked = cfg.sendPoses;
  if (cfg.sendHits !== undefined) document.getElementById('osc-toggle-hits').checked = cfg.sendHits;
  if (cfg.sendImu !== undefined) document.getElementById('osc-toggle-imu').checked = cfg.sendImu;
}

function recordOscPacket(dir, address, args, sender) {
  state.packetCount++;
  oscPacketCounter.textContent = `${state.packetCount} paquetes`;

  const timeStr = new Date().toLocaleTimeString();
  const argsStr = Array.isArray(args) ? args.map(a => typeof a === 'number' ? a.toFixed(2) : String(a)).join(', ') : String(args);
  const logClass = dir === 'OUT' ? 'out' : 'in';
  const prefix = dir === 'OUT' ? `[OSC SALIDA -> ${document.getElementById('osc-target-port').value}]` : `[OSC ENTRADA de ${sender || 'UDP'}]`;

  appendLog(`${prefix} ${address} [${argsStr}]`, logClass, timeStr);
}

function appendLog(text, className = '', time = '') {
  const line = document.createElement('div');
  line.className = `log-line ${className}`;
  const t = time || new Date().toLocaleTimeString();
  line.innerHTML = `<span class="time">${t}</span> ${escapeHtml(text)}`;
  oscTerminalLog.appendChild(line);

  while (oscTerminalLog.children.length > 150) {
    oscTerminalLog.removeChild(oscTerminalLog.firstChild);
  }
  oscTerminalLog.scrollTop = oscTerminalLog.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====================================================================
// TAB 2: AUDIO SYNTH & HARMONIC OSCILLATORS STUDIO
// ====================================================================
class MyoAudioStudio {
  constructor() {
    this.ctx = null;
    this.active = false;
    this.mode = 'harmonic'; // 'harmonic', 'melodic', 'gestural'
    this.scale = 'pentatonic_minor';
    this.octave = 3;
    this.masterVolume = 0.7;

    // Audio Graph Nodes
    this.oscillators = [];
    this.harmGains = [];
    this.harmWeights = [1.0, 0, 0, 0, 0, 0];
    this.filter = null;
    this.delay = null;
    this.delayFeedback = null;
    this.reverb = null;
    this.analyser = null;
    this.masterGain = null;

    // Musical Scales (relative semitones)
    this.scales = {
      pentatonic_minor: [0, 3, 5, 7, 10, 12, 15, 17, 19, 22],
      dorian: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15],
      hirajoshi: [0, 2, 3, 7, 8, 12, 14, 15, 19, 20],
      phrygian: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16],
      major: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21],
      chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    };

    // Notes lookup
    this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

    // Current synthesis metrics
    this.currentFreq = 220;
    this.currentNoteName = 'A3';
    this.isFrozen = false;

    // Canvases
    this.canvasLissajous = document.getElementById('canvas-lissajous');
    this.ctxLissajous = this.canvasLissajous.getContext('2d');
    this.canvasFft = document.getElementById('canvas-fft-spectrum');
    this.ctxFft = this.canvasFft.getContext('2d');

    // UI elements
    this.valNote = document.getElementById('val-audio-note');
    this.valFreq = document.getElementById('val-audio-freq');
    this.mapBarPitch = document.getElementById('map-bar-pitch');
    this.mapValPitch = document.getElementById('map-val-pitch');
    this.mapBarRoll = document.getElementById('map-bar-roll');
    this.mapValRoll = document.getElementById('map-val-roll');
    this.mapBarGyro = document.getElementById('map-bar-gyro');
    this.mapValGyro = document.getElementById('map-val-gyro');
    this.mapBarEmg = document.getElementById('map-bar-emg');
    this.mapValEmg = document.getElementById('map-val-emg');
    this.valHarmonicBlend = document.getElementById('val-harmonic-blend');

    this.initUI();
    this.startVisualizerLoop();
  }

  initUI() {
    const btnPower = document.getElementById('btn-audio-toggle');
    btnPower.addEventListener('click', () => this.toggleAudio());

    document.getElementById('sel-audio-mode').addEventListener('change', (e) => {
      this.mode = e.target.value;
    });

    document.getElementById('sel-audio-scale').addEventListener('change', (e) => {
      this.scale = e.target.value;
    });

    document.getElementById('sel-audio-octave').addEventListener('change', (e) => {
      this.octave = parseInt(e.target.value, 10);
    });

    const volSlider = document.getElementById('slider-audio-volume');
    volSlider.addEventListener('input', (e) => {
      this.masterVolume = parseFloat(e.target.value);
      document.getElementById('val-audio-volume').textContent = `${Math.round(this.masterVolume * 100)}%`;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
      }
    });

    // FX Sliders
    document.getElementById('slider-fx-cutoff').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-fx-cutoff').textContent = `${v} Hz`;
      if (this.filter && this.ctx) {
        this.filter.frequency.setTargetAtTime(v, this.ctx.currentTime, 0.05);
      }
    });

    document.getElementById('slider-fx-delay').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('val-fx-delay').textContent = `${Math.round(v * 100)}%`;
      if (this.delayFeedback && this.ctx) {
        this.delayFeedback.gain.setTargetAtTime(v * 0.7, this.ctx.currentTime, 0.05);
      }
    });
  }

  toggleAudio() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupAudioGraph();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.active = !this.active;
    const btn = document.getElementById('btn-audio-toggle');
    const txt = document.getElementById('txt-audio-power');

    btn.classList.toggle('active', this.active);
    txt.textContent = this.active ? 'MOTOR DE AUDIO ACTIVO' : 'ACTIVAR MOTOR DE AUDIO';

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.active ? this.masterVolume : 0, this.ctx.currentTime, 0.05);
    }
  }

  setupAudioGraph() {
    const t = this.ctx.currentTime;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, t);

    // Resonant Filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(2500, t);
    this.filter.Q.setValueAtTime(4.0, t);

    // Delay FX (Echo)
    this.delay = this.ctx.createDelay();
    this.delay.delayTime.setValueAtTime(0.3, t);
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.setValueAtTime(0.3, t);

    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);

    // Analyser Node
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.8;

    // 6 Harmonic Additive Oscillators
    const numHarmonics = 6;
    for (let i = 1; i <= numHarmonics; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = i === 1 ? 'sine' : (i % 2 === 0 ? 'triangle' : 'sine');
      osc.frequency.setValueAtTime(220 * i, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(i === 1 ? 0.7 : 0, t);

      osc.connect(gain);
      gain.connect(this.filter);

      osc.start();
      this.oscillators.push(osc);
      this.harmGains.push(gain);
    }

    // Connect Graph
    this.filter.connect(this.masterGain);
    this.filter.connect(this.delay);
    this.delay.connect(this.masterGain);

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  // Called when Pitch / Roll / Yaw change
  onOrientationChange(roll, pitch, yaw) {
    if (!this.active || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Pitch (-1.2 to 1.2) -> Freq
    const normPitch = Math.max(0, Math.min(1, (pitch + 0.9) / 1.8));
    this.mapBarPitch.style.width = `${Math.round(normPitch * 100)}%`;
    this.mapValPitch.textContent = pitch.toFixed(2);

    let freq = 220;
    if (this.mode === 'harmonic') {
      // Continuous frequency glide (Theremin style)
      const baseFreq = 55 * Math.pow(2, this.octave);
      freq = baseFreq * Math.pow(2, normPitch * 2.2);
    } else {
      // Quantized scale mode
      const scaleNotes = this.scales[this.scale] || this.scales.pentatonic_minor;
      const idx = Math.min(scaleNotes.length - 1, Math.floor(normPitch * scaleNotes.length));
      const semitone = scaleNotes[idx];
      const baseMidi = 24 + this.octave * 12; // C
      const midiNote = baseMidi + semitone;
      freq = 440 * Math.pow(2, (midiNote - 69) / 12);

      const noteName = this.noteNames[midiNote % 12] + Math.floor(midiNote / 12);
      this.currentNoteName = noteName;
      this.valNote.textContent = noteName;
    }

    this.currentFreq = freq;
    this.valFreq.textContent = `${freq.toFixed(1)} Hz`;

    // Apply fundamental and harmonic multipliers
    for (let i = 0; i < this.oscillators.length; i++) {
      const harmMultiplier = i + 1;
      this.oscillators[i].frequency.setTargetAtTime(freq * harmMultiplier, t, 0.04);
    }

    // Roll (-PI to PI) -> Harmonic blend
    const normRoll = Math.abs(roll) / Math.PI; // 0 to 1
    this.mapBarRoll.style.width = `${Math.round(normRoll * 100)}%`;
    this.mapValRoll.textContent = roll.toFixed(2);

    this.harmWeights[0] = Math.max(0.2, 1.0 - normRoll * 0.7);
    this.harmWeights[1] = Math.min(0.8, normRoll * 0.9);
    this.harmWeights[2] = Math.min(0.7, normRoll * 0.8);
    this.harmWeights[3] = Math.min(0.5, Math.max(0, (normRoll - 0.2) * 0.7));
    this.harmWeights[4] = Math.min(0.4, Math.max(0, (normRoll - 0.4) * 0.6));
    this.harmWeights[5] = Math.min(0.3, Math.max(0, (normRoll - 0.6) * 0.5));

    for (let i = 0; i < 6; i++) {
      this.harmGains[i].gain.setTargetAtTime(this.harmWeights[i] * 0.5, t, 0.05);
      const fillEl = document.getElementById(`h-bar-${i + 1}`);
      const valEl = document.getElementById(`h-val-${i + 1}`);
      if (fillEl) fillEl.style.height = `${Math.round(this.harmWeights[i] * 100)}%`;
      if (valEl) valEl.textContent = this.harmWeights[i].toFixed(2);
    }

    this.valHarmonicBlend.textContent = normRoll < 0.2 ? 'Puro' : normRoll < 0.6 ? 'Armónicos Ricos' : 'Espectro Completo';
  }

  // Called when Gyroscope changes
  onGyroChange(gyro) {
    if (!this.active || !this.ctx) return;
    const speed = gyro.speed;
    const normSpeed = Math.min(1, speed / 350);

    this.mapBarGyro.style.width = `${Math.round(normSpeed * 100)}%`;
    this.mapValGyro.textContent = speed.toFixed(1);

    // Increase Q and add slight pitch vibrato on quick moves
    if (this.filter) {
      const qVal = 2.0 + normSpeed * 10.0;
      this.filter.Q.setTargetAtTime(qVal, this.ctx.currentTime, 0.05);
    }
  }

  // Called when EMG muscle tension changes
  onEmgChange(emgAvg, rawEmg) {
    if (!this.active || !this.ctx) return;
    const normEmg = Math.min(1, emgAvg / 45);

    this.mapBarEmg.style.width = `${Math.round(normEmg * 100)}%`;
    const cutoff = 300 + normEmg * 10000;
    this.mapValEmg.textContent = `${Math.round(cutoff)} Hz`;

    if (this.filter) {
      this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.05);
    }
  }

  onPoseChange(pose) {
    if (!this.active || !this.ctx) return;
    const t = this.ctx.currentTime;

    switch (pose) {
      case 'fist':
        // Freeze / Sustained chord
        this.isFrozen = true;
        if (this.filter) this.filter.Q.setTargetAtTime(12.0, t, 0.05);
        break;

      case 'fingers_spread':
        // Shimmer Reverb & Delay burst
        if (this.delayFeedback) this.delayFeedback.gain.setTargetAtTime(0.75, t, 0.08);
        setTimeout(() => {
          if (this.delayFeedback && this.ctx) this.delayFeedback.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.4);
        }, 1200);
        break;

      case 'wave_in':
        // Jump down an octave momentarily
        this.currentFreq *= 0.5;
        this.oscillators[0].frequency.setTargetAtTime(this.currentFreq, t, 0.05);
        break;

      case 'wave_out':
        // Jump up a 5th
        this.currentFreq *= 1.5;
        this.oscillators[0].frequency.setTargetAtTime(this.currentFreq, t, 0.05);
        break;

      case 'double_tap':
        this.onHitTrigger();
        break;

      case 'rest':
        this.isFrozen = false;
        if (this.filter) this.filter.Q.setTargetAtTime(3.5, t, 0.1);
        break;
    }
  }

  onHitTrigger() {
    if (!this.active || !this.ctx) return;
    // Percussive synth blast
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.18);

    g.gain.setValueAtTime(0.8, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.22);
  }

  startVisualizerLoop() {
    const timeData = new Uint8Array(256);
    const freqData = new Uint8Array(256);

    const render = () => {
      requestAnimationFrame(render);
      if (!this.analyser || !this.active) return;

      this.analyser.getByteTimeDomainData(timeData);
      this.analyser.getByteFrequencyData(freqData);

      // 1. Draw Lissajous XY (Phase Figure)
      const lw = this.canvasLissajous.width;
      const lh = this.canvasLissajous.height;
      this.ctxLissajous.fillStyle = 'rgba(6, 9, 16, 0.35)';
      this.ctxLissajous.fillRect(0, 0, lw, lh);

      this.ctxLissajous.strokeStyle = '#00ff9d';
      this.ctxLissajous.lineWidth = 2;
      this.ctxLissajous.beginPath();

      const phaseOffset = 32; // Phase delay for XY Lissajous
      for (let i = 0; i < timeData.length - phaseOffset; i++) {
        const x = (timeData[i] / 128 - 1) * (lw / 2.4) + lw / 2;
        const y = (timeData[i + phaseOffset] / 128 - 1) * (lh / 2.4) + lh / 2;
        if (i === 0) this.ctxLissajous.moveTo(x, y);
        else this.ctxLissajous.lineTo(x, y);
      }
      this.ctxLissajous.stroke();

      // 2. Draw FFT Spectrum & Waveform
      const fw = this.canvasFft.width;
      const fh = this.canvasFft.height;
      this.ctxFft.fillStyle = 'rgba(6, 9, 16, 0.35)';
      this.ctxFft.fillRect(0, 0, fw, fh);

      const barW = (fw / 64);
      for (let i = 0; i < 64; i++) {
        const val = freqData[i * 2] / 255;
        const barH = val * fh;
        const r = Math.round(val * 255);
        const g = Math.round((1 - val) * 200 + 55);
        this.ctxFft.fillStyle = `rgb(${r}, ${g}, 255)`;
        this.ctxFft.fillRect(i * barW, fh - barH, barW - 1, barH);
      }
    };
    render();
  }
}

let audioStudio = null;
try {
  audioStudio = new MyoAudioStudio();
} catch (e) {
  console.warn('AudioStudio error:', e);
}

// ====================================================================
// TAB 3: SHADERS GLSL & 3D VISUALS PERFORMANCE STUDIO
// ====================================================================
class MyoShadersStudio {
  constructor() {
    this.container = document.getElementById('canvas-shaders-container');
    this.wrapper = document.getElementById('shaders-viewport-wrapper');
    this.preset = 'particles';
    this.palette = 'cyberpunk';
    this.motionSens = 1.5;
    this.emgSens = 2.0;

    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Presets resources
    this.particleSystem = null;
    this.particlePositions = null;
    this.particleBasePos = null;

    this.quadMesh = null;
    this.glslMaterial = null;

    this.ribbonGroup = null;
    this.orbMesh = null;

    // Telemetry uniforms
    this.clock = new THREE.Clock();
    this.uniforms = {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_roll: { value: 0 },
      u_pitch: { value: 0 },
      u_yaw: { value: 0 },
      u_emg: { value: 0 },
      u_gyro: { value: 0 },
      u_hit: { value: 0 },
      u_palette: { value: 0 }
    };

    // HUD overlays
    this.hudPreset = document.getElementById('hud-preset-name');
    this.hudGyro = document.getElementById('hud-gyro-speed');
    this.hudEmg = document.getElementById('hud-emg-force');
    this.hudFps = document.getElementById('hud-fps');
    this.fpsCount = 0;
    this.lastFpsTime = performance.now();

    this.initUI();
    this.initThree();
    this.switchPreset('particles');
  }

  initUI() {
    document.getElementById('sel-shader-preset').addEventListener('change', (e) => {
      this.switchPreset(e.target.value);
    });

    document.getElementById('sel-shader-palette').addEventListener('change', (e) => {
      this.palette = e.target.value;
      const paletteMap = { cyberpunk: 0, aurora: 1, solar: 2, minimal: 3, void: 4 };
      this.uniforms.u_palette.value = paletteMap[this.palette] || 0;
      this.updateColors();
    });

    const sensSlider = document.getElementById('slider-shader-motion');
    sensSlider.addEventListener('input', (e) => {
      this.motionSens = parseFloat(e.target.value);
      document.getElementById('val-shader-motion').textContent = `${this.motionSens.toFixed(1)}x`;
    });

    const emgSlider = document.getElementById('slider-shader-emg');
    emgSlider.addEventListener('input', (e) => {
      this.emgSens = parseFloat(e.target.value);
      document.getElementById('val-shader-emg').textContent = `${this.emgSens.toFixed(1)}x`;
    });

    document.getElementById('btn-shader-hud-toggle').addEventListener('click', () => {
      const hud = document.getElementById('shader-hud-overlay');
      hud.classList.toggle('hidden');
    });

    document.getElementById('btn-shader-fullscreen').addEventListener('click', () => {
      this.toggleFullscreen();
    });
  }

  toggleFullscreen() {
    this.wrapper.classList.toggle('fullscreen');
    setTimeout(() => this.onResize(), 100);
  }

  initThree() {
    const w = this.container.clientWidth || 800;
    const h = this.container.clientHeight || 640;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    this.camera.position.z = 25;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.uniforms.u_resolution.value.set(w, h);

    window.addEventListener('resize', () => this.onResize());
    this.animate();
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.uniforms.u_resolution.value.set(w, h);
    }
  }

  switchPreset(presetName) {
    this.preset = presetName;

    // Clear scene children
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    const titles = {
      particles: 'Partículas Cuánticas (Swarm)',
      fluid_glsl: 'Shader GLSL Fluido & Plasma',
      minimal_lines: 'Cintas Geométricas & Grid 3D',
      warp_orb: 'Esfera Deformación 4D Noise'
    };
    this.hudPreset.textContent = titles[presetName] || presetName;

    if (presetName === 'particles') {
      this.buildParticleField();
    } else if (presetName === 'fluid_glsl') {
      this.buildGlslFluid();
    } else if (presetName === 'minimal_lines') {
      this.buildMinimalRibbon();
    } else if (presetName === 'warp_orb') {
      this.buildWarpOrb();
    }
  }

  // 1. Preset: 25,000 Particle Field
  buildParticleField() {
    const count = 25000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const basePos = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const color1 = new THREE.Color(0x00f0ff);
    const color2 = new THREE.Color(0x9d4edd);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 8 + Math.random() * 12;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      basePos[i * 3] = x;
      basePos[i * 3 + 1] = y;
      basePos[i * 3 + 2] = z;

      const mixed = color1.clone().lerp(color2, Math.random());
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.particleSystem = new THREE.Points(geo, mat);
    this.particlePositions = positions;
    this.particleBasePos = basePos;
    this.scene.add(this.particleSystem);
  }

  // 2. Preset: Pure GLSL Fragment Shader
  buildGlslFluid() {
    const quadGeo = new THREE.PlaneGeometry(50, 50);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform float u_roll;
      uniform float u_pitch;
      uniform float u_yaw;
      uniform float u_emg;
      uniform float u_gyro;
      uniform float u_hit;
      uniform int u_palette;
      varying vec2 vUv;

      // Simplex Noise 2D
      vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
      float snoise(vec2 v){
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v -   i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod(i, 289.0);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);

        // Angle rotation matrix from roll & pitch
        float cosA = cos(u_roll);
        float sinA = sin(u_roll);
        p = mat2(cosA, -sinA, sinA, cosA) * p;

        // Wave distortion based on EMG and Gyro
        float t = u_time * 0.5;
        float emgScale = 1.0 + u_emg * 3.0;
        float gyroTurb = u_gyro * 0.005;

        float n1 = snoise(p * (2.0 + gyroTurb) + vec2(t * 0.2, t * 0.3));
        float n2 = snoise(p * 4.0 - vec2(n1, n1) + u_pitch);
        float pattern = sin((p.x * 3.0 + n2 * 2.0) * emgScale + t) + cos((p.y * 3.0 + n1 * 2.0) + t);

        // Hit shockwave
        float dist = length(p);
        if (u_hit > 0.05) {
          pattern += sin(dist * 20.0 - u_time * 15.0) * u_hit * 2.0;
        }

        // Color palettes
        vec3 col = vec3(0.0);
        if (u_palette == 0) {
          // Cyberpunk
          col = mix(vec3(0.0, 0.94, 1.0), vec3(0.61, 0.15, 0.98), 0.5 + 0.5 * pattern);
        } else if (u_palette == 1) {
          // Aurora
          col = mix(vec3(0.0, 1.0, 0.6), vec3(0.0, 0.4, 0.9), 0.5 + 0.5 * pattern);
        } else if (u_palette == 2) {
          // Solar
          col = mix(vec3(1.0, 0.7, 0.0), vec3(1.0, 0.1, 0.2), 0.5 + 0.5 * pattern);
        } else if (u_palette == 3) {
          // Minimal
          float v = 0.5 + 0.5 * pattern;
          col = vec3(v * v);
        } else {
          // Void
          col = mix(vec3(0.4, 0.0, 0.8), vec3(0.05, 0.0, 0.2), 0.5 + 0.5 * pattern);
        }

        col += vec3(pow(abs(pattern), 3.0) * 0.15); // highlight specular
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    this.glslMaterial = new THREE.ShaderMaterial({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms: this.uniforms
    });

    this.quadMesh = new THREE.Mesh(quadGeo, this.glslMaterial);
    this.scene.add(this.quadMesh);
  }

  // 3. Preset: Minimal Generative Ribbon 3D
  buildMinimalRibbon() {
    this.ribbonGroup = new THREE.Group();
    const numRings = 24;

    for (let i = 0; i < numRings; i++) {
      const radius = 2 + i * 0.4;
      const geo = new THREE.TorusGeometry(radius, 0.05, 8, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x00f0ff : 0x9d4edd,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.z = (i - numRings / 2) * 0.8;
      this.ribbonGroup.add(ring);
    }
    this.scene.add(this.ribbonGroup);
  }

  // 4. Preset: 4D Muscle Deformed Orb
  buildWarpOrb() {
    const geo = new THREE.IcosahedronGeometry(7, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a1428,
      roughness: 0.2,
      metalness: 0.85,
      wireframe: true,
      emissive: new THREE.Color(0x00f0ff),
      emissiveIntensity: 0.4
    });

    this.orbMesh = new THREE.Mesh(geo, mat);
    this.orbBaseVertices = geo.attributes.position.clone();
    this.scene.add(this.orbMesh);

    const light = new THREE.PointLight(0x00f0ff, 2, 50);
    light.position.set(10, 10, 10);
    this.scene.add(light);
  }

  updateColors() {
    // Dynamically adjust palette colors for particles or meshes
  }

  onOrientationChange(ori) {
    this.uniforms.u_roll.value = ori.roll * this.motionSens;
    this.uniforms.u_pitch.value = ori.pitch * this.motionSens;
    this.uniforms.u_yaw.value = ori.yaw * this.motionSens;

    if (this.particleSystem) {
      this.particleSystem.rotation.x = ori.pitch * 0.8 * this.motionSens;
      this.particleSystem.rotation.y = ori.yaw * 0.8 * this.motionSens;
      this.particleSystem.rotation.z = ori.roll * 0.8 * this.motionSens;
    }
    if (this.ribbonGroup) {
      this.ribbonGroup.rotation.x = ori.pitch * this.motionSens;
      this.ribbonGroup.rotation.z = ori.roll * this.motionSens;
    }
    if (this.orbMesh) {
      this.orbMesh.rotation.y = ori.roll * this.motionSens;
      this.orbMesh.rotation.x = ori.pitch * this.motionSens;
    }
  }

  onGyroChange(gyro) {
    this.uniforms.u_gyro.value = gyro.speed;
    this.hudGyro.textContent = `${gyro.speed.toFixed(1)} °/s`;
  }

  onEmgChange(emgAvg, rawEmg) {
    const norm = Math.min(1, emgAvg / 40) * this.emgSens;
    this.uniforms.u_emg.value = norm;
    this.hudEmg.textContent = `${Math.round(norm * 50)}%`;

    // Particles explosion burst with EMG
    if (this.preset === 'particles' && this.particlePositions && this.particleBasePos) {
      const count = this.particlePositions.length / 3;
      const expand = 1.0 + norm * 0.4;
      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        this.particlePositions[i3] = this.particleBasePos[i3] * expand;
        this.particlePositions[i3 + 1] = this.particleBasePos[i3 + 1] * expand;
        this.particlePositions[i3 + 2] = this.particleBasePos[i3 + 2] * expand;
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }
  }

  onHitTrigger() {
    this.uniforms.u_hit.value = 1.0;
    setTimeout(() => {
      this.uniforms.u_hit.value = 0.0;
    }, 300);
  }

  onPoseChange(pose) {
    if (pose === 'fist') {
      this.uniforms.u_hit.value = 0.7;
    } else if (pose === 'rest') {
      this.uniforms.u_hit.value = 0.0;
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    this.uniforms.u_time.value = elapsedTime;

    // Ribbon twisting
    if (this.preset === 'minimal_lines' && this.ribbonGroup) {
      this.ribbonGroup.children.forEach((ring, idx) => {
        ring.rotation.z += 0.01 * (idx % 2 === 0 ? 1 : -1);
        ring.rotation.y = Math.sin(elapsedTime * 2 + idx * 0.2) * 0.4;
      });
    }

    // Orb deformation
    if (this.preset === 'warp_orb' && this.orbMesh && this.orbBaseVertices) {
      const pos = this.orbMesh.geometry.attributes.position;
      const base = this.orbBaseVertices;
      const count = pos.count;
      const emgVal = this.uniforms.u_emg.value;

      for (let i = 0; i < count; i++) {
        const bx = base.getX(i);
        const by = base.getY(i);
        const bz = base.getZ(i);

        const warp = 1 + Math.sin(bx * 0.8 + elapsedTime * 3) * Math.cos(by * 0.8 + elapsedTime * 2) * (0.15 + emgVal * 0.35);
        pos.setXYZ(i, bx * warp, by * warp, bz * warp);
      }
      pos.needsUpdate = true;
    }

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    // FPS Counter
    this.fpsCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.hudFps.textContent = this.fpsCount;
      this.fpsCount = 0;
      this.lastFpsTime = now;
    }
  }
}

let shadersStudio = null;
try {
  shadersStudio = new MyoShadersStudio();
} catch (e) {
  console.warn('ShadersStudio error:', e);
}

// ----------------------------------------------------
// Startup WebSocket Connection
// ----------------------------------------------------
initWebSocket();
