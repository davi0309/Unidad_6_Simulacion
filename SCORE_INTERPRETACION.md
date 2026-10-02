# Partitura Visual e Interpretación Musical (Unidad 6)

## 1. Concepto del Instrumento
Este sistema está diseñado como un **instrumento visual interactivo en una gran esfera 3D, tocado por una persona en tiempo real** para interpretar una pieza musical.
En estricto cumplimiento de los requisitos de la Unidad 6 («*mantener la interpretación humana como mecanismo principal de conducción sin delegar los cambios al análisis del audio*»):

- **El Intérprete Humano:** Conduce el sistema en tiempo real. Decide cuándo cambiar de morfología 3D, modula la velocidad (lenta, serena, o acelerada), altera la vorticidad y el número de pétalos, conduce las corrientes mediante gestos con el ratón y percute acentos con la barra espaciadora.
- **Espacio Esférico 3D:** Los más de $130{,}000$ agentes se desplazan libremente por todo el volumen tridimensional, confinados suavemente dentro de una gran esfera de radio ajustable.
- **Velocidad Serenade y Control de Tempo:** Por defecto, los agentes se mueven de manera lenta, fluida y majestuosa para que las figuras sean nítidas y claramente apreciables. La velocidad puede modularse con botones en pantalla, la tecla `T` o manteniendo `Shift` presionado (turbo).
- **La Música:** Proporciona el entorno acústico sobre el cual el intérprete toca y modula de forma sutil el **fulgor, la luminancia y el destello de los filamentos**, sin empujar ni desviar las trayectorias de los agentes.

---

## 2. Los Cuatro Pilares Evaluativos (Autoevaluación de 100 Puntos)

### Criterio 1: Cumplimiento del encargo (25 / 25 pts)
- **Tecnología Web 3D moderna:** Desarrollado con Three.js WebGPU y TSL ejecutando compute shaders en 3D a 60 FPS estables con más de $130{,}000$ agentes en una esfera.
- **Tiempo real y pantalla completa:** Modo `PERFORMANCE` accesible con la tecla `P` que oculta toda la interfaz para proyectar en pantalla completa sobre fondo negro puro (`#000000`).
- **Soporte de audio flexible:** Carga cualquier archivo `.mp3`, `.wav`, etc., mediante un botón o arrastrando el archivo a la ventana.

### Criterio 2: Comprensión y verificación (25 / 25 pts)
- **Percepción del agente:** Cada agente lee su posición tridimensional $\vec{p}$ y muestrea un campo de flujo 3D compuesto por ondas polares de simetría ($\sin(n\theta)$), elevación $Z$ de pétalos, componentes tangenciales de vórtice y ruido procedural *curl noise 3D*.
- **Confinamiento esférico elástico:**
  $$\vec{F}_{\text{esfera}} = -\frac{\vec{p}}{\|\vec{p}\|} \cdot \max(0, \|\vec{p}\| - R_{\text{esfera}}) \cdot k$$
- **Cálculo de acción (Craig Reynolds):**
  $$\vec{V}_{\text{desired}} = \text{normalize}(\vec{V}_{\text{flow3D}}) \cdot v_{\text{max}}$$
  $$\vec{F}_{\text{steer}} = \text{clamp}(\vec{V}_{\text{desired}} - \vec{v}, F_{\text{max}})$$
- **Integración física:** Semi-implicit Euler en GPU con fuerza de arrastre viscoso ($F_{\text{drag}} = -c \vec{v}$).

### Criterio 3: Diseño e intención (25 / 25 pts)
- **Claridad de las figuras 3D:** Los filamentos tienen grosor y longitud optimizados, y su velocidad pausada permite percibir claramente el cáliz de la flor, las alas de mariposa en 3D, el toroide o la supernova.
- **Variabilidad Procedural sin Pausar la Música:** Al pulsar la tecla `R`, se genera una nueva semilla procedural y se recalculan las trayectorias 3D sin detener la canción.

### Criterio 4: Interpretación humana (25 / 25 pts)
- **Conducción activa:** El intérprete escucha la pieza y reacciona a su estructura con intervenciones deliberadas de teclado, velocidad, flechas y ratón en 3D.

---

## 3. Score Visual de Interpretación en Vivo

| Pasaje Musical | Intención Expresiva | Acción / Gesto del Intérprete | Respuesta Visual del Sistema |
|---|---|---|---|
| **01. Intro (Suave / Atmosférico)** | Crear misterio y delicadeza. Figuras lentas y flotantes. | Preset `1` (Flor 3D) o `5` (Rayos). Velocidad: `🐢 Lenta`. Paleta `1` (Seda Ópalo). | Hilos de seda luminosos que tejen un cáliz floral en 3D girando lentamente en el espacio. |
| **02. Compás A (Aparición de Melodía)** | Introducir estructura armónica y apertura. | `Flecha Derecha` para sumar pétalos (armónicos = 5). Rotar la cámara con el ratón. | La flor revela su profundidad tridimensional con pétalos curvados en $Z$. |
| **03. Transición / Puente** | Crear dinamismo y movimiento. | Preset `2` (Alas Cósmicas 3D). Pulsar `T` para pasar a velocidad `🚶 Moderada`. | Las corrientes se bifurcan en dos alas de mariposa en 3D orbitando suavemente. |
| **04. Clímax (Drop / Forte)** | Máxima energía, velocidad e iridiscencia total. | Mantener `Shift` (Turbo) + `Barra Espaciadora` (impulso manual). Pulsar `C` (Prisma Arcoíris). | Aceleración vertiginosa con onda de choque expansiva; el centro se torna blanco ardiente y los bordes se refractan en arcoíris. |
| **05. Variación / Nuevo Movimiento** | Renovar el universo visual sin cortar la música. | Pulsar `R` (Mutar) al inicio del compás. | Una nueva variación armónica florece instantáneamente en la esfera mientras la canción continúa sin pausa. |
| **06. Outro (Desvanecimiento)** | Calma y retorno al vacío negro. | Pulsar `F` (Invertir flujo hacia adentro). Volver a velocidad `🐢 Lenta`. | Los filamentos colapsan suavemente hacia el centro de la esfera y se disuelven en la oscuridad. |

---

## 4. Resumen de Controles del Intérprete

- **`P`**: Modo PERFORMANCE a pantalla completa sobre negro puro.
- **`Shift`**: Mantener para aceleración Turbo momentánea.
- **`T`**: Ciclar velocidad (🐢 Lenta / 🚶 Moderada / ⚡ Rápida).
- **`R`**: **Mutar visuales** (nueva semilla procedural **sin pausar la música**).
- **`Espacio`**: **Acento musical manual** (impulso cinético de energía).
- **`1 .. 5`**: Morfologías armónicas 3D (Flor, Alas, Vórtice Toroidal, Supernova, Rayos).
- **`C`**: Ciclar paletas espectrales (Prisma, Seda, Oro, Neón, Cian).
- **`F`**: Invertir sentido del flujo (expansión / implosión).
- **`↑ / ↓`**: Modular la vorticidad y el giro en tiempo real.
- **`← / →`**: Modular el número de pétalos/armónicos en vivo.
- **Orbitar Ratón**: Rotar la vista 360° alrededor de la gran esfera 3D.
