# Guía Completa: Myo Armband Performance Suite

Esta aplicación integra la pulsera **Thalmic Myo Armband** en una suite de performance audiovisual interactiva en tiempo real compuesta por:
1. **Telemetría & Puente OSC**: Visualizador 3D, osciloscopios EMG de 8 canales, matriz de gestos y enrutador UDP OSC.
2. **Control Sonoro & Armónicos**: Sintetizador aditivo polifónico en Web Audio API, osciloscopio Lissajous XY, analizador FFT y arpegiador melódico cuantizado por gestos.
3. **Shaders GLSL & Visuales 3D**: Motor WebGL con shaders de fragmentos, 25.000 partículas cuánticas reactivas a cuaterniones, cintas geométricas minimalistas y modo Pantalla Completa para proyección VJ.

---

## 🚀 Inicio Rápido

1. Mantén **Myo Connect** abierto en segundo plano con el dongle USB conectado y la pulsera colocada y sincronizada en el antebrazo.
2. Haz doble clic en:
   👉 **[`INICIAR_MYO_WEBAPP.bat`](file:///c:/Users/tolch/Desktop/Helix_Perfo/INICIAR_MYO_WEBAPP.bat)**
3. Tu navegador se abrirá en:
   🌐 **`http://localhost:3000`**

---

## 📑 Pestañas de la Suite

### 1. 📊 Pestaña: Telemetría & Puente OSC
* **Visualizador 3D**: Representación del antebrazo y los 8 pods de la pulsera rotando en tiempo real con cuaterniones.
* **Osciloscopio EMG (200 Hz)**: 8 canales independientes que grafican el voltaje muscular (-128 a +127), acompañados de un mapa de calor radial.
* **Matriz de Gestos**: Detección visual con resplandor para: *Rest*, *Fist*, *Wave In*, *Wave Out*, *Fingers Spread*, *Double Tap*.
* **Puente OSC UDP**: Envío por defecto a `127.0.0.1:22345` y recepción en puerto `22346` para software como Ableton Live, Resolume Arena, TouchDesigner y Max/MSP.

---

### 2. 🎵 Pestaña: Control Sonoro & Armónicos
Para comenzar a escuchar el sonido, haz clic en el botón superior:
👉 **`🔊 ACTIVAR MOTOR DE AUDIO`**

#### Modos de Síntesis:
1. **Oscilador Armónico Continuo (Theremin / Dron)**: Deslizamiento continuo de frecuencia (*glissando*) según la inclinación vertical del brazo.
2. **Arpegiador Melódico Cuantizado**: Cuantiza el tono a escalas musicales tradicionales y exóticas:
   * *Pentatónica Menor*
   * *Dórica Mística*
   * *Japonesa Hirajoshi*
   * *Frigia Dominante*
   * *Mayor Espacial*
   * *Cromática Libre*
3. **Polifonía Gestual & Acordes**: Disparo de acordes, saltos de octava y congelamiento armónico mediante poses.

#### Mapeo de Control en Vivo:
* **PITCH (Inclinación ↑↓)**: Altura melódica / frecuencia fundamental (Hz).
* **ROLL (Giro de Muñeca ↺↻)**: Abre y mezcla el banco de **6 armónicos aditivos** (1× Fundamental, 2× Octava, 3× Quinta, 4× Segunda Octava, 5× Tercera Mayor, 6× Tercera Octava).
* **GIROSCOPIO / VELOCIDAD**: Controla la resonancia Q del filtro y añade vibrato dinámico a movimientos rápidos.
* **EMG (Fuerza muscular)**: Abre dinámicamente el **Filtro Resonante Lowpass** de 200 Hz hasta 12.000 Hz a medida que tensionas el antebrazo.
* **GESTOS (Poses)**:
  * ✊ **Fist**: *Hold Freeze* / Congela la nota activa con alta resonancia sostenida.
  * 👈 **Wave In**: Salto de arpegio hacia notas graves (↓).
  * 👉 **Wave Out**: Salto de arpegio hacia notas agudas (↑).
  * 🖐️ **Fingers Spread**: Disparo de ráfaga de reverberación espacial (*Shimmer Delay*).
  * ✌️ **Double Tap**: Disparo de pulso percusivo sintético.
  * ✋ **Rest**: Caída suave a pad de ambiente.
* **Visualizadores de Audio**:
  * **Fase Lissajous XY**: Dibuja figuras armónicas sinusoidales en 2D que reflejan la correlación de fase y sobretonos.
  * **Espectro FFT & Forma de Onda**: Gráfico en tiempo real de 64 bandas espectrales.

---

### 3. 🌌 Pestaña: Shaders GLSL & Visuales 3D
Diseñado para presentaciones visuales y proyecciones en vivo (VJ).

#### Presets Visuales Incluidos:
1. 🌌 **Campo de Partículas Cuánticas (Swarm / Vortex)**:
   * 25.000 partículas en el espacio tridimensional.
   * La nube sigue la orientación exacta del brazo sin desfase.
   * La velocidad del giroscopio genera turbulencia y vórtices.
   * La fuerza muscular (EMG) expande y hace estallar las partículas radialmente en ondas de choque.
2. 🌊 **Shader GLSL Fluido & Plasma Raymarching**:
   * Shader de fragmentos GLSL puro con cálculo de ruido simplex 2D en tiempo real.
   * El ángulo de rotación de la pulsera orienta el flujo del plasma.
   * Los movimientos bruscos de impacto (*hit*) crean aberración cromática y ondas de distorsión líquida.
3. 📐 **Cintas Geométricas & Grid Minimal 3D**:
   * Anillos concéntricos de Lissajous con estética cyberpunk / blueprint que se torsionan con la rotación del brazo.
4. 🔮 **Esfera de Deformación Muscular (4D Noise)**:
   * Malla icosaédrica 3D cuyos vértices respiran y se deforman proporcionalmente a la tensión de los 8 canales EMG.

#### Paletas de Color:
* *Cyberpunk Neon* (Cyan & Magenta)
* *Aurora Boreal* (Verde Esmeralda & Azul Glaciar)
* *Fuego Solar* (Oro & Ámbar)
* *Monocromo Minimal* (Blanco & Carbón)
* *Deep Void* (Violeta Ultravioleta)

#### Modo Pantalla Completa:
Haz clic en **`🖥️ Pantalla Completa (VJ)`** en la barra de herramientas para ocultar la interfaz web y cubrir toda la pantalla o proyector.

---

## 📡 Tabla de Direcciones OSC

| Dirección OSC | Tipo | Descripción |
| :--- | :--- | :--- |
| `/myo/0/emg` | `[i, i, i, i, i, i, i, i]` | Arreglo de 8 enteros con tensión muscular (-128 a 127). |
| `/myo/0/roll`, `/myo/0/pitch`, `/myo/0/yaw` | `float` | Ángulos de Euler de rotación del brazo. |
| `/myo/0/quaternion` | `[x, y, z, w]` | Cuaternión de orientación espacial 3D. |
| `/myo/0/pose` | `string` | Nombre de la pose activa (`"fist"`, `"wave_in"`, etc.). |
| `/myo/0/hit` | `1` | Disparado en movimientos bruscos o impactos (>200°/s). |
| `/myo/0/accel`, `/myo/0/gyro` | `[x, y, z]` | Vectores de acelerómetro y giroscopio. |
