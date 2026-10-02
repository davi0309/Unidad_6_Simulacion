import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Uniforms expuestos a los compute shaders y materiales TSL en WebGPU
export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),
    initialSpeed: uniform(0.4),
    maxSpeed: uniform(4.8),
    boundsSize: uniform(14.0),

    // Dimensiones de los filamentos luminosos
    lineWidth: uniform(0.016),
    lineLength: uniform(0.32),
    particleSize: uniform(0.02),

    // Dinámica de agentes autónomos y conducción humana (Craig Reynolds)
    steerStrength: uniform(6.5),
    dragCoefficient: uniform(0.06),

    // Campo de flujo armónico (modulado por el intérprete en vivo)
    harmonics: uniform(4.0),           // Número de pétalos / orden armónico (3, 4, 5, 6, 7...)
    symmetryType: uniform(0.0),        // 0: Flor/Pétalos, 1: Alas/Mariposa, 2: Vórtice Infinito, 3: Supernova, 4: Rayos
    swirl: uniform(1.3),               // Vorticidad tangencial
    curlStrength: uniform(0.7),        // Turbulencia orgánica curl noise
    petalMorph: uniform(0.85),         // Grado de repliegue de pétalos
    flowDirection: uniform(1.0),       // 1.0 hacia afuera, -1.0 hacia adentro

    // Conducción e interacción del intérprete
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    attractorStrength: uniform(0.0),   // Fuerza del conductor con el ratón
    userPulse: uniform(0.0),           // Acento manual del intérprete (Espacio)

    // Audio: ÚNICAMENTE modula brillo y destello cromático (NO afecta el movimiento)
    audioGlow: uniform(0.0),           // Brillo/luminosidad de los filamentos por el sonido
    audioShimmer: uniform(0.0),        // Destello/iridiscencia cromática sutil

    // Estética espectral y dispersión cromática (efecto prisma de las referencias)
    paletteId: uniform(0.0),           // 0: Prisma Espectral, 1: Seda Ópalo, 2: Sol Dorado, 3: Mariposa Neón, 4: Azul Cian
    chromaShift: uniform(0.0),
    dispersion: uniform(0.85),

    // Semilla procedural (cambia al presionar R para resultados siempre únicos)
    seed: uniform(3.14159)
  };
}
