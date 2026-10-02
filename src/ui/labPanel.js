/**
 * labPanel.js
 * Panel interactivo para el Instrumento Visual de la Unidad 6.
 * El intérprete conduce el sistema en vivo mientras la música aporta brillo y fulgor sutil.
 */

function rangeRow(parent, label, object, key, min, max, step, onInput, getValue) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  const name = document.createElement('span');
  const value = document.createElement('span');
  value.className = 'value';
  name.textContent = label;
  lab.append(name, value);
  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(object[key]);
  const refresh = () => {
    object[key] = Number(input.value);
    value.textContent = Number(input.value).toFixed(step < 0.01 ? 3 : (step < 0.1 ? 2 : 1));
    onInput?.(object[key]);
  };
  input.addEventListener('input', refresh);
  refresh();
  wrap.append(lab, input);
  parent.append(wrap);
  return {
    input,
    refresh() {
      if (getValue) {
        const next = Number(getValue());
        object[key] = next;
        input.value = String(next);
        value.textContent = next.toFixed(step < 0.01 ? 3 : (step < 0.1 ? 2 : 1));
      }
    }
  };
}

function selectRow(parent, label, options, initial, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const lab = document.createElement('label');
  lab.textContent = label;
  const sel = document.createElement('select');
  options.forEach((opt, idx) => {
    const el = document.createElement('option');
    el.value = String(idx);
    el.textContent = opt;
    if (idx === initial) el.selected = true;
    sel.append(el);
  });
  sel.addEventListener('change', () => onChange(Number(sel.value)));
  wrap.append(lab, sel);
  parent.append(wrap);
  return sel;
}

function button(parent, label, onClick, className = '') {
  const b = document.createElement('button');
  b.textContent = label;
  if (className) b.className = className;
  b.addEventListener('click', onClick);
  parent.append(b);
  return b;
}

