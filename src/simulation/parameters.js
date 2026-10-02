import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Uniforms expuestos a los compute shaders y materiales TSL en WebGPU
export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),

    // Velocidades: por defecto más lentas, serenas y majestuosas
    initialSpeed: uniform(0.18),
    maxSpeed: uniform(1.8),            // Velocidad base lenta para apreciar las formas
    speedMultiplier: uniform(1.0),     // Modulador dinámico (1.0 = Lenta, 1.8 = Normal, 3.0 = Rápida)

    // Esfera 3D contenedora
    sphereRadius: uniform(5.2),        // Radio de la gran esfera 3D donde habitan los agentes
    boundsSize: uniform(14.0),

    // Dimensiones de los filamentos luminosos (más visibles y definidos)
    lineWidth: uniform(0.024),         // Grosor mayor para máxima nitidez de figura
    lineLength: uniform(0.48),         // Longitud de filamento extendida

    // Dinámica de agentes autónomos y conducción (Craig Reynolds)
    steerStrength: uniform(8.5),       // Mayor fuerza de maniobra para figuras muy nítidas
    dragCoefficient: uniform(0.08),

    // Campo de flujo armónico 3D
    harmonics: uniform(4.0),           // Número de pétalos / orden armónico 3D
    symmetryType: uniform(0.0),        // 0: Flor 3D, 1: Alas/Mariposa 3D, 2: Vórtice Toroidal 3D, 3: Supernova 3D, 4: Rayos
    swirl: uniform(1.2),               // Vorticidad y giro 3D
    curlStrength: uniform(0.55),       // Turbulencia curl suave
    petalMorph: uniform(1.2),          // Definición y curvatura de los pétalos 3D
    flowDirection: uniform(1.0),       // 1.0 hacia afuera, -1.0 hacia adentro

    // Conducción del intérprete
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    attractorStrength: uniform(0.0),   // Fuerza del conductor con el ratón
    userPulse: uniform(0.0),           // Acento manual (Espacio)

    // Audio: modula únicamente iluminación y fulgor
    audioGlow: uniform(0.0),
    audioShimmer: uniform(0.0),

    // Estética espectral y dispersión cromática (efecto prisma)
    paletteId: uniform(0.0),
    chromaShift: uniform(0.0),
    dispersion: uniform(0.85),

    // Semilla procedural
    seed: uniform(3.14159)
  };
}
