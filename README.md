# Unidad 6 · Instrumento Visual de Agentes Autónomos y Flow Fields en Esfera 3D

Instrumento visual interactivo y generativo para la **interpretación musical en tiempo real por parte de una persona**, desarrollado con **Three.js WebGPU**, **TSL (Three Shading Language)** y la **Web Audio API**.

---

## 🌟 Filosofía y Novedades del Instrumento

- **Espacio Esférico 3D:** Los más de $130{,}000$ agentes se mueven por todo el volumen tridimensional, confinados elásticamente dentro de una gran esfera. Puedes orbitar en 360° con el ratón para apreciar la profundidad, los pliegues y las capas interiores.
- **Velocidad Serenade y Control de Tempo:** Por defecto, los filamentos se desplazan de manera más lenta y majestuosa, permitiendo apreciar nítidamente la geometría de las figuras (flores en copa, alas de mariposa, toroides y supernovas). Puedes cambiar de tempo al instante con los botones en pantalla, la tecla `T` o manteniendo presionada la tecla `Shift` para un turbo momentáneo.
- **Conducción 100% Humana:** La música no mueve ni deforma las partículas; toda la física y dirección de flujo es decidida en vivo por el intérprete.
- **Iluminación Reactiva por Audio:** El audio en segundo plano modula sutilmente el **fulgor, luminancia y destellos de color de los filamentos** sin intervenir en las trayectorias.
- **Variabilidad Procedural sin Pausar la Música (`R`):** Al presionar la tecla `R`, el sistema muta las semillas armónicas y reinicia los filamentos visuales sin detener ni reiniciar la reproducción de la canción.
- **Soporte Multi-Canción:** Permite cargar cualquier archivo `.mp3`, `.wav`, etc., mediante un botón en la interfaz o arrastrando y soltando el archivo sobre la ventana.

---

## 🚀 Requisitos y Puesta en Marcha

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   Abre en un navegador con WebGPU habilitado (Chrome, Edge o equivalente).

3. **Construcción para producción:**
   ```bash
   npm run build
   npm run preview
   ```

---

## 🎹 Controles de Interpretación en Vivo

| Tecla / Gesto | Acción | Descripción |
|---|---|---|
| **`P`** | LAB / PERFORMANCE | Oculta la interfaz para proyectar a pantalla completa sobre negro puro. |
| **`Shift`** | Turbo / Acelerar | Mantiene una velocidad aumentada mientras se presiona para clímax musicales. |
| **`T`** | Selector de Velocidad | Cicla entre Lenta (Defecto), Moderada y Rápida. |
| **`R`** | Mutar Visuales 3D | Genera nuevas semillas y trayectorias 3D sin reiniciar la música. |
| **`1 .. 5`** | Morfologías Armónicas 3D | 1: Flor de Seda, 2: Alas Cósmicas, 3: Vórtice Toroidal, 4: Supernova, 5: Rayos Helicoidales. |
| **`Espacio`** | Acento Manual de Energía | Impulso físico de energía para acentuar caídas rítmicas. |
| **`C`** | Ciclar Paleta | Alterna entre Prisma Arcoíris, Seda Ópalo, Sol Dorado, Neón Lavanda y Cian. |
| **`F`** | Invertir Flujo | Conmuta entre expansión centrífuga y absorción centrípeta. |
| **`↑ / ↓`** | Modular Giro 3D | Aumenta o disminuye la vorticidad del campo en tiempo real. |
| **`← / →`** | Modular Pétalos 3D | Agrega o quita lóbulos armónicos a la figura en vivo. |
| **Orbitar Ratón** | Vista 360° | Rota la cámara alrededor de la gran esfera 3D. |

---

## 📄 Documentación Complementaria

- [Partitura Visual e Interpretación Musical](SCORE_INTERPRETACION.md)
- [Guía del Estudiante](GUIA_ESTUDIANTE.md)
