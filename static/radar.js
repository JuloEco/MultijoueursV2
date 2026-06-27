// ============================================================
// RADAR PING — duel de sous-marins, 2 joueurs locaux
// Phases : placement → sonar alternés → torpille → victoire
// ============================================================

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const CW = canvas.width;   // 840
const CH = canvas.height;  // 560

// ─── Grille ──────────────────────────────────────────────────
const GRID_COLS  = 10;
const GRID_ROWS  = 10;
const CELL       = 42;                   // taille d'une case px
const GRID_W     = GRID_COLS * CELL;     // 420
const GRID_H     = GRID_ROWS * CELL;     // 420
const GAP        = 40;                   // espace entre les deux grilles
const G1_X       = (CW - GRID_W * 2 - GAP) / 2;  // grille gauche X
const G2_X       = G1_X + GRID_W + GAP;           // grille droite X
const GRID_Y     = (CH - GRID_H) / 2;

const MAX_PINGS_PER_TURN = 2;
const MAX_TORPS          = 3;
const SUB_SIZE           = 2;  // sous-marin occupe 2 cases (horizontal)

// ─── Couleurs ────────────────────────────────────────────────
const C = {
  p1: "#d6543c", p1dim: "#6b3326", p1glow: "rgba(214,84,60,",
  p2: "#4f8fae", p2dim: "#2c4956", p2glow: "rgba(79,143,174,",
  phosphor: "#8fb33f", phosphorDim: "#5c7330",
  bg: "#11140f", surface: "#171c14",
  grid: "#232a1c", gridLine: "#3a4530",
  water: "#0d1a22", waterDeep: "#070e14",
  ping: "rgba(143,179,63,",
  hit:  "#f2a640",
  miss: "#3a4530",
};

// ─── État ────────────────────────────────────────────────────
// phases : "place_p1" → "place_p2" → "turn_p1" → "turn_p2" → (repeat) → "gameover"
let phase        = "place_p1";
let subs         = [null, null];    // {col, row} position du sous-marin (2 cases)
let pings        = [[], []];        // [{col,row,dist}] — historique des pings de chaque joueur
let torps        = [[], []];        // [{col,row,hit}]  — torpilles tirées
let torpsLeft    = [MAX_TORPS, MAX_TORPS];
let pingsThisTurn= 0;
let hasFiredTorp = false;
let ripples      = [];              // animations d'anneaux sonar
let explosions   = [];             // animations d'impacts
let hoverCell    = null;            // {grid:0|1, col, row}

// ─── Init ────────────────────────────────────────────────────
function resetRound() {
  phase         = "place_p1";
  subs          = [null, null];
  pings         = [[], []];
  torps         = [[], []];
  torpsLeft     = [MAX_TORPS, MAX_TORPS];
  pingsThisTurn = 0;
  hasFiredTorp  = false;
  ripples       = [];
  explosions    = [];
  hoverCell     = null;
  updateHUD();
  updatePhaseLabel();
}

// ─── Coordonnées ─────────────────────────────────────────────
function gridOrigin(gridIdx) {
  return { x: gridIdx === 0 ? G1_X : G2_X, y: GRID_Y };
}

function cellFromMouse(mx, my) {
  for (let g = 0; g < 2; g++) {
    const { x, y } = gridOrigin(g);
    const col = Math.floor((mx - x) / CELL);
    const row = Math.floor((my - y) / CELL);
    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      return { grid: g, col, row };
    }
  }
  return null;
}

