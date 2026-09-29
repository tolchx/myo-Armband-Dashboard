# 🦾 Myo Armband Performance Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![WebGL](https://img.shields.io/badge/Three.js-WebGL-cyan.svg)](https://threejs.org/)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Synthesizer-purple.svg)](https://developer.mozilla.org/es/docs/Web/API/Web_Audio_API)
[![OSC](https://img.shields.io/badge/OSC-UDP%20Bridge-orange.svg)](http://opensoundcontrol.org/)

Suite integral de software interactivo para la pulsera **Thalmic Labs Myo Armband**. Permite capturar, visualizar y traducir en tiempo real la actividad electromiográfica (EMG de 8 canales), la orientación espacial (IMU cuaterniones/ángulos de Euler) y el reconocimiento de gestos hacia:
1. **Telemetría & Puente OSC**: Enrutador OSC UDP bidireccional para DAWs y software de visuales (Ableton Live, TouchDesigner, Resolume, Max/MSP, Pure Data, Unreal Engine).
2. **Control Sonoro & Armónicos**: Sintetizador aditivo polifónico en Web Audio API, osciloscopio Lissajous XY, analizador FFT y arpegiador melódico cuantizado por gestos y giroscopio.
3. **Shaders GLSL & Visuales 3D**: Motor de visuales reactivos WebGL con 25.000 partículas cuánticas, shaders GLSL de fluidos orgánicos y modo Pantalla Completa para shows en vivo (VJ).

---

## 📸 Módulos Principales de la WebApp

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
├── bridges/
│   ├── pyomyo/                       <- Módulo pyomyo ligero (driver BLED112 sin bloat)
│   ├── bridge_pyomyo_dongle.py       <- Puente Dongle Oficial (100% Sin Myo Connect)
│   ├── bridge_bleak_bluetooth.py     <- Puente Bluetooth PC (Sin Dongle y Sin Myo Connect)
│   ├── requirements.txt              <- Dependencias Python (pyserial, bleak)
│   ├── INSTALAR_DEPENDENCIAS_PYTHON.bat
│   ├── INICIAR_DONGLE_PYOMYO.bat
│   ├── INICIAR_BLUETOOTH_BLEAK.bat
│   └── README_BRIDGES.md             <- Guía técnica de los puentes libres
├── drivers/
│   ├── INSTALAR_MYO_CONNECT.bat      <- Ensambla y ejecuta el instalador oficial
│   ├── Myo_Connect_Installer.part1   <- Fragmento 1 (52 MB)
│   ├── Myo_Connect_Installer.part2   <- Fragmento 2 (52 MB)
│   └── myo-sdk-win-0.9.0/           <- Thalmic Labs Myo SDK para Windows (C/C++ & docs)
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
├── INICIAR_MYO_WEBAPP.bat            <- Lanzador automático para Windows (Doble clic)
├── INSTRUCCIONES_MYO_WEBAPP.md       <- Guía rápida de uso en español
├── package.json                      <- Configuración y scripts npm en la raíz
└── README.md                         <- Documentación principal del proyecto
```

---

## 🔌 Alternativas 100% Libres (Sin Myo Connect)

Si no deseas utilizar el software oficial *Myo Connect* o si en el futuro pierdes el Dongle USB, el directorio [`bridges/`](bridges/) incluye dos alternativas completas:

1. **Modo Dongle Oficial BLED112 (`pyomyo`)**:
   * Controla el dongle USB oficial directamente a través del puerto serie COM (`COM3`) con el protocolo binario BGAPI.
   * Ejecuta: 👉 **[`bridges/INICIAR_DONGLE_PYOMYO.bat`](bridges/INICIAR_DONGLE_PYOMYO.bat)**.
2. **Modo Bluetooth Integrado PC (`Bleak`)**:
   * Se conecta a la pulsera mediante el Bluetooth 4.0+ propio de tu computadora, **sin necesidad del dongle USB**.
   * Ejecuta: 👉 **[`bridges/INICIAR_BLUETOOTH_BLEAK.bat`](bridges/INICIAR_BLUETOOTH_BLEAK.bat)**.

Consulta la guía técnica en [**`bridges/README_BRIDGES.md`**](bridges/README_BRIDGES.md) para más detalles.

---

## ⚙️ Instalación y Requisitos

### Requisitos de Hardware
* **Pulsera Thalmic Myo Armband**.
* **Dongle USB Bluetooth original de Myo**.
* Sistema operativo **Windows 10 / 11** (o macOS / Linux compatible con Myo Connect).

### Paso 1: Instalar el Driver Myo Connect
Para que la pulsera se comunique con la computadora, es indispensable tener en ejecución **Myo Connect**:
* Ejecuta el instalador incluido en este repositorio:
  📂 `drivers/Myo+Connect+Installer.exe`
* *(Enlace de respaldo externo: [Myo Connect Installer v1.0.4 en GitHub Releases](https://github.com/NiklasRosenstein/myo-python/releases/download/v1.0.4/Myo+Connect+Installer.exe))*.
* Conecta el dongle USB oficial, abre **Myo Connect**, colócate la pulsera en el antebrazo y realiza el gesto de sincronización (llevar la mano al pecho).

### Paso 2: Instalar Dependencias de Node.js
Requiere [Node.js](https://nodejs.org/) (versión 18 o superior):
```bash
git clone https://github.com/tolchx/myo-Armband-Dashboard.git
cd myo-Armband-Dashboard
npm install
```

---

## 🚀 Cómo Iniciar la WebApp

### Opción A (Recomendada en Windows):
Haz doble clic en el archivo:
👉 **`INICIAR_MYO_WEBAPP.bat`**

El script verificará que Myo Connect esté corriendo, levantará el servidor Node.js y abrirá automáticamente tu navegador en **`http://localhost:3000`**.

### Opción B (Línea de Comandos):
```bash
npm start
```
Luego visita `http://localhost:3000` en tu navegador.

---

## 📡 Tabla de Direcciones y Protocolos OSC (UDP)

Por defecto, la suite transmite paquetes OSC hacia `127.0.0.1:22345` y escucha comandos en el puerto `22346`.

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

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.

Desarrollado para performances audiovisuales e interacción gestual en vivo con el Myo Armband.
