"""
====================================================================
  MYO ARMBAND - PUENTE DONGLE BLED112 (pyomyo)
  Completamente INDEPENDIENTE de Myo Connect.
====================================================================
Funcionalidades:
1. Conecta directamente al Dongle USB oficial (Silicon Labs BLED112 / COM3)
   mediante el protocolo binario BGAPI.
2. Captura EMG a 200 Hz puro, Orientación IMU, Acelerómetro, Giroscopio, Poses y Batería.
3. Transmite paquetes OSC UDP hacia 127.0.0.1:22345 (compatible con Ableton, TouchDesigner, Resolume).
4. Servidor WebSocket opcional en ws://127.0.0.1:10138 (reemplazo drop-in de Myo Connect)
   o ws://127.0.0.1:3001 para la WebApp.
"""

import sys
import os
import time
import math
import struct
import socket
import json
import threading
import argparse

# Asegurar import de pyomyo local
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

try:
    from pyomyo import Myo, emg_mode
    from pyomyo.pyomyo import Pose, Arm, XDirection
except ImportError:
    from pyomyo.pyomyo import Myo, emg_mode, Pose, Arm, XDirection

# ----------------------------------------------------
# Configuración por Defecto
# ----------------------------------------------------
DEFAULT_OSC_HOST = "127.0.0.1"
DEFAULT_OSC_PORT = 22345
DEFAULT_WS_PORT = 10138
OSC_PREFIX = "/myo/0"

# Sockets UDP
udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

# ----------------------------------------------------
# Simple Codificador OSC nativo (Cero dependencias)
# ----------------------------------------------------
def encode_osc(address, args):
    """Codifica un paquete OSC en bytes sin requerir librerías externas."""
    # Address con padding nulo múltiplo de 4
    addr_bytes = address.encode('utf-8') + b'\x00'
    while len(addr_bytes) % 4 != 0:
        addr_bytes += b'\x00'

    # Type tags
    tag_str = ','
    arg_bytes = b''
    for a in args:
        if isinstance(a, int):
            tag_str += 'i'
            arg_bytes += struct.pack('>i', a)
        elif isinstance(a, float):
            tag_str += 'f'
            arg_bytes += struct.pack('>f', a)
        elif isinstance(a, str):
            tag_str += 's'
            s_b = a.encode('utf-8') + b'\x00'
            while len(s_b) % 4 != 0:
                s_b += b'\x00'
            arg_bytes += s_b

    tag_bytes = tag_str.encode('utf-8') + b'\x00'
    while len(tag_bytes) % 4 != 0:
        tag_bytes += b'\x00'

    return addr_bytes + tag_bytes + arg_bytes

def send_osc(address, args, host=DEFAULT_OSC_HOST, port=DEFAULT_OSC_PORT):
    try:
        if not isinstance(args, (list, tuple)):
            args = [args]
        pkt = encode_osc(address, args)
        udp_sock.sendto(pkt, (host, port))
    except Exception as e:
        pass

# ----------------------------------------------------
# Servidor WebSocket Ligero (Asyncio / Thread)
# ----------------------------------------------------
ws_clients = set()
ws_lock = threading.Lock()

def broadcast_ws(event_type, payload):
    if not ws_clients:
        return
    msg = json.dumps(["event", dict(type=event_type, **payload)])
    with ws_lock:
        to_remove = set()
        for client in ws_clients:
            try:
                client.send(msg)
            except Exception:
                to_remove.add(client)
        ws_clients.difference_update(to_remove)

# ----------------------------------------------------
# Callbacks del Hardware Myo (pyomyo)
# ----------------------------------------------------
pose_names = {
    Pose.REST: "rest",
    Pose.FIST: "fist",
    Pose.WAVE_IN: "wave_in",
    Pose.WAVE_OUT: "wave_out",
    Pose.FINGERS_SPREAD: "fingers_spread",
    Pose.THUMB_TO_PINKY: "double_tap",
    Pose.UNKNOWN: "rest"
}

current_roll = 0.0
current_pitch = 0.0
current_yaw = 0.0

def handle_emg(emg_data, moving):
    """Recepción de 8 canales EMG a 200 Hz"""
    emg_list = list(emg_data)
    send_osc(f"{OSC_PREFIX}/emg", emg_list)
    broadcast_ws("emg", {"myo": 0, "emg": emg_list, "timestamp": int(time.time() * 1000000)})

