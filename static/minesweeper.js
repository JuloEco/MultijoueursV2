// ============================================================
// MINESWEEPER DUEL — deux grilles identiques, jeu simultané
// Clic gauche = révéler · Clic droit = drapeau
// Premier à révéler toutes les cases sûres gagne.
// Toucher une mine = défaite immédiate.
// ============================================================

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const CW = canvas.width;   // 860
const CH = canvas.height;  // 560

// ─── Paramètres de grille ────────────────────────────────────
const COLS      = 12;
const ROWS      = 10;
const MINE_COUNT= 18;
const CELL      = 38;
const GAP       = 40;
const GRID_W    = COLS * CELL;
const GRID_H    = ROWS * CELL;
const G1_X      = (CW - GRID_W * 2 - GAP) / 2;
const G2_X      = G1_X + GRID_W + GAP;
const GRID_Y    = (CH - GRID_H) / 2;

// ─── Couleurs ────────────────────────────────────────────────
const C = {
  p1: "#d6543c", p1dim: "#6b3326",
  p2: "#4f8fae", p2dim: "#2c4956",
  phosphor: "#8fb33f", phosphorDim: "#5c7330",
  bg: "#11140f", surface: "#171c14",
  hidden: "#232a1c", hiddenEdge: "#3a4530",
  revealed: "#131810", revealedEdge: "#1e2a18",
  flagColor: "#e8d77a",
  mine: "#e05020",
  numColors: ["","#4f8fae","#8fb33f","#d6543c","#6b3326","#b06030","#5c7330","#888","#aaa"],
};

// ─── État ────────────────────────────────────────────────────
let grids;        // [grid1, grid2] — chaque grid = tableau COLS×ROWS de cellules
let gameState = "idle";
let explosions = [];
let hoverCell  = null;

// Cellule : { mine, adj, revealed, flagged }
function makeGrid(mineLayout) {
  const grid = [];
  for (let c = 0; c < COLS; c++) {
    grid.push([]);
    for (let r = 0; r < ROWS; r++) {
      grid[c].push({ mine: mineLayout[c][r], adj: 0, revealed: false, flagged: false });
    }
  }
  // Calcule les adjacences
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      if (grid[c][r].mine) continue;
      let n = 0;
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) {
          const nc = c + dc, nr = r + dr;
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && grid[nc][nr].mine) n++;
        }
      grid[c][r].adj = n;
    }
  }
  return grid;
}

function generateMineLayout() {
  const layout = Array(COLS).fill(null).map(() => Array(ROWS).fill(false));
  let placed = 0;
  while (placed < MINE_COUNT) {
    const c = Math.floor(Math.random() * COLS);
    const r = Math.floor(Math.random() * ROWS);
    if (!layout[c][r]) { layout[c][r] = true; placed++; }
  }
  return layout;
}

function resetRound() {
  const layout = generateMineLayout();
  grids        = [makeGrid(layout), makeGrid(layout)]; // identiques !
  explosions   = [];
  hoverCell    = null;
  gameState    = "playing";
  updateHUD();
}

// ─── Compteurs ───────────────────────────────────────────────
function safeLeft(grid) {
  let n = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (!grid[c][r].mine && !grid[c][r].revealed) n++;
  return n;
}

function minesLeft(grid) {
  let flags = 0;
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r].flagged) flags++;
  return MINE_COUNT - flags;
}

// ─── Révélation en cascade (flood fill) ─────────────────────
function reveal(grid, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const cell = grid[col][row];
  if (cell.revealed || cell.flagged) return;
  cell.revealed = true;
  if (!cell.mine && cell.adj === 0) {
    for (let dc = -1; dc <= 1; dc++)
      for (let dr = -1; dr <= 1; dr++)
        if (dc !== 0 || dr !== 0) reveal(grid, col + dc, row + dr);
  }
}

