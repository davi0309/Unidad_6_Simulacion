# Unidad 6 · Instrumento Visual de Agentes Autónomos y Flow Fields

Instrumento visual interactivo y generativo para la **interpretación musical en tiempo real por parte de una persona**, desarrollado con **Three.js WebGPU**, **TSL (Three Shading Language)** y la **Web Audio API**.

---

## 🌟 Filosofía del Instrumento

El sistema está concebido para ser **tocado e interpretado en vivo por una persona**:
- **Conducción 100% Humana:** La música **no** mueve ni calcula de manera autónoma las fuerzas del sistema. Toda la física, dirección de flujos, selección de formas y acentos cinéticos son guiados por la persona mediante el teclado y el ratón.
- **Iluminación Reactiva por Audio:** La canción que se reproduce en segundo plano actúa como el lienzo sonoro, modulando sutilmente el **fulgor, luminancia y destellos de color de los filamentos** sin intervenir en las trayectorias de las partículas.
- **Filamentos Orientados con Dispersión Cromática:** Cada uno de los más de $130{,}000$ agentes se renderiza como una línea de luz orientada en la dirección de su velocidad instantánea ($\operatorname{atan2}(v_y, v_x)$) con mezcla aditiva y refracción espectral sobre fondo negro absoluto (`#000000`).
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
| **`R`** | Mutar Visuales | Genera nuevas semillas y trayectorias sin reiniciar la música. |
| **`1 .. 5`** | Morfologías Armónicas | 1: Flor de Seda, 2: Alas Cósmicas, 3: Vórtice Infinito, 4: Supernova, 5: Rayos Cáusticos. |
| **`Espacio`** | Acento Manual de Energía | Impulso físico de energía para acentuar caídas rítmicas y clímax. |
| **`C`** | Ciclar Paleta | Alterna entre Prisma Arcoíris, Seda Ópalo, Sol Dorado, Neón Lavanda y Cian. |
| **`F`** | Invertir Flujo | Conmuta entre expansión centrífuga y absorción centrípeta. |
| **`↑ / ↓`** | Modular Giro | Aumenta o disminuye la vorticidad del campo en tiempo real. |
| **`← / →`** | Modular Pétalos | Agrega o quita lóbulos armónicos a la figura en vivo. |
| **Arrastrar Ratón** | Conducir Corrientes | Actúa como un atractor/vórtice manual sobre el campo de flujo. |

---

## 📄 Documentación Complementaria

- [Partitura Visual e Interpretación Musical](SCORE_INTERPRETACION.md)
- [Guía del Estudiante](GUIA_ESTUDIANTE.md)
