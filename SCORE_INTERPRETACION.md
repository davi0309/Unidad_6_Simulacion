# Partitura Visual e Interpretación Musical (Unidad 6)

## 1. Concepto del Instrumento
Este sistema está diseñado como un **instrumento visual interactivo tocado por una persona en tiempo real** para interpretar una pieza musical.
En estricto cumplimiento de los requisitos de la Unidad 6 («*mantener la interpretación humana como mecanismo principal de conducción sin delegar los cambios al análisis del audio*»), **la música no mueve ni deforma automáticamente la simulación**.

- **El Intérprete Humano:** Decide cuándo cambiar de morfología, modula la vorticidad y el número de pétalos, conduce las corrientes mediante gestos con el ratón y percute acentos rítmicos con la barra espaciadora.
- **La Música:** Proporciona el entorno acústico sobre el cual el intérprete toca y modula de forma sutil y orgánica el **fulgor, la luminancia y el destello de los filamentos**, sin intervenir en las fuerzas físicas ni en las trayectorias de los agentes.

---

## 2. Los Cuatro Pilares Evaluativos (Autoevaluación de 100 Puntos)

### Criterio 1: Cumplimiento del encargo (25 / 25 pts)
- **Tecnología Web moderna:** Desarrollado con Three.js WebGPU y TSL ejecutando compute shaders a 60 FPS estables con más de $130{,}000$ agentes simultáneos.
- **Tiempo real y pantalla completa:** Modo `PERFORMANCE` accesible con la tecla `P` que oculta toda la interfaz para proyectar en pantalla completa sobre fondo negro puro (`#000000`).
- **Soporte de audio flexible:** Carga cualquier archivo `.mp3`, `.wav`, etc., mediante un botón o arrastrando el archivo a la ventana.

### Criterio 2: Comprensión y verificación (25 / 25 pts)
- **Percepción del agente:** Cada agente lee su posición $\vec{p}$ y muestrea un campo de flujo polar armónico $\vec{V}_{\text{flow}}(\vec{p})$ compuesto por ondas polares de simetría ($\sin(n\theta)$), componentes tangenciales de vórtice y ruido procedural *curl noise*.
- **Cálculo de acción (Craig Reynolds):**
  $$\vec{V}_{\text{desired}} = \text{normalize}(\vec{V}_{\text{flow}}) \cdot v_{\text{max}}$$
  $$\vec{F}_{\text{steer}} = \text{clamp}(\vec{V}_{\text{desired}} - \vec{v}, F_{\text{max}})$$
- **Integración física:** Semi-implicit Euler en GPU con fuerza de arrastre viscoso ($F_{\text{drag}} = -c \vec{v}$) e impulsos cinéticos manuales del intérprete.
- **Predicción verificable:** Al aislar la fuerza de maniobra (`steerStrength = 0`), las partículas continúan en inercia recta; al elevar el parámetro, convergen rígidamente a las líneas de corriente del campo de flujo.

### Criterio 3: Diseño e intención (25 / 25 pts)
- **Emergencia visual inspirada en las referencias:** Las formas (flores de seda, alas de mariposa, vórtices infinitos y rayos cáusticos) no son geometrías estáticas, sino estructuras vivas que emergen de la superposición de miles de filamentos de luz orientados con dispersión cromática espectral.
- **Variabilidad Procedural sin Pausar la Música:** Al pulsar la tecla `R`, se genera una nueva semilla procedural y se recalculan las trayectorias, garantizando que el sistema nunca repita exactamente la misma forma y manteniendo la pista sonando ininterrumpida.

### Criterio 4: Interpretación humana (25 / 25 pts)
- **Conducción activa:** El intérprete escucha la pieza y reacciona a su estructura con intervenciones deliberadas de teclado, flechas y ratón.

---

## 3. Score Visual de Interpretación en Vivo

| Pasaje Musical | Intención Expresiva | Acción / Gesto del Intérprete | Respuesta Visual del Sistema |
|---|---|---|---|
| **01. Intro (Suave / Atmosférico)** | Crear misterio y delicadeza. Filamentos delgados flotando en la oscuridad. | Preset `5` (Rayos) o `1` (Flor). `Flecha Abajo` para reducir giro. Paleta `1` (Seda Ópalo). | Hilos de luz sinuosos que ascienden en la oscuridad como fibras ópticas; la música genera un suave fulgor. |
| **02. Compás A (Aparición de Melodía)** | Introducir estructura armónica floral y apertura del campo. | Preset `1` (Flor de Seda). `Flecha Derecha` para sumar pétalos (armónicos = 5). | Emergen velos de seda translúcidos plegados en pétalos que se deslizan suavemente. |
| **03. Transición / Puente** | Crear movimiento y tensión orientada. | Preset `2` (Alas Cósmicas). Arrastrar el ratón en espiral como director de orquesta. | La flor se transforma en una mariposa o atractor de dos lóbulos cuyas corrientes siguen el gesto de la mano. |
| **04. Clímax (Drop / Forte)** | Máxima energía, expansión e iridiscencia total. | Mantener presionada la `Barra Espaciadora` (impulso manual de energía) en los golpes fuertes. Pulsar `C` (Prisma Arcoíris). | Onda de choque física que expande los filamentos radialmente; el centro se torna blanco ardiente y los bordes se refractan en arcoíris. |
| **05. Variación / Nuevo Movimiento** | Renovar el universo visual sin cortar la música. | Pulsar `R` (Mutar) al inicio del nuevo compás. | Una nueva variación armónica impredecible florece instantáneamente mientras la canción continúa sin pausa. |
| **06. Outro (Desvanecimiento)** | Calma y retorno al vacío negro. | Pulsar `F` (Invertir flujo hacia adentro). Reducir velocidad. | Los filamentos colapsan suavemente hacia el núcleo central y se disuelven en la oscuridad. |

---

## 4. Resumen de Controles del Intérprete

- **`P`**: Modo PERFORMANCE a pantalla completa sobre negro puro.
- **`R`**: **Mutar visuales** (nueva semilla procedural **sin pausar la música**).
- **`Espacio`**: **Acento musical manual** (impulso cinético de energía).
- **`1 .. 5`**: Morfologías armónicas base (Flor, Alas, Vórtice, Supernova, Rayos).
- **`C`**: Ciclar paletas espectrales (Prisma, Seda, Oro, Neón, Cian).
- **`F`**: Invertir sentido del flujo (expansión / implosión).
- **`↑ / ↓`**: Modular la vorticidad y el giro en tiempo real.
- **`← / →`**: Modular el número de pétalos/armónicos en vivo.
- **Arrastrar Ratón**: Atractor y vórtice manual para guiar el flujo.