// ─── Interactions souris ─────────────────────────────────────
canvas.addEventListener("mousemove", e => {
  const r   = canvas.getBoundingClientRect();
  const scaleX = CW / r.width;
  const scaleY = CH / r.height;
  hoverCell = cellFromMouse((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
});
canvas.addEventListener("mouseleave", () => { hoverCell = null; });

canvas.addEventListener("click", e => {
  const r   = canvas.getBoundingClientRect();
  const scaleX = CW / r.width;
  const scaleY = CH / r.height;
  const cell = cellFromMouse((e.clientX - r.left) * scaleX, (e.clientY - r.top) * scaleY);
  if (!cell) return;
  handleClick(cell);
});

function handleClick({ grid, col, row }) {
  // ── PLACEMENT ──
  if (phase === "place_p1" || phase === "place_p2") {
    const pIdx = phase === "place_p1" ? 0 : 1;
    // Le joueur pose son sous-marin sur sa propre grille
    if (grid !== pIdx) return;
    // Vérifie que les 2 cases sont disponibles
    if (col + SUB_SIZE - 1 >= GRID_COLS) return;
    subs[pIdx] = { col, row };
    phase = pIdx === 0 ? "place_p2" : "turn_p1";
    pingsThisTurn = 0;
    hasFiredTorp  = false;
    updateHUD();
    updatePhaseLabel();
    return;
  }

  // ── TOUR ──
  const currentIdx = phase === "turn_p1" ? 0 : 1;
  const enemyIdx   = 1 - currentIdx;
  const enemyGrid  = enemyIdx; // chaque joueur joue sur la grille adverse

  // Le joueur ne peut cliquer que sur la grille ennemie
  if (grid !== enemyGrid) return;

  // Torpille ?
  if (hasFiredTorp) return; // déjà tirée ce tour

  if (pingsThisTurn < MAX_PINGS_PER_TURN) {
    // ── PING SONAR ──
    // Vérifie qu'on n'a pas déjà pingué cette case
    if (pings[currentIdx].some(p => p.col === col && p.row === row)) return;

    const sub  = subs[enemyIdx];
    // Distance au centre du sous-marin (2 cases)
    const subCX = sub.col + (SUB_SIZE - 1) / 2;
    const subCY = sub.row;
    const dist  = Math.round(Math.hypot(col - subCX, row - subCY));

    pings[currentIdx].push({ col, row, dist });
    pingsThisTurn++;

    // Ripple visuel
    const { x: gx, y: gy } = gridOrigin(enemyGrid);
    ripples.push({
      x: gx + (col + 0.5) * CELL,
      y: gy + (row + 0.5) * CELL,
      r: 0, maxR: (dist + 0.5) * CELL,
      alpha: 1, speed: 3,
    });
    updateHUD();

  } else {
    // ── TORPILLE ──
    if (torpsLeft[currentIdx] <= 0) { endTurn(); return; }
    // Vérifie déjà tiré là
    if (torps[currentIdx].some(t => t.col === col && t.row === row)) return;

    const sub = subs[enemyIdx];
    // Hit si la case fait partie du sous-marin (col..col+SIZE-1, row)
    const hit = (row === sub.row && col >= sub.col && col < sub.col + SUB_SIZE);

    torps[currentIdx].push({ col, row, hit });
    torpsLeft[currentIdx]--;
    hasFiredTorp = true;

    // Animation explosion ou miss
    const { x: gx, y: gy } = gridOrigin(enemyGrid);
    if (hit) {
      for (let i = 0; i < 14; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 3.5;
        explosions.push({
          x: gx + (col + 0.5) * CELL, y: gy + (row + 0.5) * CELL,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 1.5,
          life: 1, r: 2 + Math.random() * 4, color: "#f2a640",
        });
      }
      // Vérifie si les deux cases du sous-marin sont touchées
      const allHit = [0, 1].every(dc =>
        torps[currentIdx].some(t => t.col === sub.col + dc && t.row === sub.row && t.hit)
      );
      if (allHit) {
        setTimeout(() => endRound(currentIdx === 0 ? "player1" : "player2"), 700);
        return;
      }
    }

    // Plus de torpilles des deux côtés → nul (relance)
    if (torpsLeft[0] <= 0 && torpsLeft[1] <= 0) {
      setTimeout(() => endRound(null), 600);
      return;
    }

    updateHUD();
    setTimeout(() => endTurn(), 500);
  }
}

function endTurn() {
  pingsThisTurn = 0;
  hasFiredTorp  = false;
  phase = phase === "turn_p1" ? "turn_p2" : "turn_p1";
  updateHUD();
  updatePhaseLabel();

  // Overlay "passez le clavier" entre les tours
  showPassOverlay();
}

function endRound(winnerKey) {
  const title = document.getElementById("overlay-title");
  const sub   = document.getElementById("overlay-sub");
  if (winnerKey === "player1") {
    title.textContent = "J1 ROUGE GAGNE"; title.style.color = C.p1;
    sub.textContent   = "Sous-marin bleu coulé !";
  } else if (winnerKey === "player2") {
    title.textContent = "J2 BLEU GAGNE"; title.style.color = C.p2;
    sub.textContent   = "Sous-marin rouge coulé !";
  } else {
    title.textContent = "MATCH NUL !"; title.style.color = C.phosphor;
    sub.textContent   = "Plus de torpilles des deux côtés.";
  }
  document.getElementById("overlay").removeAttribute("hidden");
  if (winnerKey) recordResult(winnerKey);
}

// ─── Overlay "Passez le clavier" ────────────────────────────
let passOverlay = null;
function showPassOverlay() {
  if (!passOverlay) {
    passOverlay = document.createElement("div");
    passOverlay.style.cssText =
      "position:fixed;inset:0;background:rgba(10,12,8,0.94);display:flex;" +
      "align-items:center;justify-content:center;z-index:100;font-family:monospace;";
    passOverlay.innerHTML = `
      <div style="text-align:center;border:1px solid #3a4530;background:#11140f;padding:32px 48px;max-width:400px">
        <h2 id="pass-title" style="font-size:18px;letter-spacing:2px;margin-bottom:12px;color:#8fb33f">AU TOUR DE J2</h2>
        <p style="color:#5c7330;font-size:12px;margin-bottom:20px">Passez l'écran à l'autre joueur.<br>Fermez les yeux !</p>
        <button id="pass-btn" style="font-family:monospace;background:#8fb33f;color:#11140f;border:none;padding:10px 22px;font-size:12px;letter-spacing:2px;font-weight:700;cursor:pointer;">PRÊT →</button>
      </div>`;
    document.body.appendChild(passOverlay);
    passOverlay.querySelector("#pass-btn").addEventListener("click", () => {
      passOverlay.style.display = "none";
    });
  }
  const isP1Turn = phase === "turn_p1";
  passOverlay.querySelector("#pass-title").textContent =
    isP1Turn ? "AU TOUR DE J1 ROUGE" : "AU TOUR DE J2 BLEU";
  passOverlay.querySelector("#pass-title").style.color = isP1Turn ? C.p1 : C.p2;
  passOverlay.style.display = "flex";
}

// ─── Rendu ──────────────────────────────────────────────────
function render() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  drawGrid(0);
  drawGrid(1);
  drawLabels();
  drawRipples();
  drawPings();
  drawTorps();
  drawSubs();
  drawHover();
  drawExplosions();
  updateRipples();
  updateExplosions();
}

function drawGrid(gIdx) {
  const { x: ox, y: oy } = gridOrigin(gIdx);

  // Fond eau
  const wg = ctx.createLinearGradient(ox, oy, ox, oy + GRID_H);
  wg.addColorStop(0, C.water);
  wg.addColorStop(1, C.waterDeep);
  ctx.fillStyle = wg;
  ctx.fillRect(ox, oy, GRID_W, GRID_H);

  // Lignes de grille
  ctx.strokeStyle = C.gridLine;
  ctx.lineWidth   = 0.8;
  for (let c = 0; c <= GRID_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(ox + c * CELL, oy);
    ctx.lineTo(ox + c * CELL, oy + GRID_H);
    ctx.stroke();
  }
  for (let r = 0; r <= GRID_ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + r * CELL);
    ctx.lineTo(ox + GRID_W, oy + r * CELL);
    ctx.stroke();
  }

  // Bordure
  ctx.strokeStyle = "#3a4530";
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(ox, oy, GRID_W, GRID_H);
}