// ─── Interactions souris ─────────────────────────────────────
function cellFromMouse(mx, my) {
  for (let g = 0; g < 2; g++) {
    const ox = g === 0 ? G1_X : G2_X;
    const col = Math.floor((mx - ox) / CELL);
    const row = Math.floor((my - GRID_Y) / CELL);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS)
      return { grid: g, col, row };
  }
  return null;
}

canvas.addEventListener("mousemove", e => {
  const r  = canvas.getBoundingClientRect();
  const sx = CW / r.width, sy = CH / r.height;
  hoverCell = cellFromMouse((e.clientX - r.left) * sx, (e.clientY - r.top) * sy);
});
canvas.addEventListener("mouseleave", () => { hoverCell = null; });

canvas.addEventListener("click", e => {
  if (gameState !== "playing") return;
  const r  = canvas.getBoundingClientRect();
  const sx = CW / r.width, sy = CH / r.height;
  const cell = cellFromMouse((e.clientX - r.left) * sx, (e.clientY - r.top) * sy);
  if (!cell) return;
  handleReveal(cell.grid, cell.col, cell.row);
});

canvas.addEventListener("contextmenu", e => {
  e.preventDefault();
  if (gameState !== "playing") return;
  const r  = canvas.getBoundingClientRect();
  const sx = CW / r.width, sy = CH / r.height;
  const cell = cellFromMouse((e.clientX - r.left) * sx, (e.clientY - r.top) * sy);
  if (!cell) return;
  toggleFlag(cell.grid, cell.col, cell.row);
});

function handleReveal(gIdx, col, row) {
  const grid = grids[gIdx];
  const cell = grid[col][row];
  if (cell.revealed || cell.flagged) return;

  reveal(grid, col, row);

  if (cell.mine) {
    // Explosion
    const ox = gIdx === 0 ? G1_X : G2_X;
    const cx = ox + (col + 0.5) * CELL;
    const cy = GRID_Y + (row + 0.5) * CELL;
    spawnExplosion(cx, cy);
    // Révèle toutes les mines
    revealAllMines(grid);
    updateHUD();
    setTimeout(() => endRound(gIdx === 0 ? "player2" : "player1", "mine"), 800);
    gameState = "over-pending";
    return;
  }

  // Victoire par démiinage complet ?
  if (safeLeft(grid) === 0) {
    updateHUD();
    endRound(gIdx === 0 ? "player1" : "player2", "clear");
    return;
  }

  updateHUD();
}

function toggleFlag(gIdx, col, row) {
  const cell = grids[gIdx][col][row];
  if (cell.revealed) return;
  cell.flagged = !cell.flagged;
  updateHUD();
}

function revealAllMines(grid) {
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++)
      if (grid[c][r].mine) grid[c][r].revealed = true;
}

function spawnExplosion(cx, cy) {
  for (let i = 0; i < 20; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 2 + Math.random() * 5;
    explosions.push({
      x: cx, y: cy,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2,
      life: 1, r: 2 + Math.random() * 5,
      color: Math.random() < 0.5 ? "#f2a640" : C.mine,
    });
  }
}

function endRound(winnerKey, reason) {
  gameState = "gameover";
  const title = document.getElementById("overlay-title");
  const sub   = document.getElementById("overlay-sub");
  if (winnerKey === "player1") {
    title.textContent = "J1 ROUGE GAGNE";
    title.style.color  = C.p1;
  } else {
    title.textContent = "J2 BLEU GAGNE";
    title.style.color  = C.p2;
  }
  sub.textContent = reason === "mine"
    ? "L'adversaire a sauté sur une mine !"
    : "Terrain entièrement déminé !";
  document.getElementById("overlay").removeAttribute("hidden");
  recordResult(winnerKey);
}

// ─── Rendu ──────────────────────────────────────────────────
function render() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  drawGrid(0);
  drawGrid(1);
  drawExplosions();
  updateExplosions();
}

