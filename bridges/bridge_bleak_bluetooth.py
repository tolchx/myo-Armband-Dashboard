"""
====================================================================
  MYO ARMBAND - PUENTE BLUETOOTH NATIVO PC (Bleak)
  Completamente INDEPENDIENTE del Dongle y de Myo Connect.
====================================================================
Funcionalidades:
1. Conecta directamente a la pulsera Myo mediante el adaptador Bluetooth 4.0+
   integrado en tu PC (Intel, Realtek, etc.) usando la API Bleak / WinRT.
2. No requiere el Dongle USB oficial ni ningún software propietario.
3. Transmite paquetes OSC UDP hacia 127.0.0.1:22345 (Ableton, TouchDesigner, etc.).
4. Permite controlar la pulsera sin dongle y sin Myo Connect.
"""

import sys
import os
import time
import math
import struct
import socket
import asyncio
import argparse

try:
    from bleak import BleakScanner, BleakClient
except ImportError:
    print("[ERROR] La librería 'bleak' no está instalada.")
    print("Instálala ejecutando: pip install bleak")
    sys.exit(1)

# ----------------------------------------------------
# Constantes y UUIDs Oficiales de Myo BLE GATT
# ----------------------------------------------------
MYO_SERVICE_UUID = "d5060001-a904-deb9-4748-2c7f4a124842"

CHAR_COMMAND = "d5060401-a904-deb9-4748-2c7f4a124842"
CHAR_IMU_DATA = "d5060402-a904-deb9-4748-2c7f4a124842"
CHAR_CLASSIFIER_EVENT = "d5060103-a904-deb9-4748-2c7f4a124842"

CHAR_EMG_0 = "d5060105-a904-deb9-4748-2c7f4a124842"
CHAR_EMG_1 = "d5060205-a904-deb9-4748-2c7f4a124842"
CHAR_EMG_2 = "d5060305-a904-deb9-4748-2c7f4a124842"
CHAR_EMG_3 = "d5060405-a904-deb9-4748-2c7f4a124842"

CHAR_BATTERY = "00002a19-0000-1000-8000-00805f9b34fb"

# Configuración OSC
DEFAULT_OSC_HOST = "127.0.0.1"
DEFAULT_OSC_PORT = 22345
OSC_PREFIX = "/myo/0"

udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

def encode_osc(address, args):
    """Codificador binario OSC ligero"""
    addr_bytes = address.encode('utf-8') + b'\x00'
    while len(addr_bytes) % 4 != 0:
        addr_bytes += b'\x00'

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
    except Exception:
        pass

# ----------------------------------------------------
# Manejadores de Notificaciones GATT
# ----------------------------------------------------
pose_map = {
    0: "rest",
    1: "fist",
    2: "wave_in",
    3: "wave_out",
    4: "fingers_spread",
    5: "double_tap"
}

def notification_imu(sender, data):
    """Procesa el paquete IMU (Cuaternión + Acelerómetro + Giroscopio)"""
    # Formato: 4 shorts cuat, 3 shorts accel, 3 shorts gyro
    vals = struct.unpack('<10h', data)
    w = vals[0] / 16384.0
    x = vals[1] / 16384.0
    y = vals[2] / 16384.0
    z = vals[3] / 16384.0

    roll = math.atan2(2.0 * (w * x + y * z), 1.0 - 2.0 * (x * x + y * y))
    pitch = math.asin(max(-1.0, min(1.0, 2.0 * (w * y - z * x))))
    yaw = math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))

    ax = vals[4] / 2048.0
    ay = vals[5] / 2048.0
    az = vals[6] / 2048.0

    gx = vals[7] / 16.0
    gy = vals[8] / 16.0
    gz = vals[9] / 16.0

    send_osc(f"{OSC_PREFIX}/roll", roll)
    send_osc(f"{OSC_PREFIX}/pitch", pitch)
    send_osc(f"{OSC_PREFIX}/yaw", yaw)
    send_osc(f"{OSC_PREFIX}/quaternion", [x, y, z, w])
    send_osc(f"{OSC_PREFIX}/accel", [ax, ay, az])
    send_osc(f"{OSC_PREFIX}/gyro", [gx, gy, gz])

    if abs(gx) > 200 or abs(gy) > 200 or abs(gz) > 200:
        send_osc(f"{OSC_PREFIX}/hit", 1)

def notification_emg(sender, data):
    """Procesa 16 bytes que representan 2 muestras de 8 canales EMG"""
    # Muestra 1: primeros 8 bytes (-128 a 127)
    sample1 = struct.unpack('<8b', data[:8])
    send_osc(f"{OSC_PREFIX}/emg", list(sample1))
    if len(data) >= 16:
        sample2 = struct.unpack('<8b', data[8:16])
        send_osc(f"{OSC_PREFIX}/emg", list(sample2))