export function createLabPanel({
  params,
  audioManager,
  onResetVisuals,
  onApplyPreset,
  onModeChange
}) {
  const refreshers = [];
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>U6 · Instrumento Visual de Agentes</h1>
    <p>Tú interpretas la pieza en tiempo real; la música aporta fulgor y brillo.</p>
  `;

  // SECCIÓN 1: REPRODUCTOR DE MÚSICA Y VÚMETROS DE BRILLO --------------------
  const audioGroup = document.createElement('div');
  audioGroup.className = 'group audio-group';
  audioGroup.innerHTML = '<h2>Música de Acompañamiento</h2><p>El sonido ilumina los filamentos. Tú conduces el movimiento.</p>';

  const trackInfo = document.createElement('div');
  trackInfo.className = 'track-info';
  trackInfo.textContent = `🎵 ${audioManager.getCurrentTrackName()}`;
  audioManager.onTrackChange((name) => {
    trackInfo.textContent = `🎵 ${name}`;
  });
  audioGroup.append(trackInfo);

  // Botones de Play/Pausa y Carga de archivo
  const audioControls = document.createElement('div');
  audioControls.className = 'button-row';

  const playBtn = document.createElement('button');
  playBtn.className = 'primary-btn';
  playBtn.textContent = '▶ Reproducir';
  playBtn.addEventListener('click', () => {
    const playing = audioManager.togglePlay();
    playBtn.textContent = playing ? '⏸ Pausar' : '▶ Reproducir';
    playBtn.classList.toggle('active', playing);
  });

  const fileLabel = document.createElement('label');
  fileLabel.className = 'file-btn';
  fileLabel.innerHTML = '📂 Cargar canción (.mp3)';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'audio/*';
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      audioManager.loadAudioFile(e.target.files[0]);
      playBtn.textContent = '⏸ Pausar';
      playBtn.classList.add('active');
    }
  });
  fileLabel.append(fileInput);

  audioControls.append(playBtn, fileLabel);
  audioGroup.append(audioControls);

  // Vúmetros de reactividad visual (brillo y destello)
  const vuWrap = document.createElement('div');
  vuWrap.className = 'vu-wrap';
  vuWrap.innerHTML = `
    <div class="vu-bar"><div class="vu-fill" id="vu-bass"></div><span>Fulgor</span></div>
    <div class="vu-bar"><div class="vu-fill" id="vu-mid"></div><span>Medios</span></div>
    <div class="vu-bar"><div class="vu-fill" id="vu-treble"></div><span>Destello</span></div>
    <div class="vu-bar"><div class="vu-fill" id="vu-pulse"></div><span>Brillo</span></div>
  `;
  audioGroup.append(vuWrap);

  const vuBass = vuWrap.querySelector('#vu-bass');
  const vuMid = vuWrap.querySelector('#vu-mid');
  const vuTreble = vuWrap.querySelector('#vu-treble');
  const vuPulse = vuWrap.querySelector('#vu-pulse');

  panel.append(audioGroup);

  // SECCIÓN 2: ARQUETIPOS GENERATIVOS (INSPIRACIÓN IMÁGENES 1-10) -----------
  const presetGroup = document.createElement('div');
  presetGroup.className = 'group';
  presetGroup.innerHTML = '<h2>Formas Armónicas del Instrumento</h2><p>Morfologías base para interpretar diferentes secciones:</p>';

  const presets = [
    { id: 'silkFlower', label: '🌸 Flor de Seda (Imág. 4 y 10)' },
    { id: 'wings', label: '🦋 Alas Cósmicas (Imág. 3 y 7)' },
    { id: 'nebulaVortex', label: '🌀 Vórtice Infinito (Imág. 6 y 9)' },
    { id: 'supernova', label: '☀️ Supernova Solar (Imág. 1 y 8)' },
    { id: 'causticRays', label: '🌊 Rayos Cáusticos (Imág. 2)' }
  ];

  const presetGrid = document.createElement('div');
  presetGrid.className = 'preset-grid';
  presets.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `${idx + 1}. ${p.label}`;
    btn.addEventListener('click', () => {
      onApplyPreset(p.id);
      refreshAll();
    });
    presetGrid.append(btn);
  });
  presetGroup.append(presetGrid);

  // Botón Mutar Visuales (R)
  const mutateBtn = button(presetGroup, '🎲 Mutar Visuales (R) · Nueva Semilla', () => {
    onResetVisuals();
    refreshAll();
  }, 'accent-btn');
  mutateBtn.title = 'Genera nuevas trayectorias y variaciones procedurales sin pausar ni reiniciar la música';

  panel.append(presetGroup);

  // SECCIÓN 3: CONDUCCIÓN Y PARÁMETROS DEL CAMPO (UNIDAD 6) -----------------
  const agentGroup = document.createElement('div');
  agentGroup.className = 'group';
  agentGroup.innerHTML = '<h2>Conducción de Agentes y Flujo</h2>';

  const simState = {
    harmonics: params.harmonics.value,
    steerStrength: params.steerStrength.value,
    maxSpeed: params.maxSpeed.value,
    swirl: params.swirl.value,
    curlStrength: params.curlStrength.value,
    dragCoefficient: params.dragCoefficient.value,
    petalMorph: params.petalMorph.value
  };

  refreshers.push(rangeRow(agentGroup, 'Pétalos / Armónicos (← →)', simState, 'harmonics', 1, 9, 1, (v) => params.harmonics.value = v, () => params.harmonics.value));
  refreshers.push(rangeRow(agentGroup, 'Vórtice / Giro (↑ ↓)', simState, 'swirl', -4, 4, 0.1, (v) => params.swirl.value = v, () => params.swirl.value));
  refreshers.push(rangeRow(agentGroup, 'Fuerza Maniobra (Steering)', simState, 'steerStrength', 1, 15, 0.2, (v) => params.steerStrength.value = v, () => params.steerStrength.value));
  refreshers.push(rangeRow(agentGroup, 'Velocidad de Flujo', simState, 'maxSpeed', 1, 10, 0.1, (v) => params.maxSpeed.value = v, () => params.maxSpeed.value));
  refreshers.push(rangeRow(agentGroup, 'Turbulencia Curl', simState, 'curlStrength', 0, 2.0, 0.05, (v) => params.curlStrength.value = v, () => params.curlStrength.value));
  refreshers.push(rangeRow(agentGroup, 'Repliegue de Seda', simState, 'petalMorph', 0, 1.8, 0.05, (v) => params.petalMorph.value = v, () => params.petalMorph.value));

  panel.append(agentGroup);

  // SECCIÓN 4: ESTÉTICA Y CROMATISMO ----------------------------------------
  const visualGroup = document.createElement('div');
  visualGroup.className = 'group';
  visualGroup.innerHTML = '<h2>Filamentos y Cromatismo</h2>';

  const visualState = {
    lineLength: params.lineLength.value,
    lineWidth: params.lineWidth.value
  };

  selectRow(visualGroup, 'Paleta Espectral (C)', [
    '0 · Prisma Espectral Arcoíris',
    '1 · Seda Ópalo y Cristal',
    '2 · Sol Dorado y Fuego',
    '3 · Mariposa Neón / Lavanda',
    '4 · Bioluminiscencia Azul Cian'
  ], params.paletteId.value, (idx) => {
    params.paletteId.value = idx;
  });

  refreshers.push(rangeRow(visualGroup, 'Longitud Filamento', visualState, 'lineLength', 0.05, 0.8, 0.01, (v) => params.lineLength.value = v, () => params.lineLength.value));
  refreshers.push(rangeRow(visualGroup, 'Grosor Línea', visualState, 'lineWidth', 0.005, 0.04, 0.001, (v) => params.lineWidth.value = v, () => params.lineWidth.value));

  panel.append(visualGroup);

  // SECCIÓN 5: ACCIONES Y PERFORMANCE ---------------------------------------
  const actionGroup = document.createElement('div');
  actionGroup.className = 'group';
  actionGroup.innerHTML = '<h2>Interpretación en Vivo</h2>';

  button(actionGroup, 'Cambiar Modo (P): LAB / PERFORMANCE', onModeChange, 'primary-btn');

  const guide = document.createElement('div');
  guide.className = 'quick-guide';
  guide.innerHTML = `
    <strong>Atajos de Teclado del Intérprete:</strong><br>
    • <strong>P</strong>: Pantalla completa limpia (PERFORMANCE).<br>
    • <strong>R</strong>: Mutar / Nueva variación (la música continúa).<br>
    • <strong>1–5</strong>: Cambiar morfología de la pieza.<br>
    • <strong>Espacio</strong>: Acento manual / Impulso de energía.<br>
    • <strong>C</strong>: Ciclar paleta espectral.<br>
    • <strong>F</strong>: Invertir sentido del flujo.<br>
    • <strong>↑ / ↓</strong>: Modular giro y vórtice en vivo.<br>
    • <strong>← / →</strong>: Modular número de pétalos.<br>
    • <strong>Arrastrar ratón</strong>: Conducir las corrientes de luz.
  `;
  actionGroup.append(guide);
  panel.append(actionGroup);

  document.body.append(panel);

  function refreshAll() {
    for (const item of refreshers) item.refresh();
  }

  function updateAudioMeters(audioData) {
    if (vuBass) vuBass.style.width = `${Math.min(100, audioData.bass * 100)}%`;
    if (vuMid) vuMid.style.width = `${Math.min(100, audioData.mid * 100)}%`;
    if (vuTreble) vuTreble.style.width = `${Math.min(100, audioData.treble * 100)}%`;
    if (vuPulse) {
      vuPulse.style.width = `${Math.min(100, (audioData.bass * 0.7 + audioData.energy * 0.4) * 100)}%`;
    }
  }

  return {
    element: panel,
    setVisible(visible) { panel.classList.toggle('hidden', !visible); },
    refresh: refreshAll,
    updateAudioMeters
  };
}
