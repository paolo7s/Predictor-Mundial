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

// ─── H2H LOOKUP ────────────────────────────────────────────────────────────
function getH2H(nameA, nameB) {
  const k1 = `${nameA}_${nameB}`;
  const k2 = `${nameB}_${nameA}`;
  if (H2H_DATA[k1]) return { wA: H2H_DATA[k1][0], draws: H2H_DATA[k1][1], wB: H2H_DATA[k1][2], lastAdv: H2H_DATA[k1][3], found: true };
  if (H2H_DATA[k2]) return { wA: H2H_DATA[k2][2], draws: H2H_DATA[k2][1], wB: H2H_DATA[k2][0], lastAdv: -H2H_DATA[k2][3], found: true };
  return { wA: 0, draws: 0, wB: 0, lastAdv: 0, found: false };
}

// ─── H2H ADVANTAGE FACTOR ──────────────────────────────────────────────────
// Devuelve un factor multiplicativo para lA y lB basado en historial
function h2hFactor(nameA, nameB) {
  const h = getH2H(nameA, nameB);
  if (!h.found) return { fA: 1.0, fB: 1.0 };
  const total = h.wA + h.draws + h.wB;
  if (total === 0) return { fA: 1.0, fB: 1.0 };
  const winRateA = (h.wA + 0.5 * h.draws) / total;
  const winRateB = (h.wB + 0.5 * h.draws) / total;
  // Slight boost/penalty based on historical dominance, max ±8%
  const adjA = 0.96 + (winRateA * 0.08);
  const adjB = 0.96 + (winRateB * 0.08);
  // Extra nudge if won the last game
  const lastA = h.lastAdv > 0 ? 1.02 : h.lastAdv < 0 ? 0.99 : 1.0;
  const lastB = h.lastAdv < 0 ? 1.02 : h.lastAdv > 0 ? 0.99 : 1.0;
  return { fA: adjA * lastA, fB: adjB * lastB };
}

// ─── SQUAD FACTOR ──────────────────────────────────────────────────────────
// Normaliza la diferencia de plantel a un multiplicador de λ
function squadFactor(squadA, squadB) {
  const diff = squadA - squadB; // -10 a +10
  // Max efecto: ±6%
  const fA = 1 + (diff / 10) * 0.06;
  const fB = 1 - (diff / 10) * 0.06;
  return { fA, fB };
}

// ─── FORM FACTOR ───────────────────────────────────────────────────────────
function formFactor(formA, formB) {
  const diff = formA - formB; // -1 a +1
  // Max efecto: ±7%
  const fA = 1 + diff * 0.07;
  const fB = 1 - diff * 0.07;
  return { fA, fB };
}

// ─── DIXON-COLES & POISSON ─────────────────────────────────────────────────
// Parámetro de dependencia (rho). En fútbol suele ser negativo (~ -0.15)
// Esto aumenta la probabilidad de los empates 0-0 y 1-1, y reduce
// marginalmente los 1-0 y 0-1 para ajustarse a la realidad del deporte.
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

  // Paso 1: Generar matriz cruda con el ajuste bivariado de Dixon-Coles
  for (let a = 0; a <= max; a++) {
    const row = [];
    for (let b = 0; b <= max; b++) {
      const pA = poissonPMF(lA, a);
      const pB = poissonPMF(lB, b);
      const tau = dixonColesTau(lA, lB, a, b, RHO);
      const prob = pA * pB * tau; // Probabilidad conjunta ajustada
      row.push(prob);
      totalProb += prob;
    }
    rows.push(row);
  }

  // Paso 2: Normalizar para que la matriz sume exactamente 100%
  // (necesario ya que limitamos los goles a 'max' y aplicamos el factor tau)
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

