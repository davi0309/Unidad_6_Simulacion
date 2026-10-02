/**
 * labPanel.js
 * Panel interactivo para el Instrumento Visual 3D de la Unidad 6.
 * Incluye selector de velocidad con un solo clic, arquetipos 3D en esfera,
 * controles del campo armónico y atajos de interpretación.
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
  onModeChange,
  onSpeedChange,
  onBlendingChange,
  onPaletteChange
}) {
  const refreshers = [];
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>U6 · Instrumento Visual 3D (Esfera)</h1>
    <p>Agentes autónomos en esfera 3D. Conduces la morfología en tiempo real.</p>
  `;

  // SECCIÓN 1: REPRODUCTOR DE MÚSICA Y PALETA ESPECTRAL ---------------------
  const audioGroup = document.createElement('div');
  audioGroup.className = 'group audio-group';
  audioGroup.innerHTML = '<h2>Música y Paletas Espectrales</h2><p>La canción cambia automáticamente la paleta espectral según la etapa musical. Cero afectación al brillo.</p>';

  const trackInfo = document.createElement('div');
  trackInfo.className = 'track-info';
  trackInfo.textContent = `🎵 ${audioManager.getCurrentTrackName()}`;
  audioManager.onTrackChange((name) => {
    trackInfo.textContent = `🎵 ${name}`;
  });
  audioGroup.append(trackInfo);

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

  const stageInfo = document.createElement('div');
  stageInfo.className = 'stage-info';
  stageInfo.style.cssText = 'margin-top: 8px; font-size: 11.5px; padding: 8px 10px; background: rgba(56, 139, 253, 0.12); border: 1px solid rgba(56, 139, 253, 0.35); border-radius: 6px; color: #79c0ff; line-height: 1.4;';
  stageInfo.innerHTML = '<strong>Etapa Activa:</strong> Pulsa Reproducir para iniciar la conducción.';
  audioGroup.append(stageInfo);

  panel.append(audioGroup);

  // SECCIÓN 2: CONTROL DE VELOCIDAD DINÁMICA ---------------------------------
  const speedGroup = document.createElement('div');
  speedGroup.className = 'group';
  speedGroup.innerHTML = '<h2>Velocidad de Flujo (Tecla T / Shift)</h2><p>Por defecto lenta y serena para apreciar las formas:</p>';

  const speedButtonRow = document.createElement('div');
  speedButtonRow.className = 'button-row speed-row';

  const slowBtn = document.createElement('button');
  slowBtn.textContent = '🐢 Lenta (Defecto)';
  slowBtn.className = 'active';

  const normalBtn = document.createElement('button');
  normalBtn.textContent = '🚶 Moderada';

  const fastBtn = document.createElement('button');
  fastBtn.textContent = '⚡ Rápida';

  const updateSpeedButtons = (multiplier) => {
    slowBtn.classList.toggle('active', multiplier <= 1.1);
    normalBtn.classList.toggle('active', multiplier > 1.1 && multiplier <= 2.0);
    fastBtn.classList.toggle('active', multiplier > 2.0);
  };

  slowBtn.addEventListener('click', () => {
    onSpeedChange(1.0);
    updateSpeedButtons(1.0);
    refreshAll();
  });
  normalBtn.addEventListener('click', () => {
    onSpeedChange(1.75);
    updateSpeedButtons(1.75);
    refreshAll();
  });
  fastBtn.addEventListener('click', () => {
    onSpeedChange(2.8);
    updateSpeedButtons(2.8);
    refreshAll();
  });

  speedButtonRow.append(slowBtn, normalBtn, fastBtn);
  speedGroup.append(speedButtonRow);

  const speedState = {
    maxSpeed: params.maxSpeed.value,
    speedMultiplier: params.speedMultiplier.value
  };
  refreshers.push(rangeRow(speedGroup, 'Velocidad Base', speedState, 'maxSpeed', 0.5, 5.0, 0.1, (v) => params.maxSpeed.value = v, () => params.maxSpeed.value));

  panel.append(speedGroup);

  // SECCIÓN 3: FORMAS ARMÓNICAS Y ARQUETIPOS DE REFERENCIA -----------------
  const presetGroup = document.createElement('div');
  presetGroup.className = 'group';
  presetGroup.innerHTML = '<h2>Arquetipos Visuales (Teclas 1–5)</h2><p>Morfologías continuas por fuerzas de Physarum, 36 Points y Craig Reynolds:</p>';

  const presets = [
    { id: 'cellular', label: '1. Red Celular Bio-Cyan (Ref 1)' },
    { id: 'iris', label: '2. Iris Cósmico / Fingering (Ref 2)' },
    { id: 'coral', label: '3. Rosa Coralina Espiral 3D (Ref 3)' },
    { id: 'fern', label: '4. Helecho Fractal Jade (Ref 4)' },
    { id: 'spirograph', label: '5. 36 Points Sage Jenson (Ref 5)' }
  ];

  const presetGrid = document.createElement('div');
  presetGrid.className = 'preset-grid';
  presets.forEach((p, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `${p.label}`;
    btn.addEventListener('click', () => {
      onApplyPreset(p.id);
      refreshAll();
    });
    presetGrid.append(btn);
  });
  presetGroup.append(presetGrid);

  const mutateBtn = button(presetGroup, '🎲 Mutar Visuales (R) · Nueva Semilla', () => {
    onResetVisuals();
    refreshAll();
  }, 'accent-btn');
  mutateBtn.title = 'Genera nuevas trayectorias tridimensionales sin reiniciar la música';

  panel.append(presetGroup);

  // SECCIÓN 4: PARÁMETROS DEL CAMPO 3D Y ESPACIO -----------------------------
  const agentGroup = document.createElement('div');
  agentGroup.className = 'group';
  agentGroup.innerHTML = '<h2>Agentes y Espacio Visual (Unidad 6)</h2>';

  const simState = {
    harmonics: params.harmonics.value,
    swirl: params.swirl.value,
    petalMorph: params.petalMorph.value,
    curlStrength: params.curlStrength.value,
    sphereRadius: params.sphereRadius.value,
    steerStrength: params.steerStrength.value
  };

  refreshers.push(rangeRow(agentGroup, 'Pétalos / Septos (← →)', simState, 'harmonics', 1, 9, 1, (v) => params.harmonics.value = v, () => params.harmonics.value));
  refreshers.push(rangeRow(agentGroup, 'Vórtice / Giro (↑ ↓)', simState, 'swirl', -4, 4, 0.1, (v) => params.swirl.value = v, () => params.swirl.value));
  refreshers.push(rangeRow(agentGroup, 'Pliegues y Frondas 3D', simState, 'petalMorph', 0.2, 2.5, 0.05, (v) => params.petalMorph.value = v, () => params.petalMorph.value));
  refreshers.push(rangeRow(agentGroup, 'Radio Pantalla Completa', simState, 'sphereRadius', 6.0, 16.0, 0.1, (v) => params.sphereRadius.value = v, () => params.sphereRadius.value));
  refreshers.push(rangeRow(agentGroup, 'Fuerza Maniobra (Steering)', simState, 'steerStrength', 2, 20, 0.5, (v) => params.steerStrength.value = v, () => params.steerStrength.value));

  panel.append(agentGroup);

  // SECCIÓN 5: ESTÉTICA Y CROMATISMO ----------------------------------------
  const visualGroup = document.createElement('div');
  visualGroup.className = 'group';
  visualGroup.innerHTML = '<h2>Filamentos y Cromatismo (Sage Jenson)</h2>';

  const visualState = {
    lineLength: params.lineLength.value,
    lineWidth: params.lineWidth.value,
    filamentAlpha: params.filamentAlpha.value,
    transitionDuration: params.transitionDuration ? params.transitionDuration.value : 4.5
  };

  const initialPal = params.paletteB ? params.paletteB.value : params.paletteId.value;
  const paletteSelect = selectRow(visualGroup, 'Paleta Espectral (C)', [
    '0 · Red Celular Bio-Cyan (Ref 1)',
    '1 · Iris Cósmico Espectral (Ref 2)',
    '2 · Rosa Coralina Teal y Espuma (Ref 3)',
    '3 · Helecho Fractal Menta y Jade (Ref 4)',
    '4 · 36 Points RGB Split (Ref 5)'
  ], initialPal, (idx) => {
    if (onPaletteChange) {
      onPaletteChange(idx);
    } else {
      params.paletteId.value = idx;
    }
  });

  refreshers.push({
    refresh() {
      const activeVal = params.paletteB ? params.paletteB.value : params.paletteId.value;
      paletteSelect.value = String(Math.round(activeVal));
    }
  });

  selectRow(visualGroup, 'Mezcla de Color', [
    'Seda de Color Puro (Sin Blanco)',
    'Luz Resplandeciente (Aditivo)'
  ], 0, (idx) => {
    onBlendingChange?.(idx === 0 ? 'normal' : 'additive');
  });

  refreshers.push(rangeRow(visualGroup, 'Duración Transición (s)', visualState, 'transitionDuration', 4, 35, 1, (v) => {
    if (params.transitionDuration) params.transitionDuration.value = v;
  }, () => params.transitionDuration ? params.transitionDuration.value : 20));
  refreshers.push(rangeRow(visualGroup, 'Longitud Filamento', visualState, 'lineLength', 0.1, 1.2, 0.02, (v) => params.lineLength.value = v, () => params.lineLength.value));
  refreshers.push(rangeRow(visualGroup, 'Grosor Línea', visualState, 'lineWidth', 0.008, 0.06, 0.002, (v) => params.lineWidth.value = v, () => params.lineWidth.value));
  refreshers.push(rangeRow(visualGroup, 'Opacidad de Seda', visualState, 'filamentAlpha', 0.04, 0.4, 0.01, (v) => params.filamentAlpha.value = v, () => params.filamentAlpha.value));

  panel.append(visualGroup);

  // SECCIÓN 6: ACCIONES Y PERFORMANCE ---------------------------------------
  const actionGroup = document.createElement('div');
  actionGroup.className = 'group';
  actionGroup.innerHTML = '<h2>Interpretación en Vivo</h2>';

  button(actionGroup, 'Cambiar Modo (P): LAB / PERFORMANCE', onModeChange, 'primary-btn');

  const guide = document.createElement('div');
  guide.className = 'quick-guide';
  guide.innerHTML = `
    <strong>Controles en Vivo del Intérprete:</strong><br>
    • <strong>1</strong>: Red Celular Bio-Cyan (Ref 1)<br>
    • <strong>2</strong>: Iris Cósmico / Fingering (Ref 2)<br>
    • <strong>3</strong>: Rosa Coralina Espiral 3D (Ref 3)<br>
    • <strong>4</strong>: Helecho Fractal Jade (Ref 4)<br>
    • <strong>5</strong>: 36 Points RGB Split (Ref 5)<br>
    • <strong>P</strong>: Modo PERFORMANCE (pantalla completa limpia).<br>
    • <strong>Shift</strong>: Mantener para Turbo / Acelerar.<br>
    • <strong>T</strong>: Ciclar velocidad (Lenta / Moderada / Rápida).<br>
    • <strong>R</strong>: Mutar / Nueva semilla sin pausar música.<br>
    • <strong>Espacio</strong>: Acento manual de energía.<br>
    • <strong>C</strong>: Ciclar paleta espectral.<br>
    • <strong>F</strong>: Invertir sentido del flujo.<br>
    • <strong>↑ / ↓</strong>: Modular giro/vórtice en vivo.<br>
    • <strong>← / →</strong>: Modular número de pétalos/septos.<br>
    • <strong>Ratón / Clic</strong>: Conducir los agentes (cámara fija).
  `;
  actionGroup.append(guide);
  panel.append(actionGroup);

  document.body.append(panel);

  function refreshAll() {
    for (const item of refreshers) item.refresh();
  }

  function updateAudioMeters() {
    // Los vúmetros se han retirado; el audio modula exclusivamente la paleta según la etapa
  }

  function setStageInfo(htmlContent) {
    if (stageInfo) stageInfo.innerHTML = htmlContent;
  }

  return {
    element: panel,
    setVisible(visible) { panel.classList.toggle('hidden', !visible); },
    refresh: refreshAll,
    updateAudioMeters,
    updateSpeedButtons,
    setStageInfo
  };
}