function drawLabels() {
  ctx.font      = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = C.p1;
  ctx.fillText("GRILLE J1 ROUGE", G1_X + GRID_W / 2, GRID_Y - 12);
  ctx.fillStyle = C.p2;
  ctx.fillText("GRILLE J2 BLEU",  G2_X + GRID_W / 2, GRID_Y - 12);
  ctx.textAlign = "left";
}

function drawSubs() {
  // Affiche les sous-marins :
  // - le joueur actif voit toujours SON sous-marin
  // - l'adversaire ne voit pas le sien (brouillard)
  // En phase gameover, révèle tout
  const isGameover = document.getElementById("overlay").getAttribute("hidden") === null
    ? false : !document.getElementById("overlay").hasAttribute("hidden");

  for (let i = 0; i < 2; i++) {
    if (!subs[i]) continue;

    // Règle de visibilité selon la phase
    const isCurrentPlayer = (phase === "turn_p1" && i === 0) || (phase === "turn_p2" && i === 1)
      || phase === "place_p1" || phase === "place_p2";
    const visible = isGameover || (phase.startsWith("place") && i === (phase === "place_p1" ? 0 : 1))
      || false; // pendant les tours, le sous-marin est caché

    // Toujours visible sur ta propre grille si c'est ton tour de placement
    const ownPlacement = (phase === "place_p1" && i === 0) || (phase === "place_p2" && i === 1);

    // Révélé si torpillé
    const allHitByEnemy = [0, 1].every(dc =>
      torps[1 - i].some(t => t.col === subs[i].col + dc && t.row === subs[i].row && t.hit)
    );

    if (!ownPlacement && !allHitByEnemy && !isGameover) continue;

    const { x: ox, y: oy } = gridOrigin(i);
    const { col, row } = subs[i];
    const color = i === 0 ? C.p1 : C.p2;

    ctx.fillStyle   = allHitByEnemy ? "#888" : color;
    ctx.strokeStyle = allHitByEnemy ? "#555" : (i === 0 ? C.p1dim : C.p2dim);
    ctx.lineWidth   = 2;
    const sx = ox + col * CELL + 3;
    const sy = oy + row * CELL + 3;
    const sw = CELL * SUB_SIZE - 6;
    const sh = CELL - 6;
    // Corps
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, 6);
    ctx.fill();
    ctx.stroke();
    // Hublot
    ctx.fillStyle = allHitByEnemy ? "#444" : "#0a0c08";
    ctx.beginPath();
    ctx.arc(sx + sw - 12, sy + sh / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    // Périscope
    ctx.strokeStyle = allHitByEnemy ? "#555" : color;
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(sx + sw * 0.35, sy);
    ctx.lineTo(sx + sw * 0.35, sy - 10);
    ctx.lineTo(sx + sw * 0.35 + 8, sy - 10);
    ctx.stroke();
  }
}

