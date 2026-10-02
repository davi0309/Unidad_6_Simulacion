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

    // Cobertura total de la pantalla (Full-screen canvas)
    sphereRadius: uniform(8.5),        // Radio ampliado para cubrir la pantalla de esquina a esquina
    boundsSize: uniform(20.0),

    // Reactividad a la música (Audio-reactivity)
    audioBass: uniform(0.0),           // Graves / Bombo (modula dilatación y pulsos radiales)
    audioMid: uniform(0.0),            // Medios / Voz / Melodía (modula pliegues y frondas)
    audioTreble: uniform(0.0),         // Agudos / Platos (modula micro-vibraciones y crenelaciones)
    audioEnergy: uniform(0.0),         // Energía RMS global

    // Geometría y opacidad de los filamentos (Colores vivos sobre fondo negro)
    lineWidth: uniform(0.024),         // Líneas finas y nítidas
    lineLength: uniform(0.38),         // Longitud de filamento
    filamentAlpha: uniform(0.55),      // Opacidad calibrada para colores vivos sin blanquear

    // Dinámica de agentes autónomos (Craig Reynolds + Jeff Jones Physarum)
    steerStrength: uniform(6.5),       // Maniobra ágil para responder a las morfologías
    dragCoefficient: uniform(0.04),

    // Campo de flujo armónico 3D y transición de fuerzas entre los 5 arquetipos
    shapeA: uniform(0.0),              // Arquetipo origen
    shapeB: uniform(0.0),              // Arquetipo destino (0: Red Celular, 1: Iris, 2: Coral, 3: Helecho, 4: 36 Points)
    shapeMorph: uniform(1.0),          // 0.0 (100% Campo A) -> 1.0 (100% Campo B)
    symmetryType: uniform(0.0),
    harmonics: uniform(4.0),           // Orden armónico
    swirl: uniform(1.4),               // Giro armónico
    curlStrength: uniform(0.35),       // Ruido curl
    petalMorph: uniform(1.3),          // Amplitud de pliegues
    flowDirection: uniform(1.0),       // 1.0 hacia afuera, -1.0 hacia adentro

    // Conducción del intérprete
    attractor: uniform(new THREE.Vector3(0.0, 0.0, 0.0)),
    attractorStrength: uniform(0.0),   // Fuerza del conductor con el ratón
    userPulse: uniform(0.0),           // Acento manual (Espacio)

    // Paletas cromáticas de referencia (0: Cyan celular, 1: Iris ardiente, 2: Coral teal, 3: Helecho menta, 4: RGB split)
    paletteId: uniform(0.0),           // Paleta activa por defecto
    paletteA: uniform(0.0),
    paletteB: uniform(0.0),
    paletteMix: uniform(1.0),
    transitionDuration: uniform(4.5),  // 4.5 segundos para transición suave entre visuales
    chromaShift: uniform(0.0),         // Desplazamiento cromático sutil
    dispersion: uniform(0.85),

    // Semilla procedural
    seed: uniform(3.14159)
  };
}
