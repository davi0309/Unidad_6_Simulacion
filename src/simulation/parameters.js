import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Uniforms expuestos a los compute shaders y materiales TSL en WebGPU
export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    elapsedTime: uniform(0.0), // Tiempo continuo para ondas planetarias y pulsaciones 3D

    // Velocidades: lentas, majestuosas y serenas
    initialSpeed: uniform(0.2),
    maxSpeed: uniform(1.6),            // Velocidad base suave
    speedMultiplier: uniform(1.0),     // Modulador dinámico (1.0 = Lenta, 1.8 = Normal, 2.8 = Rápida)

    // Esfera 3D contenedora
    sphereRadius: uniform(5.5),        // Radio amplio para que los agentes llenen todo el espacio 3D
    boundsSize: uniform(14.0),

    // Geometría y opacidad de los filamentos (Estética de Celuloide / Rayones de Película)
    lineWidth: uniform(0.022),         // Rayón fino
    lineLength: uniform(0.35),         // Rayitas cortas de celuloide / limaduras
    filamentAlpha: uniform(0.55),      // Densidad sin blanqueamiento
    filmGrain: uniform(0.28),          // Grano de película de 35mm (24 FPS)
    filmFlicker: uniform(0.20),        // Parpadeo sutil de lámpara de proyector

    // Dinámica de agentes autónomos (Craig Reynolds)
    steerStrength: uniform(6.5),       // Maniobra ágil y sensible
    dragCoefficient: uniform(0.05),

    // 1. EL FUELLE DEL ARMONIO (Barra Espaciadora: Inhalar / Exhalar)
    bellowsInhale: uniform(0.0),       // 0.0 = Exhalar / Expansión del campo -> 1.0 = Inhalar / Anillos apretados

    // 2. ACORDES DEL ÓRGANO (Fila Central A S D F G H J K)
    chordA: uniform(0.0),              // Acorde origen
    chordB: uniform(0.0),              // Acorde destino (0: G, 1: Bm, 2: C, 3: Cm, 4: G/B, 5: Em, 6: Cadd9, 7: Dsus4)
    chordMorph: uniform(1.0),          // 0.0 -> 1.0 transición lenta ("como un armonio llenándose de aire")
    chordWeight: uniform(1.0),         // 1.0 = Acordes de armonio activos, 0.0 = Arquetipos libres

    // Campo de flujo armónico 3D y arquetipos visuales
    shapeA: uniform(0.0),
    shapeB: uniform(0.0),
    shapeMorph: uniform(1.0),
    symmetryType: uniform(0.0),
    harmonics: uniform(4.0),
    swirl: uniform(1.4),
    curlStrength: uniform(0.45),
    petalMorph: uniform(1.3),
    flowDirection: uniform(1.0),

    // 3. LA VOZ (El mouse es la voz con ecos de reverberación)
    voicePos: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    voiceVel: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    voiceEcho1: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    voiceEcho2: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    voiceEcho3: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    voiceActive: uniform(0.0),         // 1.0 cuando la voz canta/se mueve
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    attractorStrength: uniform(0.0),
    userPulse: uniform(0.0),

    // 4. LAS ARPAS (Glissando barrido del 1 al 0)
    harpActive: uniform(0.0),          // 0.0 -> 1.0 cuerdas tensas vibrando
    harpWavePos: uniform(0.0),         // Posición de la onda viajera a lo largo de las cuerdas (-4.0 a +4.0)
    harpWaveDir: uniform(1.0),         // +1.0 (barrido 1->0) o -1.0 (barrido 0->1)

    // 5. EL FINAL CELESTIAL (Shift mantener: Gravedad Invertida + Physarum)
    celestialActive: uniform(0.0),     // 0.0 -> 1.0 al mantener Shift

    // 6. LOS CRÉDITOS Y EL SILENCIO (Enter)
    creditsActive: uniform(0.0),       // 0.0 -> 1.0 filamentos suben en renglones de celuloide
    codaSilence: uniform(0.0),         // 1.0 cuando la pantalla queda vacía con grano y parpadeo
    codaMotePulse: uniform(0.0),       // Motas de polvo tenues al tocar cualquier tecla en el silencio

    // Estética espectral y transición suave entre paletas
    paletteId: uniform(0.0),           // Paleta 0 por defecto: Azul Celuloide y Plata
    paletteA: uniform(0.0),
    paletteB: uniform(0.0),
    paletteMix: uniform(1.0),
    transitionDuration: uniform(20.0),
    chromaShift: uniform(0.0),
    dispersion: uniform(0.85),

    // Semilla procedural
    seed: uniform(3.14159)
  };
}
