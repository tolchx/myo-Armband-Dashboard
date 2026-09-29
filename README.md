# 🦾 Myo Armband Performance Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-yellow.svg)](https://www.python.org/)
[![WebGL](https://img.shields.io/badge/Three.js-WebGL-cyan.svg)](https://threejs.org/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Synthesizer-purple.svg)](https://developer.mozilla.org/es/docs/Web/API/Web_Audio_API)
[![OSC](https://img.shields.io/badge/OSC-UDP%20Bridge-orange.svg)](http://opensoundcontrol.org/)
[![Bluetooth](https://img.shields.io/badge/BLE-GATT%20Direct-blue.svg)](https://github.com/hbldh/bleak)

Suite interactiva integral para la pulsera **Thalmic Labs Myo Armband**. Permite capturar, visualizar y traducir en tiempo real la actividad electromiográfica (EMG de 8 canales a 200 Hz), orientación espacial (IMU cuaterniones/ángulos Euler) y reconocimiento de gestos mediante IA para música, artes electrónicas y performances en vivo.

Funciona tanto con el software oficial **Myo Connect** como de forma **100% independiente** (mediante drivers libres para el Dongle USB oficial o con el Bluetooth integrado de tu PC sin ningún dongle).

---

## ⚡ Modos de Conexión Disponibles

El proyecto ofrece **3 métodos de operación** según tus necesidades de hardware:

| Característica | 1. Myo Connect Oficial | 2. Dongle BLED112 (`pyomyo`) | 3. Bluetooth PC (`Bleak`) |
| :--- | :---: | :---: | :---: |
| **Requiere Myo Connect** | ✅ Sí | ❌ **No (100% Libre)** | ❌ **No (100% Libre)** |
| **Requiere Dongle USB** | ✅ Sí (Oficial) | ✅ Sí (Oficial BLED112) | ❌ **No (Usa Bluetooth PC)** |
| **Frecuencia EMG** | 50 Hz / 200 Hz | **200 Hz Puro (Sin filtro)** | **200 Hz Puro** |
| **Salida OSC UDP (22345)** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Compatible con WebApp** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Lanzador en 1 Clic** | `INICIAR_MYO_WEBAPP.bat` | `INICIAR_DONGLE_PYOMYO.bat` | `INICIAR_BLUETOOTH_BLEAK.bat` |

---

## 📸 Módulos Principales de la WebApp (`http://localhost:3000`)

### 1. 📊 Telemetría & Puente OSC
* **Modelo 3D de la Pulsera (Three.js)**: Orientación continua mediante cuaterniones sin bloqueo cardánico (*gimbal lock*). Los 8 sensores 3D se iluminan según la contracción muscular de cada canal.
* **Osciloscopio EMG 8 Canales (200 Hz)**: Graficado en tiempo real (-128 a +127) con medidores de amplitud RMS y **Mapa de Calor Radial** del antebrazo.
* **Matriz de Gestos con IA**: Detección reactiva con iluminación para: `Rest`, `Fist`, `Wave In`, `Wave Out`, `Fingers Spread` y `Double Tap`.
* **Telemetría de Movimiento**: Ángulos Roll, Pitch, Yaw, Acelerómetro 3D, Giroscopio y alerta de **Impacto / HIT**.
* **Controles de Hardware**: Vibración háptica remota (⚡ corta, media, larga), calibración de centro (*Tare*) y bloqueo/desbloqueo.
* **Enrutador OSC UDP**: Transmisión en tiempo real con selector de host, puerto y filtros por canal.

### 2. 🎵 Control Sonoro & Armónicos (Web Audio API)
* **Modos de Síntesis**:
  * *Oscilador Armónico Continuo (Theremin / Dron)*: Glissando analógico modulado por el ángulo de inclinación vertical (*Pitch*).
  * *Arpegiador Melódico Cuantizado*: Cuantiza las notas a escalas musicales (*Pentatónica Menor*, *Dórica Mística*, *Japonesa Hirajoshi*, *Frigia Dominante*, *Mayor Espacial*, *Cromática*).
  * *Polifonía Gestual*: Disparo de acordes y saltos de escala mediante gestos Myo.
* **Banco de 6 Armónicos Aditivos (Modulado por ROLL)**: Al girar la muñeca se modulan los sobretonos: 1× Fundamental, 2× Octava, 3× Quinta, 4× Segunda Octava, 5× Tercera Mayor, 6× Tercera Octava.
* **Modulación por Sensores**:
  * **PITCH**: Frecuencia fundamental / tono melódico (Hz).
  * **ROLL**: Riqueza y saturación armónica.
  * **GIROSCOPIO**: Modula la resonancia Q del filtro y añade vibrato a movimientos rápidos.
  * **EMG (Tensión muscular)**: Abre el **Filtro Lowpass Resonante** desde 200 Hz hasta 12.000 Hz al apretar los músculos.
* **Acciones Gestuales**:
  * ✊ **Fist**: *Hold Freeze* (congela el acorde activo con alta resonancia sostenida).
  * 👈 **Wave In**: Salto de escala descendente (↓).
  * 👉 **Wave Out**: Salto de escala ascendente (↑).
  * 🖐️ **Fingers Spread**: Ráfaga de reverberación espacial (*Shimmer Delay*).
  * ✌️ **Double Tap**: Disparo de pulso percusivo sintético.
  * ✋ **Rest**: Caída suave a pad de ambiente.
* **Visualizadores de Audio**:
  * **Fase Lissajous XY**: Gráfica de correlación armónica y desfase estéreo.
  * **Espectro FFT**: Analizador de 64 bandas espectrales en tiempo real.

### 3. 🌌 Shaders GLSL & Visuales 3D Reactivos
* **Presets de Visuales**:
  1. 🌌 **Campo de Partículas Cuánticas (Swarm / Vortex)**: 25.000 partículas tridimensionales que rotan con la pulsera, generan vórtices con la velocidad del giroscopio y se expanden radialmente ante la fuerza muscular (EMG).
  2. 🌊 **Shader GLSL Fluido & Plasma Raymarching**: Fragment shader puro con ruido simplex 2D continuo; el ángulo de la mano dirige el flujo de plasma y los movimientos bruscos (*hit*) producen ondas de distorsión líquida.
  3. 📐 **Cintas Geométricas & Grid Minimal 3D**: Anillos concéntricos de Lissajous que se torsionan con la rotación de tu antebrazo.
  4. 🔮 **Esfera de Deformación Muscular (4D Noise)**: Malla 3D icosaédrica cuyos vértices respiran y mutan con los 8 canales EMG.
* **Paletas de Color**: Cyberpunk Neon, Aurora Boreal, Fuego Solar, Monocromo Minimal y Deep Void.
* **Modo Pantalla Completa (VJ)**: Botón para proyección directa en escenarios sin barras de navegación.

---

## 📦 Estructura del Repositorio

```text
├── bridges/                          <- Puentes libres (100% Sin Myo Connect)
│   ├── pyomyo/                       <- Módulo driver pyomyo integrado (ligero, sin bloat)
│   ├── bridge_pyomyo_dongle.py       <- Puente Dongle Oficial COM3 (pyomyo) -> OSC & WS
│   ├── bridge_bleak_bluetooth.py     <- Puente Bluetooth PC Nativo (Bleak) -> OSC & WS
│   ├── requirements.txt              <- Dependencias Python (pyserial, bleak)
│   ├── INSTALAR_DEPENDENCIAS_PYTHON.bat <- Instalador de dependencias pip
│   ├── INICIAR_DONGLE_PYOMYO.bat     <- Lanzador rápido Modo Dongle
│   ├── INICIAR_BLUETOOTH_BLEAK.bat   <- Lanzador rápido Modo Bluetooth PC
│   └── README_BRIDGES.md             <- Guía técnica detallada de puentes
├── drivers/                          <- Drivers y SDK oficial de Thalmic Labs
│   ├── INSTALAR_MYO_CONNECT.bat      <- Ensambla y ejecuta el instalador oficial
│   ├── Myo_Connect_Installer.part1   <- Fragmento binario 1 (52 MB)
│   ├── Myo_Connect_Installer.part2   <- Fragmento binario 2 (52 MB)
│   └── myo-sdk-win-0.9.0/           <- Myo SDK para Windows (C/C++ & docs)
├── Myo/
│   ├── public/
│   │   ├── index.html                <- Dashboard Web interactivo y modular
│   │   ├── style.css                 <- Estilos cyberpunk HUD y responsive grid
│   │   ├── app.js                    <- Controlador cliente (Audio, Shaders, 3D, WS)
│   │   └── libs/
│   │       ├── three.min.js          <- Three.js para renderizado 100% offline
│   │       └── myo.js                <- Librería cliente Myo para navegador
│   ├── server.js                     <- Servidor backend HTTP, WebSocket y sockets OSC UDP
│   ├── app.js                        <- Script de compatibilidad MyoOSC CLI
│   └── package.json                  <- Dependencias del backend
├── INICIAR_MYO_WEBAPP.bat            <- Lanzador de la WebApp para Windows (Doble clic)
├── INSTRUCCIONES_MYO_WEBAPP.md       <- Guía rápida de uso en español
├── package.json                      <- Configuración y scripts npm en la raíz
└── README.md                         <- Documentación principal del proyecto
```

---

## 🚀 Guía de Inicio Rápido

### Método A: Servidor WebApp Completo (Con Myo Connect)
1. **Instala Myo Connect**: Ejecuta [`drivers/INSTALAR_MYO_CONNECT.bat`](drivers/INSTALAR_MYO_CONNECT.bat).
2. Conecta el Dongle USB y sincroniza la pulsera (llevar la mano al pecho).
3. Haz doble clic en:
   👉 **[`INICIAR_MYO_WEBAPP.bat`](INICIAR_MYO_WEBAPP.bat)**
4. Se abrirá automáticamente tu navegador en **`http://localhost:3000`**.

---

### Método B: Con el Dongle Oficial USB pero SIN Myo Connect (`pyomyo`)
El dongle USB original que viene con la pulsera es un chip comercial estándar **Silicon Labs / Bluegiga BLED112** (`COM3`).
1. Instala las dependencias de Python ejecutando:
   👉 **[`bridges/INSTALAR_DEPENDENCIAS_PYTHON.bat`](bridges/INSTALAR_DEPENDENCIAS_PYTHON.bat)**
2. Asegúrate de que **Myo Connect esté cerrado**.
3. Haz doble clic en:
   👉 **[`bridges/INICIAR_DONGLE_PYOMYO.bat`](bridges/INICIAR_DONGLE_PYOMYO.bat)**
4. El script tomará control directo del puerto serie del dongle y comenzará a transmitir EMG crudo (200 Hz) y telemetría por OSC UDP hacia `127.0.0.1:22345`.

---

### Método C: Con el Bluetooth Integrado de la PC (SIN Dongle y SIN Myo Connect)
Si en el futuro extravías el Dongle USB o deseas usar tu laptop sin conectar ningún adaptador:
1. Instala las dependencias ejecutando [`bridges/INSTALAR_DEPENDENCIAS_PYTHON.bat`](bridges/INSTALAR_DEPENDENCIAS_PYTHON.bat).
2. **Desconecta el Dongle USB de la PC** (para que la pulsera no intente enlazarlo).
3. Enciende el Bluetooth de tu PC.
4. Mueve la pulsera Myo para activarla y haz doble clic en:
   👉 **[`bridges/INICIAR_BLUETOOTH_BLEAK.bat`](bridges/INICIAR_BLUETOOTH_BLEAK.bat)**
5. La librería `Bleak` se conectará a la pulsera mediante las características GATT de Windows WinRT y retransmitirá los datos por OSC a `127.0.0.1:22345`.

---

## 📡 Tabla de Direcciones y Protocolos OSC (UDP)

Todos los modos transmiten paquetes OSC UDP hacia **`127.0.0.1:22345`** y escuchan comandos en el puerto **`22346`** compatible con Ableton Live, TouchDesigner, Resolume, Max/MSP, Pure Data, etc.

| Dirección OSC | Tipo de Argumento | Descripción |
| :--- | :--- | :--- |
| `/myo/0/emg` | `[i, i, i, i, i, i, i, i]` | Arreglo de 8 enteros (-128 a 127) con los datos electromiográficos. |
| `/myo/0/roll` | `float` (radianes) | Inclinación de rotación del antebrazo. |
| `/myo/0/pitch` | `float` (radianes) | Elevación vertical del brazo (arriba/abajo). |
| `/myo/0/yaw` | `float` (radianes) | Giro horizontal de la muñeca. |
| `/myo/0/quaternion` | `[x, y, z, w]` | Cuaternión de orientación 3D normalizado. |
| `/myo/0/atForward` | `1` o `0` | Dispara 1 si el brazo apunta hacia adelante. |
| `/myo/0/atSky` | `1` o `0` | Dispara 1 si el brazo apunta hacia el cielo. |
| `/myo/0/atGround` | `1` o `0` | Dispara 1 si el brazo apunta hacia el suelo. |
| `/myo/0/fist` | `1` o `0` | Dispara 1 al cerrar el puño, 0 al relajarlo. |
| `/myo/0/wave_in` | `1` o `0` | Dispara 1 al realizar onda hacia adentro. |
| `/myo/0/wave_out` | `1` o `0` | Dispara 1 al realizar onda hacia afuera. |
| `/myo/0/fingers_spread`| `1` o `0` | Dispara 1 al abrir los dedos extendidos. |
| `/myo/0/pose` | `string` | Nombre del gesto activo (`"fist"`, `"wave_in"`, `"rest"`, etc.). |
| `/myo/0/hit` | `1` | Disparado cuando la aceleración angular supera 200°/s. |
| `/myo/0/accel` | `[x, y, z]` | Vector tridimensional de aceleración en Gs. |
| `/myo/0/gyro` | `[x, y, z]` | Vector tridimensional de velocidad angular (°/s). |
| `/myo/0/battery_level` | `float` | Porcentaje de batería restante (0 a 100). |
| `/myo/0/bluetooth_strength`| `float` | Fuerza de la señal RSSI en dBm. |

### Comandos OSC de Entrada (Puerto 22346)
Puedes enviar paquetes OSC desde software externo para controlar la pulsera:
* `/myo/vibrate "short" | "medium" | "long"`: Dispara vibración háptica en la pulsera.
* `/myo/zero`: Calibra la orientación actual como centro (*Tare*).
* `/myo/unlock`: Desbloquea la pulsera.
* `/myo/lock`: Bloquea la pulsera.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo [`LICENSE`](LICENSE) para más detalles.

Desarrollado para performances audiovisuales e interacción gestual en vivo con el Myo Armband.