def notification_classifier(sender, data):
    """Procesa eventos de poses y sincronización de brazo"""
    event_type = data[0]
    if event_type == 1: # Pose
        pose_code = data[1]
        pose_str = pose_map.get(pose_code, "rest")
        print(f"[Gesto BLE] -> {pose_str.upper()}")
        send_osc(f"{OSC_PREFIX}/pose", pose_str)
        send_osc(f"{OSC_PREFIX}/{pose_str}", 1)
    elif event_type == 2: # Arm Synced
        arm = "right" if data[1] == 1 else "left" if data[1] == 2 else "unknown"
        xdir = "toward_wrist" if data[2] == 1 else "toward_elbow"
        print(f"[Brazo BLE] -> {arm.upper()}, Dirección: {xdir}")
    elif event_type == 3: # Arm Unsynced
        print("[Brazo BLE] -> Desincronizado")

# ----------------------------------------------------
# Rutina Principal Asincrónica
# ----------------------------------------------------
async def run_bleak_bridge(device_address=None, osc_host=DEFAULT_OSC_HOST, osc_port=DEFAULT_OSC_PORT):
    print("=" * 65)
    print("     MYO ARMBAND - PUENTE BLUETOOTH NATIVO PC (BLEAK)")
    print("        100% LIBRE DE DONGLE Y DE MYO CONNECT")
    print("=" * 65)
    print(f" Destino OSC: {osc_host}:{osc_port}")

    target_device = None

    if device_address:
        print(f"Buscando dispositivo con dirección MAC: {device_address}...")
        target_device = await BleakScanner.find_device_by_address(device_address, timeout=10.0)
    else:
        print("Escaneando dispositivos Bluetooth BLE en busca de Myo Armband...")
        devices = await BleakScanner.discover(timeout=7.0)
        for d in devices:
            if d.name and "myo" in d.name.lower():
                target_device = d
                break

    if not target_device:
        print("\n[AVISO] No se detectó ninguna pulsera Myo encendida.")
        print("Asegúrate de que:")
        print("  1. El Bluetooth de tu PC esté encendido.")
        print("  2. Mueve la pulsera Myo para despertarla (las luces parpadearán).")
        print("  3. Si la pulsera está conectada al dongle oficial, desconéctalo temporalmente.")
        return

    print(f"[OK] Pulsera detectada: {target_device.name} [{target_device.address}]")
    print("Estableciendo conexión GATT...")

    async with BleakClient(target_device.address) as client:
        print("[OK] Conectado a la pulsera vía Bluetooth nativo.")

        # Desactivar modo suspensión (Never Sleep)
        # Comando 0x09 (sleep mode), len 1, valor 1
        await client.write_gatt_char(CHAR_COMMAND, bytes([0x09, 0x01, 0x01]), response=True)

        # Suscribir a notificaciones de IMU, Poses y EMG
        await client.start_notify(CHAR_IMU_DATA, notification_imu)
        await client.start_notify(CHAR_CLASSIFIER_EVENT, notification_classifier)
        await client.start_notify(CHAR_EMG_0, notification_emg)
        await client.start_notify(CHAR_EMG_1, notification_emg)
        await client.start_notify(CHAR_EMG_2, notification_emg)
        await client.start_notify(CHAR_EMG_3, notification_emg)

        # Activar streaming de EMG (Modo 2: Raw / Filtrado), IMU (Modo 1) y Clasificador (Modo 1)
        # Comando 0x01 (set mode): [cmd=1, len=3, emg=2, imu=1, classifier=1]
        await client.write_gatt_char(CHAR_COMMAND, bytes([0x01, 0x03, 0x02, 0x01, 0x01]), response=True)

        # Vibración corta de confirmación (Comando 0x03, len 1, tipo 1)
        try:
            await client.write_gatt_char(CHAR_COMMAND, bytes([0x03, 0x01, 0x01]), response=False)
        except Exception:
            pass

        print("\n[TRANSMITIENDO] Streaming activo de IMU y 8 Canales EMG.")
        print("Los datos se están enviando por OSC a tu WebApp / Ableton / TouchDesigner.")
        print("Presiona Ctrl+C para desconectar.\n")

        while True:
            await asyncio.sleep(1.0)

def main():
    parser = argparse.ArgumentParser(description="Puente Bluetooth Nativo PC Myo (Bleak) -> OSC")
    parser.add_argument("--mac", type=str, default=None, help="Dirección MAC opcional (ej: e3-39-11-26-b2-fe)")
    parser.add_argument("--osc-host", type=str, default=DEFAULT_OSC_HOST, help="Host destino OSC (127.0.0.1)")
    parser.add_argument("--osc-port", type=int, default=DEFAULT_OSC_PORT, help="Puerto UDP destino OSC (22345)")
    args = parser.parse_args()

    try:
        asyncio.run(run_bleak_bridge(args.mac, args.osc_host, args.osc_port))
    except KeyboardInterrupt:
        print("\nPuente Bleak detenido por el usuario.")

if __name__ == "__main__":
    main()