// ─── RATING STARS ──────────────────────────────────────────────────────────
function stars(sq) {
  const full = Math.round(sq / 2);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

// ─── ATTR BAR ──────────────────────────────────────────────────────────────
function attrBar(label, val, maxVal, color) {
  const pct = Math.min(100, (val / maxVal) * 100);
  return `<div class="attr-row">
    <span class="attr-label">${label}</span>
    <div class="attr-bar-track"><div class="attr-bar-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="attr-val" style="color:${color}">${typeof val === 'number' && val < 10 ? val.toFixed(2) : val}</span>
  </div>`;
}

// ─── AI ────────────────────────────────────────────────────────────────────
let currentMatchData = null;

function handleAIGeneration() {
  if (!currentMatchData) return;
  const { tA, tB, pA, pD, pB, maxI, maxJ, lA, lB, h2h, squadF, formF, userExtra, top5, btts, over25, csA, csB } = currentMatchData;

  const aiBtn = document.getElementById('aiBtn');
  const aiCard = document.getElementById('aiCard');
  const aiContent = document.getElementById('aiContent');

  const h2hStr = h2h.found
    ? `Historial H2H: ${tA.name} ganó ${h2h.wA} veces, empates ${h2h.draws}, ${tB.name} ganó ${h2h.wB} veces.`
    : `No hay historial H2H significativo registrado entre estas selecciones.`;

  let extraText = "";
  if (userExtra && userExtra.use) {
    let exParts = [];
    if (userExtra.xgA) exParts.push(`xG Local (${tA.name}): ${userExtra.xgA}`);
    if (userExtra.xgB) exParts.push(`xG Visitante (${tB.name}): ${userExtra.xgB}`);
    if (userExtra.csA) exParts.push(`Prob. Valla Invicta Local (${tA.name}): ${userExtra.csA}%`);
    if (userExtra.csB) exParts.push(`Prob. Valla Invicta Visitante (${tB.name}): ${userExtra.csB}%`);
    if (userExtra.o25) exParts.push(`Prob. Más de 2.5 goles en total: ${userExtra.o25}%`);
    if (exParts.length > 0) {
      extraText = `\n\nDATOS ADICIONALES DEL ANALISTA (Variables Críticas a Ponderar):\n- ` + exParts.join('\n- ');
    }
  }

  const prompt = `Míster, acabo de correr una simulación en la web entre ${tA.name} y ${tB.name}.
Aquí tienes los datos completos calculados por la aplicación base web:

DATOS ESTADÍSTICOS Y CONTEXTUALES:
- xG esperado: ${tA.name} ${(+lA).toFixed(2)} | ${tB.name} ${(+lB).toFixed(2)}
- Jerarquía de plantel: ${tA.name} ${tA.squad}/10 | ${tB.name} ${tB.squad}/10
- Forma reciente (0-1): ${tA.name} ${tA.form} | ${tB.name} ${tB.form}
- ${h2hStr}

RESULTADOS DEL MOTOR BIVARIADO (Dixon-Coles + Intuición):
- Probabilidades 1X2: Local ${pA}% | Empate ${pD}% | Visitante ${pB}%
- Valla Invicta: ${tA.name} ${csA}% | ${tB.name} ${csB}%
- Más de 2.5 Goles: ${over25}% | Ambos Marcan: ${btts}%
- Los 5 Resultados Exactos Más Probables:
  1. ${top5[0].a}-${top5[0].b} (${top5[0].p.toFixed(1)}%)
  2. ${top5[1].a}-${top5[1].b} (${top5[1].p.toFixed(1)}%)
  3. ${top5[2].a}-${top5[2].b} (${top5[2].p.toFixed(1)}%)
  4. ${top5[3].a}-${top5[3].b} (${top5[3].p.toFixed(1)}%)
  5. ${top5[4].a}-${top5[4].b} (${top5[4].p.toFixed(1)}%)${extraText}

Por favor, necesito que hagas lo siguiente investigando en tiempo real:
1. Analiza el contexto de esta fase de eliminatoria directa (mata-mata). Determina si alguno de los equipos llega con ventaja física (más días de descanso tras la fase anterior), evalúa su historial reciente en tandas de penales (ya que un empate los llevará a prórroga) y qué equipo tiene más presión histórica para avanzar de ronda.
2. Lee las últimas noticias relevantes sobre el estado físico, lesiones o situación anímica/interna de ambos equipos.
3. Busca e investiga las probabilidades y cuotas reales actuales en prestigiosas casas de apuestas y Polymarket.

Finalmente, dame un análisis táctico completo en 3 párrafos y entrega DOS pronósticos finales:
- Pronóstico A (Estadístico Puro): Basado solo en la estadística del modelo, noticias, contexto de la eliminatoria y la intuición del analista, SIN considerar el mercado financiero.
- Pronóstico B (Mercado Ponderado): Integrando el pronóstico A con la "Sabiduría del Mercado" (casas de apuestas y Polymarket).`;

  navigator.clipboard.writeText(prompt).then(() => {
    aiBtn.textContent = "✅ ¡Prompt Copiado!";
    aiContent.innerHTML = `<p style="color:var(--green); text-align:center;"><strong>¡Copiado al portapapeles exitosamente!</strong><br><br>Ve a nuestra consola de Termux y pega este texto en el chat. Yo leeré los datos, haré la búsqueda en Polymarket y te daré el análisis gratis.</p><br><textarea readonly style="width:100%; height:180px; background:var(--surface); color:var(--text); padding:10px; border-radius:8px; border:1px solid var(--border);">${prompt}</textarea>`;
    aiCard.classList.add('visible');
    setTimeout(() => { aiBtn.textContent = "✨ Generar Prompt para mi IA Local"; }, 4000);
  }).catch(err => {
    aiContent.innerHTML = `<p style="color:var(--accent); text-align:center;">Tu navegador bloqueó el portapapeles. Copia este texto manualmente y pégalo en Termux:</p><br><textarea style="width:100%; height:180px; background:var(--surface); color:var(--text); padding:10px; border-radius:8px; border:1px solid var(--border);">${prompt}</textarea>`;
    aiCard.classList.add('visible');
  });
}

function copyAnalysis() {
  const text = document.getElementById('aiContent').innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✓ Copiado';
    setTimeout(() => { btn.innerHTML = '📋 Copiar'; }, 2000);
  });
}

