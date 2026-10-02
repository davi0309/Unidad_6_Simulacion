/**
 * labPanel.js
 * Consola de Interpretación y Laboratorio para Motion Picture Soundtrack
 * Metáfora: Película Vieja de Celuloide y Respiración de Armonio
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
  onChordChange,
  onBellowsToggle,
  onHarpGlissando,
  onCelestialHold,
  onCreditsToggle,
  onCodaMotePulse,
  onModeChange,
  onSpeedChange,
  onBlendingChange,
  onPaletteChange
}) {
  const refreshers = [];
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.innerHTML = `
    <h1>🎞️ Película Vieja & Respiración</h1>
    <p><em>Motion Picture Soundtrack</em> · Armonio, Celuloide y Luz 3D en WebGPU</p>
  `;

  // SECCIÓN 1: REPRODUCTOR DE MÚSICA Y GUÍA DE PARTITURA ---------------------
  const audioGroup = document.createElement('div');
  audioGroup.className = 'group audio-group';
  audioGroup.innerHTML = '<h2>Música y Etapas de la Obra</h2>';

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
  playBtn.textContent = '▶ Reproducir Canción';
  playBtn.addEventListener('click', () => {
    const playing = audioManager.togglePlay();
    playBtn.textContent = playing ? '⏸ Pausar' : '▶ Reproducir';
    playBtn.classList.toggle('active', playing);
  });

  const fileLabel = document.createElement('label');
  fileLabel.className = 'file-btn';
  fileLabel.innerHTML = '📂 Cargar .mp3 propio';
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
  stageInfo.innerHTML = '<strong>Etapa Activa:</strong> Pulsa Reproducir para sincronizar el score.';
  audioGroup.append(stageInfo);

  panel.append(audioGroup);

  // SECCIÓN 2: EL FUELLE DEL ARMONIO (INHALAR / EXHALAR CON ESPACIO) ----------
  const bellowsGroup = document.createElement('div');
  bellowsGroup.className = 'group';
  bellowsGroup.innerHTML = '<h2>🫁 El Fuelle del Armonio (Espacio)</h2><p>Mantén presionada la Barra Espaciadora para inhalar (anillos apretados concéntricos). Suelta para exhalar y expandir el aire.</p>';

  const bellowsBox = document.createElement('div');
  bellowsBox.className = 'bellows-box';

  const bellowsStatus = document.createElement('div');
  bellowsStatus.className = 'bellows-status';
  bellowsStatus.innerHTML = '<span id="bellows-label">Exhalando (Flujo libre)</span><span id="bellows-pct">0%</span>';

  const bellowsTrack = document.createElement('div');
  bellowsTrack.className = 'bellows-track';
  const bellowsBar = document.createElement('div');
  bellowsBar.className = 'bellows-bar';
  bellowsTrack.append(bellowsBar);

  const pumpBtn = document.createElement('button');
  pumpBtn.className = 'accent-btn';
  pumpBtn.textContent = '🫁 Bombear Fuelle (Mantener presionado)';
  pumpBtn.addEventListener('mousedown', () => onBellowsToggle?.(true));
  window.addEventListener('mouseup', () => onBellowsToggle?.(false));
  pumpBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onBellowsToggle?.(true); });
  window.addEventListener('touchend', () => onBellowsToggle?.(false));

  bellowsBox.append(bellowsStatus, bellowsTrack, pumpBtn);
  bellowsGroup.append(bellowsBox);
  panel.append(bellowsGroup);

  // SECCIÓN 3: ACORDES DEL ÓRGANO (FILA CENTRAL A S D F G H J K) -------------
  const chordsGroup = document.createElement('div');
  chordsGroup.className = 'group';
  chordsGroup.innerHTML = '<h2>🎹 Acordes del Armonio (A S D F G H J K)</h2><p>Líneas de campo magnético como limaduras de hierro. Se derriten lentamente de uno a otro:</p>';

  const chords = [
    { id: 0, key: 'A', name: 'Sol Mayor (G)', note: 'Tónica de apertura' },
    { id: 1, key: 'S', name: 'Si Menor (Bm)', note: 'Melancolía profunda' },
    { id: 2, key: 'D', name: 'Do Mayor (C)', note: 'Alivio y apertura' },
    { id: 3, key: 'F', name: 'Do Menor (Cm)', note: 'Tensión trágica' },
    { id: 4, key: 'G', name: 'Sol/Si (G/B)', note: 'Inversión flotante' },
    { id: 5, key: 'H', name: 'Mi Menor (Em)', note: 'Suspenso etéreo' },
    { id: 6, key: 'J', name: 'Do9 (Cadd9)', note: 'Doble hélice armónica' },
    { id: 7, key: 'K', name: 'Re sus4 (Dsus4)', note: 'Preparación al arpa' }
  ];

  const chordGrid = document.createElement('div');
  chordGrid.className = 'chord-grid';
  const chordButtons = [];

  chords.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'chord-btn';
    btn.innerHTML = `<span class="key-badge">${c.key}</span> <span>${c.name}</span>`;
    btn.title = `${c.name}: ${c.note}`;
    if (c.id === 0) btn.classList.add('active');
    btn.addEventListener('click', () => {
      onChordChange?.(c.id);
      chordButtons.forEach((b, idx) => b.classList.toggle('active', idx === c.id));
    });
    chordButtons.push(btn);
    chordGrid.append(btn);
  });

  chordsGroup.append(chordGrid);
  panel.append(chordsGroup);

  // SECCIÓN 4: LA VOZ Y LAS ARPAS --------------------------------------------
  const voiceGroup = document.createElement('div');
  voiceGroup.className = 'group';
  voiceGroup.innerHTML = `
    <h2>🗣️ La Voz y 🪽 Las Arpas</h2>
    <p><strong>Mouse = La Voz:</strong> Tu cursor es el punto luminoso de la melodía. Deja 3 ecos fantasma con reverberación de catedral.</p>
    <p><strong>Fila 1–0 = Glissando de Arpa:</strong> Barre los números con el dedo. Los filamentos forman cuerdas verticales y vibran al paso de la onda:</p>
  `;

  const harpStrip = document.createElement('div');
  harpStrip.className = 'harp-strip';

  const harpAscBtn = document.createElement('button');
  harpAscBtn.innerHTML = '▶ Glissando Ascendente (1 al 0)';
  harpAscBtn.addEventListener('click', () => onHarpGlissando?.(1.0));

  const harpDescBtn = document.createElement('button');
  harpDescBtn.innerHTML = '◀ Glissando Descendente (0 al 1)';
  harpDescBtn.addEventListener('click', () => onHarpGlissando?.(-1.0));

  harpStrip.append(harpAscBtn, harpDescBtn);
  voiceGroup.append(harpStrip);
  panel.append(voiceGroup);

  // SECCIÓN 5: FINAL CELESTIAL Y CRÉDITOS ------------------------------------
  const climaxGroup = document.createElement('div');
  climaxGroup.className = 'group';
  climaxGroup.innerHTML = '<h2>✨ Final Celestial y 📜 Créditos</h2>';

  const celestialBtn = document.createElement('button');
  celestialBtn.className = 'celestial-btn';
  celestialBtn.innerHTML = '✨ Ascenso Celestial [Shift Mantener] · Gravedad Invertida + Physarum';
  celestialBtn.addEventListener('mousedown', () => { onCelestialHold?.(true); celestialBtn.classList.add('active'); });
  window.addEventListener('mouseup', () => { onCelestialHold?.(false); celestialBtn.classList.remove('active'); });
  celestialBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onCelestialHold?.(true); celestialBtn.classList.add('active'); });
  window.addEventListener('touchend', () => { onCelestialHold?.(false); celestialBtn.classList.remove('active'); });
  climaxGroup.append(celestialBtn);

  const creditsBtn = document.createElement('button');
  creditsBtn.className = 'credits-btn';
  creditsBtn.style.marginTop = '6px';
  creditsBtn.innerHTML = '📜 Rodar Créditos Finales [Enter] ➔ Pantalla Vacía y Silencio';
  creditsBtn.addEventListener('click', () => onCreditsToggle?.());
  climaxGroup.append(creditsBtn);

  const motesBtn = document.createElement('button');
  motesBtn.style.marginTop = '6px';
  motesBtn.innerHTML = '🌌 Motas Tenues del Silencio (Coda Oculta *Genchildren*)';
  motesBtn.addEventListener('click', () => onCodaMotePulse?.());
  climaxGroup.append(motesBtn);

  panel.append(climaxGroup);

  // SECCIÓN 6: ESTÉTICA DE PELÍCULA ANTIGUA Y CELULOIDE ----------------------
  const filmGroup = document.createElement('div');
  filmGroup.className = 'group';
  filmGroup.innerHTML = '<h2>🎞️ Celuloide y Textura de Película</h2>';

  const filmState = {
    filmGrain: params.filmGrain.value,
    filmFlicker: params.filmFlicker.value,
    lineLength: params.lineLength.value,
    lineWidth: params.lineWidth.value,
    filamentAlpha: params.filamentAlpha.value
  };

  const initialPal = params.paletteB ? params.paletteB.value : params.paletteId.value;
  const paletteSelect = selectRow(filmGroup, 'Paleta Cinemática (C)', [
    '0 · Película de Celuloide Antiguo (Añil, pizarra y marfil)',
    '1 · Seda Ópalo y Amatista (Turquesa y magenta)',
    '2 · Fuego Dorado y Madera Cálida',
    '3 · Mariposa Neón / Lavanda',
    '4 · Océano Profundo y Azul Cian'
  ], initialPal, (idx) => {
    onPaletteChange?.(idx);
  });

  refreshers.push({
    refresh() {
      const activeVal = params.paletteB ? params.paletteB.value : params.paletteId.value;
      paletteSelect.value = String(Math.round(activeVal));
    }
  });

  refreshers.push(rangeRow(filmGroup, 'Grano de Película (24 FPS)', filmState, 'filmGrain', 0.0, 0.7, 0.02, (v) => params.filmGrain.value = v, () => params.filmGrain.value));
  refreshers.push(rangeRow(filmGroup, 'Parpadeo de Proyector (Flicker)', filmState, 'filmFlicker', 0.0, 0.5, 0.02, (v) => params.filmFlicker.value = v, () => params.filmFlicker.value));
  refreshers.push(rangeRow(filmGroup, 'Longitud de Rayón / Pelo', filmState, 'lineLength', 0.1, 0.8, 0.02, (v) => params.lineLength.value = v, () => params.lineLength.value));
  refreshers.push(rangeRow(filmGroup, 'Grosor de Filamento', filmState, 'lineWidth', 0.008, 0.05, 0.002, (v) => params.lineWidth.value = v, () => params.lineWidth.value));
  refreshers.push(rangeRow(filmGroup, 'Opacidad de Celuloide', filmState, 'filamentAlpha', 0.1, 0.9, 0.02, (v) => params.filamentAlpha.value = v, () => params.filamentAlpha.value));

  panel.append(filmGroup);

  // SECCIÓN 7: VELOCIDAD Y ACCIONES GLOBALES ---------------------------------
  const actionsGroup = document.createElement('div');
  actionsGroup.className = 'group';
  actionsGroup.innerHTML = '<h2>Velocidad y Pantalla</h2>';

  const speedRow = document.createElement('div');
  speedRow.className = 'speed-row';

  const slowBtn = document.createElement('button');
  slowBtn.textContent = '🐢 Lenta';
  slowBtn.className = 'active';

  const normBtn = document.createElement('button');
  normBtn.textContent = '🚶 Moderada';

  const fastBtn = document.createElement('button');
  fastBtn.textContent = '⚡ Rápida';

  const updateSpeedButtons = (multiplier) => {
    slowBtn.classList.toggle('active', multiplier <= 1.1);
    normBtn.classList.toggle('active', multiplier > 1.1 && multiplier <= 2.0);
    fastBtn.classList.toggle('active', multiplier > 2.0);
  };

  slowBtn.addEventListener('click', () => { onSpeedChange?.(1.0); updateSpeedButtons(1.0); });
  normBtn.addEventListener('click', () => { onSpeedChange?.(1.75); updateSpeedButtons(1.75); });
  fastBtn.addEventListener('click', () => { onSpeedChange?.(2.8); updateSpeedButtons(2.8); });

  speedRow.append(slowBtn, normBtn, fastBtn);
  actionsGroup.append(speedRow);

  button(actionsGroup, '📺 Alternar Modo (P): LAB / PERFORMANCE', onModeChange, 'primary-btn');
  button(actionsGroup, '🎲 Mutar Trayectorias (R) · Nueva Semilla', onResetVisuals, 'accent-btn');

  // GUÍA RÁPIDA DE INTERPRETACIÓN
  const guide = document.createElement('div');
  guide.className = 'quick-guide';
  guide.innerHTML = `
    <strong>Tabla de Interpretación al Teclado:</strong><br>
    • <strong>Espacio</strong>: Fuelle del armonio (inhalar y exhalar)<br>
    • <strong>A S D F G H J K</strong>: Acordes de armonio (G, Bm, C, Cm, G/B, Em, Cadd9, D)<br>
    • <strong>Mouse</strong>: La voz con reverberación (3 ecos difusos)<br>
    • <strong>1 al 0 (barrido)</strong>: Glissando de arpas (cuerdas vibrantes)<br>
    • <strong>Shift</strong>: Ascenso celestial (gravedad invertida + Physarum)<br>
    • <strong>Enter</strong>: Créditos finales y pantalla vacía de celuloide<br>
    • <strong>Cualquier tecla en el silencio</strong>: Motas tenues del final
  `;
  actionsGroup.append(guide);

  panel.append(actionsGroup);
  document.body.append(panel);

  function refreshAll() {
    for (const item of refreshers) item.refresh();
  }

  function setStageInfo(htmlContent) {
    if (stageInfo) stageInfo.innerHTML = htmlContent;
  }

  function updateBellows(val) {
    bellowsBar.style.width = `${Math.round(val * 100)}%`;
    const label = document.getElementById('bellows-label');
    const pct = document.getElementById('bellows-pct');
    if (label && pct) {
      pct.textContent = `${Math.round(val * 100)}%`;
      label.textContent = val > 0.05 ? '🫁 Inhalando (Fuelle comprimido)' : '🌬️ Exhalando (Fuelle relajado)';
    }
  }

  function updateActiveChord(idx) {
    chordButtons.forEach((b, i) => b.classList.toggle('active', i === idx));
  }

  function updateCreditsState(state) {
    creditsBtn.classList.toggle('active', state === 'ROLLING' || state === 'SILENCE');
    if (state === 'ROLLING') {
      creditsBtn.innerHTML = '⏳ Rodando Créditos... [Enter para reiniciar]';
    } else if (state === 'SILENCE') {
      creditsBtn.innerHTML = '🌌 Silencio Total (Toca teclas para motas) [Enter para reiniciar]';
    } else {
      creditsBtn.innerHTML = '📜 Rodar Créditos Finales [Enter] ➔ Pantalla Vacía y Silencio';
    }
  }

  function flashHarp(dir) {
    const btn = dir > 0 ? harpAscBtn : harpDescBtn;
    btn.style.borderColor = '#388bfd';
    setTimeout(() => { btn.style.borderColor = ''; }, 400);
  }

  return {
    element: panel,
    setVisible(visible) { panel.classList.toggle('hidden', !visible); },
    refresh: refreshAll,
    updateSpeedButtons,
    setStageInfo,
    updateBellows,
    updateActiveChord,
    updateCreditsState,
    flashHarp
  };
}