function drawPings() {
  // Affiche les résultats de ping de chaque joueur sur la grille ennemie
  for (let i = 0; i < 2; i++) {
    const enemyGrid = 1 - i;
    const { x: ox, y: oy } = gridOrigin(enemyGrid);
    pings[i].forEach(({ col, row, dist }) => {
      const cx = ox + (col + 0.5) * CELL;
      const cy = oy + (row + 0.5) * CELL;
      // Centre du ping
      ctx.fillStyle   = C.phosphor + "88";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      // Distance textuelle
      ctx.fillStyle   = C.phosphor;
      ctx.font        = "bold 9px monospace";
      ctx.textAlign   = "center";
      ctx.fillText(`~${dist}`, cx, cy + CELL * 0.38);
      ctx.textAlign   = "left";
    });
  }
}

function drawTorps() {
  for (let i = 0; i < 2; i++) {
    const enemyGrid = 1 - i;
    const { x: ox, y: oy } = gridOrigin(enemyGrid);
    torps[i].forEach(({ col, row, hit }) => {
      const cx = ox + (col + 0.5) * CELL;
      const cy = oy + (row + 0.5) * CELL;
      if (hit) {
        // Case touchée — croix rouge + halo
        ctx.fillStyle = "rgba(242,166,64,0.22)";
        ctx.fillRect(ox + col * CELL, oy + row * CELL, CELL, CELL);
        ctx.strokeStyle = C.hit;
        ctx.lineWidth   = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy - 10); ctx.lineTo(cx + 10, cy + 10);
        ctx.moveTo(cx + 10, cy - 10); ctx.lineTo(cx - 10, cy + 10);
        ctx.stroke();
      } else {
        // Case manquée — point gris
        ctx.fillStyle = C.miss + "bb";
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

function drawRipples() {
  ripples.forEach(rp => {
    ctx.strokeStyle = C.ping + rp.alpha + ")";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

function updateRipples() {
  ripples.forEach(rp => {
    rp.r     = Math.min(rp.r + rp.speed, rp.maxR);
    rp.alpha = Math.max(0, 1 - rp.r / rp.maxR);
  });
  ripples = ripples.filter(rp => rp.alpha > 0.02);
}

function drawExplosions() {
  explosions.forEach(e => {
    ctx.globalAlpha = e.life;
    ctx.fillStyle   = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function updateExplosions() {
  explosions.forEach(e => {
    e.x += e.vx; e.y += e.vy; e.vy += 0.12;
    e.life -= 0.035; e.vx *= 0.97;
  });
  explosions = explosions.filter(e => e.life > 0);
}

function drawHover() {
  if (!hoverCell) return;
  const { grid, col, row } = hoverCell;
  const { x: ox, y: oy }   = gridOrigin(grid);

  const currentIdx = phase === "turn_p1" ? 0 : 1;
  const enemyGrid  = 1 - currentIdx;

  // Placement
  if ((phase === "place_p1" && grid === 0) || (phase === "place_p2" && grid === 1)) {
    const color = grid === 0 ? C.p1 : C.p2;
    ctx.fillStyle   = color + "33";
    ctx.strokeStyle = color + "88";
    ctx.lineWidth   = 1.5;
    const validCol = Math.min(col, GRID_COLS - SUB_SIZE);
    ctx.fillRect(ox + validCol * CELL, oy + row * CELL, CELL * SUB_SIZE, CELL);
    ctx.strokeRect(ox + validCol * CELL, oy + row * CELL, CELL * SUB_SIZE, CELL);
    return;
  }

  // Tour — grille ennemie uniquement
  if (!phase.startsWith("turn")) return;
  if (grid !== enemyGrid) return;

  const color = currentIdx === 0 ? C.p1 : C.p2;
  ctx.fillStyle = color + "22";
  ctx.fillRect(ox + col * CELL, oy + row * CELL, CELL, CELL);
  ctx.strokeStyle = color + "66";
  ctx.lineWidth   = 1;
  ctx.strokeRect(ox + col * CELL, oy + row * CELL, CELL, CELL);
}

// ─── HUD / Phase ────────────────────────────────────────────
function updateHUD() {
  document.getElementById("torps-p1").textContent = torpsLeft[0];
  document.getElementById("torps-p2").textContent = torpsLeft[1];

  const currentIdx = phase === "turn_p1" ? 0 : (phase === "turn_p2" ? 1 : -1);
  const pLeft = currentIdx >= 0 ? MAX_PINGS_PER_TURN - pingsThisTurn : "∞";
  document.getElementById("pings-p1").textContent =
    currentIdx === 0 ? pLeft : (currentIdx === 1 ? "—" : "∞");
  document.getElementById("pings-p2").textContent =
    currentIdx === 1 ? pLeft : (currentIdx === 0 ? "—" : "∞");
}

function updatePhaseLabel() {
  const labels = {
    place_p1: "PLACEMENT · J1 ROUGE",
    place_p2: "PLACEMENT · J2 BLEU",
    turn_p1:  "TOUR DE J1 · PING OU TORPILLE",
    turn_p2:  "TOUR DE J2 · PING OU TORPILLE",
    gameover: "FIN DE PARTIE",
  };
  const colors = {
    place_p1: C.p1, place_p2: C.p2,
    turn_p1:  C.p1, turn_p2:  C.p2,
    gameover: C.phosphor,
  };
  const lbl = document.getElementById("phase-label");
  lbl.textContent  = labels[phase] || phase;
  lbl.style.color  = colors[phase] || C.phosphor;
}

// ─── API scores ──────────────────────────────────────────────
async function recordResult(winnerKey) {
  try {
    const r = await fetch("/api/scores/radar/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner: winnerKey }),
    });
    const s = await r.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

async function loadScores() {
  try {
    const r = await fetch("/api/scores/radar");
    const s = await r.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

// ─── Boutons ────────────────────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("overlay-start").setAttribute("hidden", "");
  resetRound();
  if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("overlay").setAttribute("hidden", "");
  if (passOverlay) passOverlay.style.display = "none";
  resetRound();
});

// ─── Boucle principale ───────────────────────────────────────
let loopStarted = false;
function tick() {
  render();
  requestAnimationFrame(tick);
}

render();
loadScores();