// ─── MAIN PREDICTION ───────────────────────────────────────────────────────
function runPrediction() {
  const nameA = selA.value, nameB = selB.value;
  document.getElementById('errorMsg').classList.remove('visible');
  document.getElementById('aiCard').classList.remove('visible');
  document.getElementById('aiBtn').textContent = "✨ Generar Prompt para mi IA Local";
  document.getElementById('aiBtn').disabled = false;

  if (!nameA || !nameB) { showError('Por favor seleccioná los dos equipos.'); return; }
  if (nameA === nameB) { showError('Los dos equipos deben ser diferentes.'); return; }

  const tA = TEAMS.find(t => t.name === nameA);
  const tB = TEAMS.find(t => t.name === nameB);

  document.getElementById('predictBtn').disabled = true;
  document.getElementById('resultSection').classList.remove('visible');
  document.getElementById('loading').classList.add('visible');
  document.getElementById('loadingTeam').textContent = `${tA.flag} ${tA.name}  vs  ${tB.flag} ${tB.name}`;

  // ── MODELO COMPUESTO ────────────────────────────────────────────────────
  // 1) λ base desde xG (en cancha neutral: xG ofensivo * xGA defensivo del rival)
  let lA_base = tA.xg * tB.xga;
  let lB_base = tB.xg * tA.xga;

  // 2) Ajuste por forma reciente
  const ff = formFactor(tA.form, tB.form);
  lA_base *= ff.fA;
  lB_base *= ff.fB;

  // 3) Ajuste por jerarquía de plantel
  const sf = squadFactor(tA.squad, tB.squad);
  lA_base *= sf.fA;
  lB_base *= sf.fB;

  // 4) Ajuste por historial H2H
  const hf = h2hFactor(nameA, nameB);
  lA_base *= hf.fA;
  lB_base *= hf.fB;

  // Clamp mínimo
  const lA = Math.max(0.20, lA_base);
  const lB = Math.max(0.20, lB_base);

  const matrix = buildMatrix(lA, lB);

  let pA = 0, pB = 0, pD = 0;
  // Calcular base estadística (Poisson + Dixon-Coles)
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      const p = matrix[a][b];
      if (a > b) pA += p; else if (b > a) pB += p; else pD += p;
    }
  }

  // --- BLENDING AVANZADO ---
  const useUser = document.getElementById('userToggle').checked;
  
  let wUser = useUser ? (parseFloat(document.getElementById('userWeight').value) || 0) / 100 : 0;
  
  // Limitar pesos para no exceder el 100%
  if (wUser > 1) {
    wUser = 1;
  }
  const wStat = 1.0 - wUser;

  let final_pA = pA * wStat;
  let final_pD = pD * wStat;
  let final_pB = pB * wStat;

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

  // Factores para proyectar a la matriz de Dixon-Coles
  const factorA = pA > 0 ? final_pA / pA : 0;
  const factorD = pD > 0 ? final_pD / pD : 0;
  const factorB = pB > 0 ? final_pB / pB : 0;

  let maxPct = 0, maxI = 0, maxJ = 0;
  const allScores = [];
  
  // Aplicar blending escalando las celdas de Dixon-Coles
  for (let a = 0; a <= 5; a++) {
    for (let b = 0; b <= 5; b++) {
      let p = matrix[a][b];
      if (a > b) p *= factorA; else if (b > a) p *= factorB; else p *= factorD;
      matrix[a][b] = p;
      allScores.push({ a, b, p });
      if (p > maxPct) { maxPct = p; maxI = a; maxJ = b; }
    }
  }

  pA = final_pA; pD = final_pD; pB = final_pB;
  const top3 = [...allScores].sort((x,y) => y.p - x.p).slice(0, 3);
  const top5 = [...allScores].sort((x,y) => y.p - x.p).slice(0, 5);
  const btts   = allScores.filter(s => s.a > 0 && s.b > 0).reduce((acc,s) => acc+s.p, 0);
  const over25 = allScores.filter(s => s.a+s.b > 2).reduce((acc,s) => acc+s.p, 0);
  const csA    = allScores.filter(s => s.b === 0).reduce((acc,s) => acc+s.p, 0);
  const csB    = allScores.filter(s => s.a === 0).reduce((acc,s) => acc+s.p, 0);
  const h2h    = getH2H(nameA, nameB);

  const userExtra = {
    use: document.getElementById('userToggle').checked,
    xgA: document.getElementById('userXgA').value,
    xgB: document.getElementById('userXgB').value,
    csA: document.getElementById('userCsA').value,
    csB: document.getElementById('userCsB').value,
    o25: document.getElementById('userOver25').value
  };

  currentMatchData = {
    tA, tB,
    pA: pA.toFixed(1), pD: pD.toFixed(1), pB: pB.toFixed(1),
    maxI, maxJ, lA: lA.toFixed(3), lB: lB.toFixed(3),
    h2h, squadF: sf, formF: ff, userExtra,
    top5, btts: btts.toFixed(1), over25: over25.toFixed(1), csA: csA.toFixed(1), csB: csB.toFixed(1)
  };

  setTimeout(() => {
    renderResults(tA, tB, matrix, pA, pD, pB, lA, lB, maxPct, maxI, maxJ, top3, btts, over25, csA, h2h, sf, ff);
    document.getElementById('loading').classList.remove('visible');
    document.getElementById('predictBtn').disabled = false;
  }, 500);
}