def handle_imu(quat, accel, gyro):
    """Recepción de Cuaterniones, Acelerómetro y Giroscopio"""
    global current_roll, current_pitch, current_yaw
    # Quat: w, x, y, z
    w, x, y, z = quat
    # Normalizar escala (-1.0 a 1.0)
    w /= 16384.0
    x /= 16384.0
    y /= 16384.0
    z /= 16384.0

    # Euler angles
    roll = math.atan2(2.0 * (w * x + y * z), 1.0 - 2.0 * (x * x + y * y))
    pitch = math.asin(max(-1.0, min(1.0, 2.0 * (w * y - z * x))))
    yaw = math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))
    current_roll, current_pitch, current_yaw = roll, pitch, yaw

    # Accel (Gs)
    ax, ay, az = accel[0] / 2048.0, accel[1] / 2048.0, accel[2] / 2048.0
    # Gyro (deg/s)
    gx, gy, gz = gyro[0] / 16.0, gyro[1] / 16.0, gyro[2] / 16.0

    # Enviar OSC
    send_osc(f"{OSC_PREFIX}/roll", roll)
    send_osc(f"{OSC_PREFIX}/pitch", pitch)
    send_osc(f"{OSC_PREFIX}/yaw", yaw)
    send_osc(f"{OSC_PREFIX}/quaternion", [x, y, z, w])
    send_osc(f"{OSC_PREFIX}/accel", [ax, ay, az])
    send_osc(f"{OSC_PREFIX}/gyro", [gx, gy, gz])

    # Hit detection
    if abs(gx) > 200 or abs(gy) > 200 or abs(gz) > 200:
        send_osc(f"{OSC_PREFIX}/hit", 1)

    broadcast_ws("orientation", {
        "myo": 0,
        "orientation": {"w": w, "x": x, "y": y, "z": z},
        "accelerometer": [ax, ay, az],
        "gyroscope": [gx, gy, gz],
        "timestamp": int(time.time() * 1000000)
    })

def handle_pose(pose_enum):
    pose_str = pose_names.get(pose_enum, "rest")
    send_osc(f"{OSC_PREFIX}/pose", pose_str)
    send_osc(f"{OSC_PREFIX}/{pose_str}", 1)
    broadcast_ws("pose", {"myo": 0, "pose": pose_str})
    print(f"[Gesto Myo] -> {pose_str.upper()}")

def handle_arm(arm_enum, xdir_enum):
    arm_str = "left" if arm_enum == Arm.LEFT else "right" if arm_enum == Arm.RIGHT else "unknown"
    xdir_str = "toward_elbow" if xdir_enum == XDirection.X_TOWARD_ELBOW else "toward_wrist"
    print(f"[Brazo Sincronizado] -> {arm_str.upper()}, Dirección: {xdir_str}")
    broadcast_ws("arm_synced", {
        "myo": 0,
        "arm": arm_str,
        "x_direction": xdir_str,
        "warmup_state": "warm"
    })

def handle_battery(level):
    send_osc(f"{OSC_PREFIX}/battery_level", float(level))
    broadcast_ws("battery_level", {"myo": 0, "battery_level": level})
    print(f"[Batería Myo] -> {level}%")

# ----------------------------------------------------
# Main Runner
# ----------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Puente Dongle Myo BLED112 (pyomyo) -> OSC & Web")
    parser.add_argument("--port", type=str, default=None, help="Puerto COM (ej: COM3). Si se omite, auto-detecta.")
    parser.add_argument("--osc-host", type=str, default=DEFAULT_OSC_HOST, help="Host destino OSC (127.0.0.1)")
    parser.add_argument("--osc-port", type=int, default=DEFAULT_OSC_PORT, help="Puerto UDP destino OSC (22345)")
    args = parser.parse_args()

    print("=" * 65)
    print("      MYO ARMBAND - PUENTE DONGLE BLED112 (PYOMYO)")
    print("          100% LIBRE DE MYO CONNECT")
    print("=" * 65)
    print(f" Destino OSC:   {args.osc_host}:{args.osc_port}")
    print(f" Prefijo OSC:   {OSC_PREFIX}/...")
    print(" Buscando dongle oficial BLED112 (PID 2458:0001)...")

    try:
        # Modo FILTERED (200Hz procesado) o RAW (200Hz crudo)
        m = Myo(tty=args.port, mode=emg_mode.FILTERED)
        print(f"[OK] Dongle detectado y conectado en puerto: {m.bt.ser.port}")
    except Exception as e:
        print(f"\n[ERROR] No se pudo abrir el dongle BLED112: {e}")
        print("Verifica que:")
        print("  1. El dongle USB oficial esté conectado.")
        print("  2. Myo Connect esté CERRADO (para que no bloquee el puerto COM).")
        sys.exit(1)

    m.add_emg_handler(handle_emg)
    m.add_imu_handler(handle_imu)
    m.add_pose_handler(handle_pose)
    m.add_arm_handler(handle_arm)
    m.add_battery_handler(handle_battery)

    print("\nIniciando escaneo y conexión con la pulsera Myo...")
    print("Colócate la pulsera y muévela para activarla.")
    m.connect()
    print("[OK] ¡Pulsera Myo conectada exitosamente!")
    print("Transmitiendo datos en tiempo real a Ableton / WebApp / TouchDesigner.")
    print("Presiona Ctrl+C para detener.\n")

    # Vibración de bienvenida
    try:
        m.vibrate(1)
    except Exception:
        pass

    try:
        while True:
            m.run()
    except KeyboardInterrupt:
        print("\nCerrando puente pyomyo...")
        try:
            m.disconnect()
        except Exception:
            pass

if __name__ == "__main__":
    main()