function drawGrid(gIdx) {
  const ox    = gIdx === 0 ? G1_X : G2_X;
  const color = gIdx === 0 ? C.p1 : C.p2;
  const grid  = grids[gIdx];

  // Label
  ctx.font      = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(gIdx === 0 ? "GRILLE J1 ROUGE" : "GRILLE J2 BLEU", ox + GRID_W / 2, GRID_Y - 10);
  ctx.textAlign = "left";

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const cell = grid[c][r];
      const cx   = ox + c * CELL;
      const cy   = GRID_Y + r * CELL;
      const pad  = 2;

      const isHover = hoverCell && hoverCell.grid === gIdx
        && hoverCell.col === c && hoverCell.row === r
        && !cell.revealed && !cell.flagged && gameState === "playing";

      if (cell.revealed) {
        ctx.fillStyle = C.revealed;
        ctx.fillRect(cx + pad, cy + pad, CELL - pad * 2, CELL - pad * 2);
        ctx.strokeStyle = C.revealedEdge;
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(cx + pad, cy + pad, CELL - pad * 2, CELL - pad * 2);

        if (cell.mine) {
          // Mine explosée
          ctx.fillStyle = C.mine;
          ctx.beginPath();
          ctx.arc(cx + CELL / 2, cy + CELL / 2, CELL * 0.28, 0, Math.PI * 2);
          ctx.fill();
          // Épines
          for (let a = 0; a < 8; a++) {
            const ang = a * Math.PI / 4;
            ctx.strokeStyle = C.mine;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(cx + CELL / 2 + Math.cos(ang) * 5, cy + CELL / 2 + Math.sin(ang) * 5);
            ctx.lineTo(cx + CELL / 2 + Math.cos(ang) * 13, cy + CELL / 2 + Math.sin(ang) * 13);
            ctx.stroke();
          }
        } else if (cell.adj > 0) {
          ctx.fillStyle   = C.numColors[cell.adj] || "#aaa";
          ctx.font        = "bold 14px monospace";
          ctx.textAlign   = "center";
          ctx.fillText(cell.adj, cx + CELL / 2, cy + CELL / 2 + 5);
          ctx.textAlign   = "left";
        }
      } else {
        // Case cachée
        ctx.fillStyle = isHover ? (color + "33") : C.hidden;
        ctx.fillRect(cx + pad, cy + pad, CELL - pad * 2, CELL - pad * 2);
        ctx.strokeStyle = isHover ? (color + "88") : C.hiddenEdge;
        ctx.lineWidth   = 1;
        ctx.strokeRect(cx + pad, cy + pad, CELL - pad * 2, CELL - pad * 2);

        if (cell.flagged) {
          ctx.fillStyle   = C.flagColor;
          ctx.font        = "bold 16px monospace";
          ctx.textAlign   = "center";
          ctx.fillText("🚩", cx + CELL / 2, cy + CELL / 2 + 6);
          ctx.textAlign   = "left";
        }
      }
    }
  }

  // Bordure globale
  ctx.strokeStyle = color + "55";
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(ox, GRID_Y, GRID_W, GRID_H);
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
    e.life -= 0.03; e.vx *= 0.97;
  });
  explosions = explosions.filter(e => e.life > 0);
}

// ─── HUD ────────────────────────────────────────────────────
function updateHUD() {
  [0, 1].forEach(i => {
    const n = i === 0 ? "p1" : "p2";
    if (!grids || !grids[i]) return;
    document.getElementById(`mines-left-${n}`).textContent = minesLeft(grids[i]);
    document.getElementById(`safe-left-${n}`).textContent  = safeLeft(grids[i]);
  });
}

// ─── API scores ──────────────────────────────────────────────
async function recordResult(winnerKey) {
  try {
    const r = await fetch("/api/scores/minesweeper/record", {
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
    const r = await fetch("/api/scores/minesweeper");
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
  resetRound();
});

// ─── Boucle principale ───────────────────────────────────────
let loopStarted = false;

function tick() {
  render();
  requestAnimationFrame(tick);
}

// Preview statique (grilles vides)
const emptyLayout = Array(COLS).fill(null).map(() => Array(ROWS).fill(false));
grids = [makeGrid(emptyLayout), makeGrid(emptyLayout)];
render();
loadScores();
