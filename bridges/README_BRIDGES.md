# 🔌 Puentes Myo Alternativos (100% Sin Myo Connect)

Esta carpeta contiene dos soluciones completas para utilizar la pulsera **Thalmic Myo Armband** prescindiendo por completo del software cerrado y discontinuado **Myo Connect**:

---

## 🛠️ Opciones Disponibles

### Opción 1: Con el Dongle Oficial USB (`pyomyo`)
* **Archivo:** [`bridge_pyomyo_dongle.py`](bridge_pyomyo_dongle.py)
* **Lanzador rápido:** [`INICIAR_DONGLE_PYOMYO.bat`](INICIAR_DONGLE_PYOMYO.bat)
* **Cómo opera:**
  El dongle USB original de Myo es un chip **Silicon Labs / Bluegiga BLED112**. Este script se comunica directamente con el puerto serie virtual (`COM3`) utilizando el protocolo binario BGAPI.
* **Ventajas:**
  * No requiere instalar ningún driver de Thalmic Labs ni software Myo Connect.
  * Latencia ultrabaja y máxima tasa de muestreo de EMG a 200 Hz puro.
  * Se conecta de inmediato al dongle que ya tienes.

### Opción 2: Sin el Dongle USB, con Bluetooth de la PC (`Bleak`)
* **Archivo:** [`bridge_bleak_bluetooth.py`](bridge_bleak_bluetooth.py)
* **Lanzador rápido:** [`INICIAR_BLUETOOTH_BLEAK.bat`](INICIAR_BLUETOOTH_BLEAK.bat)
* **Cómo opera:**
  Utiliza el adaptador Bluetooth 4.0+ integrado en tu propia computadora (tarjeta Intel, Realtek, etc.) a través de la API `WinRT Bluetooth` de Windows mediante la librería `Bleak`.
* **Ventajas:**
  * **Cero hardware extra:** Si en el futuro pierdes el dongle USB oficial o quieres viajar ligero sin conectar nada, la pulsera se vincula directamente al Bluetooth de tu laptop o PC.

---

## 📦 Instalación de Dependencias

1. Haz doble clic en:
   👉 [**`INSTALAR_DEPENDENCIAS_PYTHON.bat`**](INSTALAR_DEPENDENCIAS_PYTHON.bat)
   *(O ejecuta `pip install -r requirements.txt`)*

---

## 🚀 Cómo Ejecutar

### Si vas a usar el Dongle Oficial (Opción 1):
1. Asegúrate de que **Myo Connect esté CERRADO** (para que no bloquee el puerto COM del dongle).
2. Haz doble clic en [**`INICIAR_DONGLE_PYOMYO.bat`**](INICIAR_DONGLE_PYOMYO.bat).
3. Mueve la pulsera para despertarla; el script la detectará y comenzará a enviar datos OSC y WebSockets de inmediato.

### Si vas a usar el Bluetooth Integrado de tu PC (Opción 2):
1. Desconecta el dongle USB de Myo (para que la pulsera no intente enlazarse a él).
2. Enciende el Bluetooth de Windows.
3. Haz doble clic en [**`INICIAR_BLUETOOTH_BLEAK.bat`**](INICIAR_BLUETOOTH_BLEAK.bat).
4. El script escaneará el espectro BLE, se conectará al servicio GATT de Myo y activará el flujo continuo de sensores.

---

## 📡 Integración con la WebApp y DAWs

Ambos puentes transmiten los paquetes OSC UDP exactamente con el mismo estándar hacia **`127.0.0.1:22345`**:
* `/myo/0/emg`: 8 valores de contracción muscular.
* `/myo/0/roll`, `/myo/0/pitch`, `/myo/0/yaw`: Ángulos de rotación.
* `/myo/0/quaternion`: Orientación 3D normalizada `[x, y, z, w]`.
* `/myo/0/pose`: Gesto activo (`fist`, `wave_in`, `wave_out`, `fingers_spread`, `double_tap`, `rest`).
* `/myo/0/hit`: Disparo de impacto repentino.
* `/myo/0/accel` y `/myo/0/gyro`: Vectores inerciales.