function renderResults(tA, tB, matrix, pA, pD, pB, lA, lB, maxPct, maxI, maxJ, top3, btts, over25, csA, h2h, sf, ff) {

  // ── MATCH HEADER ──────────────────────────────────────────────────────
  const dominant = pA > pB ? tA.name : pB > pA ? tB.name : 'Parejo';
  document.getElementById('matchHeader').innerHTML = `
    <div class="team-info">
      <span class="team-flag">${tA.flag}</span>
      <div class="team-name">${tA.name}</div>
      <div class="team-confed">${tA.confed}</div>
      <div class="team-rating" style="color:var(--accent2)">
        λ ${lA.toFixed(2)} goles esp.
      </div>
    </div>
    <div class="match-center">
      <div class="vs-text">VS</div>
      <div class="match-badge">Mundial 2026</div>
      <div class="neutral-badge">⚖️ Cancha Neutral</div>
    </div>
    <div class="team-info">
      <span class="team-flag">${tB.flag}</span>
      <div class="team-name">${tB.name}</div>
      <div class="team-confed">${tB.confed}</div>
      <div class="team-rating" style="color:var(--accent)">
        λ ${lB.toFixed(2)} goles esp.
      </div>
    </div>
  `;

  // ── H2H BAR ───────────────────────────────────────────────────────────
  const h2hEl = document.getElementById('h2hCard');
  if (h2h.found) {
    const total = h2h.wA + h2h.draws + h2h.wB;
    const pctA = (h2h.wA / total * 100).toFixed(0);
    const pctD = (h2h.draws / total * 100).toFixed(0);
    const pctB = (h2h.wB / total * 100).toFixed(0);
    const lastStr = h2h.lastAdv > 0 ? `Último partido: ganó ${tA.name}` :
                    h2h.lastAdv < 0 ? `Último partido: ganó ${tB.name}` : 'Último partido: empate';
    h2hEl.innerHTML = `
      <div class="h2h-title">⚔️ Historial de enfrentamientos (${total} partidos)</div>
      <div class="h2h-bar-wrap">
        <div class="h2h-team">${tA.flag} ${tA.name} <span style="color:var(--accent2)">${h2h.wA}</span></div>
        <div class="h2h-bar">
          <div class="h2h-seg-a" style="width:${pctA}%"></div>
          <div class="h2h-seg-d" style="width:${pctD}%"></div>
          <div class="h2h-seg-b" style="width:${pctB}%"></div>
        </div>
        <div class="h2h-team right"><span style="color:var(--accent)">${h2h.wB}</span> ${tB.name} ${tB.flag}</div>
      </div>
      <div class="h2h-counts">
        <span class="wins-a">${pctA}% victorias</span>
        <span class="draws">${h2h.draws} empates</span>
        <span class="wins-b">${pctB}% victorias</span>
      </div>
      <div class="h2h-note">📌 ${lastStr}</div>
    `;
    h2hEl.style.display = '';
  } else {
    h2hEl.innerHTML = `<div class="h2h-title">⚔️ Historial de enfrentamientos</div>
      <div class="h2h-note" style="margin-top:0">Sin historial H2H significativo registrado. El modelo usa solo xG, forma y plantel.</div>`;
    h2hEl.style.display = '';
  }

  // ── TEAM PROFILES ─────────────────────────────────────────────────────
  const formPct = v => (v * 100).toFixed(0) + '%';
  document.getElementById('profileStrip').innerHTML = `
    <div class="profile-card">
      <h4>${tA.flag} ${tA.name}</h4>
      ${attrBar('xG por partido', tA.xg, 2.5, 'var(--accent2)')}
      ${attrBar('xGA concedido', tA.xga, 2.0, '#e05c3a')}
      ${attrBar('Forma reciente', tA.form, 1.0, 'var(--green)')}
      ${attrBar('Jerarquía plantel', tA.squad, 10, 'var(--gold)')}
    </div>
    <div class="profile-card">
      <h4>${tB.flag} ${tB.name}</h4>
      ${attrBar('xG por partido', tB.xg, 2.5, 'var(--accent2)')}
      ${attrBar('xGA concedido', tB.xga, 2.0, '#e05c3a')}
      ${attrBar('Forma reciente', tB.form, 1.0, 'var(--green)')}
      ${attrBar('Jerarquía plantel', tB.squad, 10, 'var(--gold)')}
    </div>
  `;

  // ── TOP 3 SCORES ──────────────────────────────────────────────────────
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('topScores').innerHTML = top3.map((s,i) => `
    <div class="score-card ${i===0?'top1':''}">
      <div class="rank">${medals[i]} Resultado #${i+1}</div>
      <div class="score-val">${s.a} – ${s.b}</div>
      <div class="score-pct">${s.p.toFixed(2)}% de probabilidad</div>
    </div>
  `).join('');

  // ── PROB BARS ─────────────────────────────────────────────────────────
  document.getElementById('probBars').innerHTML = `
    <div class="prob-bar-card teamA">
      <div class="label">${tA.flag} ${tA.name}</div>
      <div class="value">${pA.toFixed(1)}%</div>
      <div class="sub">Probabilidad de ganar</div>
      <div class="prob-fill-track"><div class="prob-fill" style="width:${pA.toFixed(1)}%"></div></div>
    </div>
    <div class="prob-bar-card draw">
      <div class="label">Empate</div>
      <div class="value">${pD.toFixed(1)}%</div>
      <div class="sub">Después de 90 minutos</div>
      <div class="prob-fill-track"><div class="prob-fill" style="width:${pD.toFixed(1)}%"></div></div>
    </div>
    <div class="prob-bar-card teamB">
      <div class="label">${tB.flag} ${tB.name}</div>
      <div class="value">${pB.toFixed(1)}%</div>
      <div class="sub">Probabilidad de ganar</div>
      <div class="prob-fill-track"><div class="prob-fill" style="width:${pB.toFixed(1)}%"></div></div>
    </div>
  `;

  // ── STATS STRIP ───────────────────────────────────────────────────────
  document.getElementById('statsStrip').innerHTML = `
    <div class="stat-box">
      <div class="s-label">Goles totales esp.</div>
      <div class="s-val" style="color:var(--accent2)">${(lA+lB).toFixed(2)}</div>
      <div class="s-sub">por partido</div>
    </div>
    <div class="stat-box">
      <div class="s-label">Ambos anotan</div>
      <div class="s-val" style="color:var(--green)">${btts.toFixed(1)}%</div>
      <div class="s-sub">prob. BTTS</div>
    </div>
    <div class="stat-box">
      <div class="s-label">Más de 2.5 goles</div>
      <div class="s-val" style="color:var(--gold)">${over25.toFixed(1)}%</div>
      <div class="s-sub">prob. Over 2.5</div>
    </div>
    <div class="stat-box">
      <div class="s-label">Valla invicta ${tA.name}</div>
      <div class="s-val" style="color:var(--text-muted)">${csA.toFixed(1)}%</div>
      <div class="s-sub">Clean sheet</div>
    </div>
  `;

  // ── MATRIX ────────────────────────────────────────────────────────────
  let mhtml = `
    <div class="section-title"><div class="dot"></div>Matriz de probabilidad por resultado exacto (%)</div>
    <div class="matrix-legend">
      <div class="legend-item"><div class="legend-swatch" style="background:#b83220"></div>Muy alta</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#8a2416"></div>Alta</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#2a6880"></div>Media</div>
      <div class="legend-item"><div class="legend-swatch" style="background:#1f3f54"></div>Baja</div>
      <div class="legend-item"><div class="legend-swatch" style="background:rgba(240,180,41,.15);border:1.5px solid var(--gold)"></div>Más probable ⭐</div>
    </div>
    <div class="axis-label-x">${tB.flag} ${tB.name} (goles) →</div>
    <div class="axis-label-y-wrap">
      <div class="axis-label-y">↑ ${tA.flag} ${tA.name} (goles)</div>
      <div style="overflow-x:auto">
      <table class="matrix">
        <thead><tr>
          <th style="font-size:9px;color:var(--text-muted)">A↓ / B→</th>
          ${[0,1,2,3,4,5].map(n=>`<th>${n}</th>`).join('')}
        </tr></thead>
        <tbody>`;

  for (let a = 0; a <= 5; a++) {
    mhtml += `<tr><th>${a}</th>`;
    for (let b = 0; b <= 5; b++) {
      const pct = matrix[a][b];
      const cls = getCellClass(pct, maxPct);
      const hl  = (a===maxI && b===maxJ) ? ' highlighted' : '';
      mhtml += `<td class="${cls}${hl}" title="${a}–${b}: ${pct.toFixed(2)}%">
        <span class="pct">${pct.toFixed(2)}</span>
        <span class="score">${a}–${b}</span>
      </td>`;
    }
    mhtml += `</tr>`;
  }
  mhtml += `</tbody></table></div></div>`;
  document.getElementById('matrixWrapper').innerHTML = mhtml;

  // ── MODEL EXPLAINER ───────────────────────────────────────────────────
  const formImpact = ((ff.fA - 1) * 100).toFixed(1);
  const squadImpact = ((sf.fA - 1) * 100).toFixed(1);
  const h2hImpact = h2h.found ? ((h2h.wA/(h2h.wA+h2h.draws+h2h.wB)*100 - 33).toFixed(0) + '% win rate hist.') : 'sin datos';

  const useUser = document.getElementById('userToggle').checked;
  let wU = useUser ? (parseFloat(document.getElementById('userWeight').value) || 0) : 0;
  if (wU > 100) { wU = 100; }
  let wS = 100 - wU;

  let extraExplanation = "";
  let extraChips = "";
  if (useUser) {
    extraExplanation = ` Además, los resultados finales fueron escalados matemáticamente para integrar la intuición humana, conservando sin romper la distribución de empates hipergeométrica de Dixon-Coles.`;
    extraChips += `<div class="weight-chip">Míster (Analista) <span style="color:var(--accent2)">${wU.toFixed(1)}%</span> peso maestro</div>`;
    extraChips += `<div class="weight-chip">Motor Estadístico IA <span style="color:var(--green)">${wS.toFixed(1)}%</span> peso restante</div>`;
  }

  document.getElementById('modelExplainer').innerHTML = `
    <strong>🔬 Cómo se calculó este resultado:</strong> El modelo cruza el xG de cada equipo con la solidez defensiva del rival. Luego aplica 3 ajustes dinámicos y finalmente procesa la matriz con el <strong>algoritmo bivariado de Dixon-Coles</strong> (ρ = -0.15) para corregir la dependencia estadística y calcular los empates con alta precisión.${extraExplanation}
    <div class="model-weights">
      <div class="weight-chip">xG base <span style="color:var(--accent2)">${(W.xg*100).toFixed(0)}%</span> peso estadístico</div>
      <div class="weight-chip">Forma reciente <span style="color:var(--green)">${(W.form*100).toFixed(0)}%</span> peso estadístico — impacto ${formImpact}% en λ de ${tA.name}</div>
      <div class="weight-chip">Jerarquía plantel <span style="color:var(--gold)">${(W.squad*100).toFixed(0)}%</span> peso estadístico — impacto ${squadImpact}% en λ</div>
      <div class="weight-chip">Historial H2H <span style="color:var(--purple)">${(W.h2h*100).toFixed(0)}%</span> peso estadístico — ${h2hImpact}</div>
      ${extraChips}
    </div>
  `;

  document.getElementById('resultSection').classList.add('visible');
  setTimeout(() => document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = '⚠️ ' + msg;
  el.classList.add('visible');
}