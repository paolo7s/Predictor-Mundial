let AI_BRAIN = null;
fetch('js/ai_brain.json').then(r => r.json()).then(d => {
  AI_BRAIN = d;
  console.log("Cerebro Neural V2.0 (57.85%) Cargado Correctamente.");
});

// ─── POPULATE SELECTS ──────────────────────────────────────────────────────
const selA = document.getElementById('teamA');
const selB = document.getElementById('teamB');

Object.keys(CONFEDERACIONES).forEach(ck => {
  const gA = document.createElement('optgroup'); gA.label = CONFEDERACIONES[ck];
  const gB = document.createElement('optgroup'); gB.label = CONFEDERACIONES[ck];
  TEAMS.filter(t => t.confed === ck).sort((a,b) => a.name.localeCompare(b.name))
    .forEach(t => {
      [gA, gB].forEach((g, i) => {
        const o = document.createElement('option');
        o.value = t.name;
        o.textContent = t.name;
        g.appendChild(o);
      });
    });
  selA.appendChild(gA); selB.appendChild(gB);
});

selA.value = "Argentina";
selB.value = "Francia";
updatePreview('A'); updatePreview('B');

function updatePreview(side) {
  const sel = side === 'A' ? selA : selB;
  const t = TEAMS.find(t => t.name === sel.value);
  document.getElementById(`preview${side}`).textContent = t ? t.flag : '🏳️';
}
function swapTeams() {
  const va = selA.value, vb = selB.value;
  selA.value = vb; selB.value = va;
  updatePreview('A'); updatePreview('B');
}
function clearResults() {
  selA.value = ''; selB.value = '';
  updatePreview('A'); updatePreview('B');
  document.getElementById('resultSection').classList.remove('visible');
  document.getElementById('errorMsg').classList.remove('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getH2H(nameA, nameB) {
  const k1 = `${nameA}_${nameB}`;
  const k2 = `${nameB}_${nameA}`;
  if (H2H_DATA[k1]) return { wA: H2H_DATA[k1][0], draws: H2H_DATA[k1][1], wB: H2H_DATA[k1][2], lastAdv: H2H_DATA[k1][3], found: true };
  if (H2H_DATA[k2]) return { wA: H2H_DATA[k2][2], draws: H2H_DATA[k2][1], wB: H2H_DATA[k2][0], lastAdv: -H2H_DATA[k2][3], found: true };
  return { wA: 0, draws: 0, wB: 0, lastAdv: 0, found: false };
}

function h2hFactor(nameA, nameB) {
  const h = getH2H(nameA, nameB);
  if (!h.found) return { fA: 1.0, fB: 1.0 };
  const total = h.wA + h.draws + h.wB;
  if (total === 0) return { fA: 1.0, fB: 1.0 };
  const winRateA = (h.wA + 0.5 * h.draws) / total;
  const winRateB = (h.wB + 0.5 * h.draws) / total;
  const adjA = 0.96 + (winRateA * 0.08);
  const adjB = 0.96 + (winRateB * 0.08);
  const lastA = h.lastAdv > 0 ? 1.02 : h.lastAdv < 0 ? 0.99 : 1.0;
  const lastB = h.lastAdv < 0 ? 1.02 : h.lastAdv > 0 ? 0.99 : 1.0;
  return { fA: adjA * lastA, fB: adjB * lastB };
}

function squadFactor(squadA, squadB) {
  const diff = squadA - squadB;
  const fA = 1 + (diff / 10) * 0.06;
  const fB = 1 - (diff / 10) * 0.06;
  return { fA, fB };
}

function formFactor(formA, formB) {
  const diff = formA - formB;
  const fA = 1 + diff * 0.07;
  const fB = 1 - diff * 0.07;
  return { fA, fB };
}

const RHO = -0.15;

function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = k * Math.log(lambda) - lambda;
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function dixonColesTau(lA, lB, a, b, rho) {
  if (a === 0 && b === 0) return Math.max(0, 1 - (lA * lB * rho));
  if (a === 0 && b === 1) return Math.max(0, 1 + (lA * rho));
  if (a === 1 && b === 0) return Math.max(0, 1 + (lB * rho));
  if (a === 1 && b === 1) return Math.max(0, 1 - rho);
  return 1;
}

function buildMatrix(lA, lB, max = 5) {
  const rows = [];
  let totalProb = 0;
  for (let a = 0; a <= max; a++) {
    const row = [];
    for (let b = 0; b <= max; b++) {
      const pA = poissonPMF(lA, a);
      const pB = poissonPMF(lB, b);
      const tau = dixonColesTau(lA, lB, a, b, RHO);
      const prob = pA * pB * tau; 
      row.push(prob);
      totalProb += prob;
    }
    rows.push(row);
  }
  for (let a = 0; a <= max; a++) {
    for (let b = 0; b <= max; b++) {
      rows[a][b] = (rows[a][b] / totalProb) * 100;
    }
  }
  return rows;
}

function getCellClass(pct, maxPct) {
  const r = pct / maxPct;
  if (r > 0.80) return 'c-max';
  if (r > 0.55) return 'c-high';
  if (r > 0.30) return 'c-mid';
  if (r > 0.15) return 'c-low';
  return 'c-vlow';
}

function attrBar(label, val, maxVal, color) {
  const pct = Math.min(100, (val / maxVal) * 100);
  return `<div class="attr-row">
    <span class="attr-label">${label}</span>
    <div class="attr-bar-track"><div class="attr-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="attr-val" style="color:${color}">${typeof val === 'number' && val < 10 ? val.toFixed(2) : val}</span>
  </div>`;
}

// ─── NEURAL NETWORK INFERENCE ──────────────────────────────────────────────
function runNeuralNetwork(nameA, nameB) {
  if (!AI_BRAIN || !AI_BRAIN.profiles[nameA] || !AI_BRAIN.profiles[nameB]) return null;
  const profA = AI_BRAIN.profiles[nameA];
  const profB = AI_BRAIN.profiles[nameB];
  
  const inputs = [
    profA.hx/3.0, profA.hxa/3.0, profB.hx/3.0, profB.hxa/3.0,
    (profA.elo - profB.elo)/1000.0,
    1.0 // neutral
  ];
  
  const sigmoid = (x) => 1 / (1 + Math.exp(Math.max(Math.min(-x, 100), -100)));
  
  let preds = [];
  for (let m of AI_BRAIN.models) {
    let hid = [];
    for (let i = 0; i < m.b_hid.length; i++) {
      let v = m.b_hid[i];
      for (let j = 0; j < inputs.length; j++) v += inputs[j] * m.w_in_hid[i][j];
      hid.push(sigmoid(v));
    }
    let out_v = m.b_out;
    for (let j = 0; j < hid.length; j++) out_v += hid[j] * m.w_hid_out[j];
    preds.push(sigmoid(out_v));
  }
  
  let avg_pred = preds.reduce((a,b) => a+b, 0) / preds.length;
  
  // Transform regression 1X2 into Probabilities using Inverse Distance
  let d_home = Math.abs(avg_pred - 1.0);
  let d_draw = Math.abs(avg_pred - 0.5);
  let d_away = Math.abs(avg_pred - 0.0);
  
  // Weights (closer distance = higher weight)
  let w_home = 1 / (d_home + 0.01);
  let w_draw = 1 / (d_draw + 0.05); // Dampen draw slightly to avoid over-predicting draws
  let w_away = 1 / (d_away + 0.01);
  
  let sum_w = w_home + w_draw + w_away;
  
  return {
    pA: (w_home / sum_w) * 100,
    pD: (w_draw / sum_w) * 100,
    pB: (w_away / sum_w) * 100,
    eloA: profA.elo,
    eloB: profB.elo
  };
}

let currentMatchData = null;

function runPrediction() {
  const nameA = selA.value, nameB = selB.value;
  document.getElementById('errorMsg').classList.remove('visible');

  if (!nameA || !nameB) { showError('Por favor seleccioná los dos equipos.'); return; }
  if (nameA === nameB) { showError('Los dos equipos deben ser diferentes.'); return; }
  if (!AI_BRAIN) { showError('El Cerebro IA V2.0 aún se está descargando. Espere un segundo.'); return; }

  const tA = TEAMS.find(t => t.name === nameA);
  const tB = TEAMS.find(t => t.name === nameB);

  document.getElementById('predictBtn').disabled = true;
  document.getElementById('resultSection').classList.remove('visible');
  document.getElementById('loading').classList.add('visible');
  document.getElementById('loadingTeam').textContent = `${tA.flag} ${tA.name}  vs  ${tB.flag} ${tB.name}`;

  // Run pure Neural Network for the base probabilities
  const nnResult = runNeuralNetwork(nameA, nameB);
  let nn_pA = nnResult ? nnResult.pA : 33.3;
  let nn_pD = nnResult ? nnResult.pD : 33.3;
  let nn_pB = nnResult ? nnResult.pB : 33.3;

  // Dixon Coles (Only for Exact Scores generation)
  let lA_base = tA.xg * tB.xga;
  let lB_base = tB.xg * tA.xga;
  const ff = formFactor(tA.form, tB.form);
  const sf = squadFactor(tA.squad, tB.squad);
  const hf = h2hFactor(nameA, nameB);
  const lA = Math.max(0.20, lA_base * ff.fA * sf.fA * hf.fA);
  const lB = Math.max(0.20, lB_base * ff.fB * sf.fB * hf.fB);

  // --- INYECCIÓN DIRECTA DE TRANSFERMARKT SOBRE LA IA (A PETICIÓN DEL USUARIO) ---
  // Amplificamos la jerarquía económica (squad) y la inyectamos sobre el cerebro matemático
  nn_pA = nn_pA * Math.pow(sf.fA, 2.5) * ff.fA;
  nn_pB = nn_pB * Math.pow(sf.fB, 2.5) * ff.fB;
  let nn_total = nn_pA + nn_pD + nn_pB;
  nn_pA = (nn_pA / nn_total) * 100;
  nn_pD = (nn_pD / nn_total) * 100;
  nn_pB = (nn_pB / nn_total) * 100;

  const matrix = buildMatrix(lA, lB);
  
  // Calculate raw matrix sum for scaling
  let mat_pA = 0, mat_pD = 0, mat_pB = 0;
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      const p = matrix[a][b];
      if (a > b) mat_pA += p; else if (b > a) mat_pB += p; else mat_pD += p;
    }
  }

  // --- BLENDING AVANZADO ---
  const useUser = document.getElementById('userToggle').checked;
  let wUser = useUser ? (parseFloat(document.getElementById('userWeight').value) || 0) / 100 : 0;
  if (wUser > 1) wUser = 1;
  const wStat = 1.0 - wUser;

  // THE MAGIC: Replace Matrix Base with NEURAL NETWORK Base!
  let final_pA = nn_pA * wStat;
  let final_pD = nn_pD * wStat;
  let final_pB = nn_pB * wStat;

  // Sumar Analista
  if (wUser > 0) {
    const uA = parseFloat(document.getElementById('userProbA').value) || 0;
    const uD = parseFloat(document.getElementById('userProbD').value) || 0;
    const uB = parseFloat(document.getElementById('userProbB').value) || 0;
    const uTotal = uA + uD + uB;
    if (uTotal > 0) {
      final_pA += ((uA / uTotal) * 100) * wUser;
      final_pD += ((uD / uTotal) * 100) * wUser;
      final_pB += ((uB / uTotal) * 100) * wUser;
    }
  }

  // Escalar la Matriz para que coincida exactamente con lo que dictó la RED NEURONAL
  const factorA = mat_pA > 0 ? final_pA / mat_pA : 0;
  const factorD = mat_pD > 0 ? final_pD / mat_pD : 0;
  const factorB = mat_pB > 0 ? final_pB / mat_pB : 0;

  let maxPct = 0, maxI = 0, maxJ = 0;
  const allScores = [];
  
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      let p = matrix[a][b];
      if (a > b) p *= factorA; else if (b > a) p *= factorB; else p *= factorD;
      matrix[a][b] = p;
      allScores.push({ a, b, p });
      if (p > maxPct) { maxPct = p; maxI = a; maxJ = b; }
    }
  }

  const top3 = [...allScores].sort((x,y) => y.p - x.p).slice(0, 3);
  const btts   = allScores.filter(s => s.a > 0 && s.b > 0).reduce((acc,s) => acc+s.p, 0);
  const over25 = allScores.filter(s => s.a+s.b > 2).reduce((acc,s) => acc+s.p, 0);
  const csA    = allScores.filter(s => s.b === 0).reduce((acc,s) => acc+s.p, 0);
  const h2h    = getH2H(nameA, nameB);

  currentMatchData = { tA, tB, pA: final_pA, pD: final_pD, pB: final_pB, lA, lB, nnResult };

  setTimeout(() => {
    renderResults(tA, tB, matrix, final_pA, final_pD, final_pB, lA, lB, maxPct, maxI, maxJ, top3, btts, over25, csA, h2h, nnResult);
    document.getElementById('loading').classList.remove('visible');
    document.getElementById('predictBtn').disabled = false;
  }, 500);
}

