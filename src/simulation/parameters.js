import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';

// Uniforms expuestos a los compute shaders y materiales TSL en WebGPU
export function createParameters() {
  return {
    dt: uniform(1 / 60),
    timeScale: uniform(1.0),

    // Velocidades: lentas, majestuosas y serenas
    initialSpeed: uniform(0.2),
    maxSpeed: uniform(1.6),            // Velocidad base suave
    speedMultiplier: uniform(1.0),     // Modulador dinámico (1.0 = Lenta, 1.8 = Normal, 2.8 = Rápida)

    // Esfera 3D contenedora
    sphereRadius: uniform(5.5),        // Radio amplio para que los agentes llenen todo el espacio 3D
    boundsSize: uniform(14.0),

    // Geometría y opacidad de los filamentos (Colores vivos sobre fondo negro)
    lineWidth: uniform(0.024),         // Líneas finas y nítidas
    lineLength: uniform(0.42),         // Longitud de filamento
    filamentAlpha: uniform(0.45),      // Opacidad translúcida calibrada para colores vivos sin blanquear

    // Dinámica de agentes autónomos (Craig Reynolds)
    steerStrength: uniform(5.2),       // Maniobra fluida orgánica
    dragCoefficient: uniform(0.05),

    // Campo de flujo armónico 3D
    harmonics: uniform(5.0),           // 5 pétalos / orden armónico 3D
    symmetryType: uniform(0.0),        // 0: Flor 3D, 1: Alas/Mariposa 3D, 2: Toroide 3D, 3: Supernova 3D, 4: Rayos
    swirl: uniform(1.1),               // Giro armónico
    curlStrength: uniform(0.85),       // Ruido curl 3D amplio para movimientos orgánicos
    petalMorph: uniform(1.3),          // Amplitud de pétalos/alas 3D
    flowDirection: uniform(1.0),       // 1.0 hacia afuera, -1.0 hacia adentro

    // Conducción del intérprete
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    attractorStrength: uniform(0.0),   // Fuerza del conductor con el ratón
    userPulse: uniform(0.0),           // Acento manual (Espacio)

    // Estética espectral y transición suave entre paletas
    paletteId: uniform(4.0),           // Paleta activa / objetivo
    paletteA: uniform(4.0),            // Paleta origen en la transición
    paletteB: uniform(4.0),            // Paleta destino en la transición
    paletteMix: uniform(1.0),          // 0.0 (Paleta A) -> 1.0 (Paleta B), interpolación suave
    transitionDuration: uniform(20.0),  // Duración en segundos de la transición gradual (20s por defecto)
    chromaShift: uniform(0.0),         // Desplazamiento cromático continuo (deriva lenta orgánica)
    dispersion: uniform(0.85),

    // Semilla procedural
    seed: uniform(3.14159)
  };
}