function renderResults(tA, tB, matrix, pA, pD, pB, lA, lB, maxPct, maxI, maxJ, top3, btts, over25, csA, h2h, nnResult) {
  document.getElementById('matchHeader').innerHTML = `
    <div class="team-info">
      <span class="team-flag">${tA.flag}</span>
      <div class="team-name">${tA.name}</div>
      <div class="team-rating" style="color:var(--accent2)">
        ELO: ${nnResult ? Math.round(nnResult.eloA) : 1500}
      </div>
    </div>
    <div class="match-center">
      <div class="vs-text">VS</div>
      <div class="match-badge">Cerebro IA V2.0</div>
      <div class="neutral-badge">Red Neuronal Activa</div>
    </div>
    <div class="team-info">
      <span class="team-flag">${tB.flag}</span>
      <div class="team-name">${tB.name}</div>
      <div class="team-rating" style="color:var(--accent)">
        ELO: ${nnResult ? Math.round(nnResult.eloB) : 1500}
      </div>
    </div>
  `;

  document.getElementById('profileStrip').innerHTML = `
    <div class="profile-card">
      <h4>${tA.flag} ${tA.name}</h4>
      ${attrBar('Ranking ELO Global', nnResult ? Math.round(nnResult.eloA) : 1500, 2200, 'var(--accent2)')}
      ${attrBar('Jerarquía (Estática)', tA.squad, 10, 'var(--gold)')}
    </div>
    <div class="profile-card">
      <h4>${tB.flag} ${tB.name}</h4>
      ${attrBar('Ranking ELO Global', nnResult ? Math.round(nnResult.eloB) : 1500, 2200, 'var(--accent2)')}
      ${attrBar('Jerarquía (Estática)', tB.squad, 10, 'var(--gold)')}
    </div>
  `;

  const medals = ['🥇','🥈','🥉'];
  document.getElementById('topScores').innerHTML = top3.map((s,i) => `
    <div class="score-card ${i===0?'top1':''}">
      <div class="rank">${medals[i]} Resultado #${i+1}</div>
      <div class="score-val">${s.a} – ${s.b}</div>
      <div class="score-pct">${s.p.toFixed(2)}% de probabilidad</div>
    </div>
  `).join('');

  document.getElementById('probBars').innerHTML = `
    <div class="prob-bar-card teamA">
      <div class="label">${tA.flag} ${tA.name}</div>
      <div class="value">${pA.toFixed(1)}%</div>
      <div class="sub">Ganador (IA)</div>
      <div class="prob-fill-track"><div class="prob-fill" style="width:${pA.toFixed(1)}%"></div></div>
    </div>
    <div class="prob-bar-card draw">
      <div class="label">Empate</div>
      <div class="value">${pD.toFixed(1)}%</div>
      <div class="sub">90 mins (IA)</div>
      <div class="prob-fill-track"><div class="prob-fill" style="width:${pD.toFixed(1)}%"></div></div>
    </div>
    <div class="prob-bar-card teamB">
      <div class="label">${tB.flag} ${tB.name}</div>
      <div class="value">${pB.toFixed(1)}%</div>
      <div class="sub">Ganador (IA)</div>
      <div class="prob-fill-track"><div class="prob-fill" style="width:${pB.toFixed(1)}%"></div></div>
    </div>
  `;

  document.getElementById('statsStrip').innerHTML = `
    <div class="stat-box">
      <div class="s-label">Goles totales esp.</div>
      <div class="s-val" style="color:var(--accent2)">${(lA+lB).toFixed(2)}</div>
    </div>
    <div class="stat-box">
      <div class="s-label">Ambos anotan</div>
      <div class="s-val" style="color:var(--green)">${btts.toFixed(1)}%</div>
    </div>
    <div class="stat-box">
      <div class="s-label">Más de 2.5 goles</div>
      <div class="s-val" style="color:var(--gold)">${over25.toFixed(1)}%</div>
    </div>
  `;

  let mhtml = `
    <div class="section-title"><div class="dot"></div>Matriz Dixon-Coles Ajustada por IA (%)</div>
    <div class="axis-label-x">${tB.flag} ${tB.name} (goles) →</div>
    <div class="axis-label-y-wrap">
      <div class="axis-label-y">↑ ${tA.flag} ${tA.name}</div>
      <div style="overflow-x:auto">
      <table class="matrix">
        <thead><tr><th>A↓ / B→</th>${[0,1,2,3,4,5].map(n=>`<th>${n}</th>`).join('')}</tr></thead>
        <tbody>`;

  for (let a = 0; a <= 5; a++) {
    mhtml += `<tr><th>${a}</th>`;
    for (let b = 0; b <= 5; b++) {
      const pct = matrix[a][b];
      const cls = getCellClass(pct, maxPct);
      const hl  = (a===maxI && b===maxJ) ? ' highlighted' : '';
      mhtml += `<td class="${cls}${hl}"><span class="pct">${pct.toFixed(2)}</span></td>`;
    }
    mhtml += `</tr>`;
  }
  mhtml += `</tbody></table></div></div>`;
  document.getElementById('matrixWrapper').innerHTML = mhtml;

  document.getElementById('modelExplainer').innerHTML = `
    <strong>🧠 Arquitectura Híbrida:</strong> Las probabilidades base están siendo inyectadas por la <strong>Red Neuronal V2.0 (58% de acierto)</strong> usando Ranking ELO Dinámico e historial. <strong>¡NUEVO:</strong> A pedido del usuario, el algoritmo Javascript ahora secuestra la decisión de la IA y le inyecta <strong>Brutalmente el Valor de Transfermarkt (Jerarquía) y Forma Reciente</strong> sobre la probabilidad de la máquina para predecir el Mundial 2026. Finalmente, Dixon-Coles dibuja el marcador exacto.
  `;

  document.getElementById('resultSection').classList.add('visible');
  setTimeout(() => document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = '⚠️ ' + msg;
  el.classList.add('visible');
}