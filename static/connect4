// ============================================================
// PUISSANCE 4 — grille 7×6, 2 joueurs
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const COLS = 7;
const ROWS = 6;
const CELL = 40;
const RADIUS = 16;

const COLORS = {
  p1: "#d6543c",
  p2: "#4f8fae",
  bg: "#11140f",
  grid: "#232a1c",
  slot: "#0a0c08",
};

let grid = [];
let gameState = "idle"; // idle | playing | gameover
let currentPlayer = 0; // 0=rouge, 1=bleu
let hoverCol = -1;

function initGrid() {
  grid = Array(COLS).fill(null).map(() => Array(ROWS).fill(0));
  currentPlayer = 0;
  gameState = "playing";
  updateHUD();
}

function initRound() {
  initGrid();
}

window.addEventListener("keydown", e => {
  if (gameState !== "playing") return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 7) {
    dropPiece(num - 1);
    e.preventDefault();
  }
});

canvas.addEventListener("mousemove", e => {
  if (gameState !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  hoverCol = Math.floor(x / CELL);
});

canvas.addEventListener("mouseleave", () => { hoverCol = -1; });

canvas.addEventListener("click", e => {
  if (gameState !== "playing") return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const col = Math.floor(x / CELL);
  if (col >= 0 && col < COLS) dropPiece(col);
});

function dropPiece(col) {
  if (col < 0 || col >= COLS) return;
  
  // Cherche la ligne libre la plus basse
  for (let row = ROWS - 1; row >= 0; row--) {
    if (grid[col][row] === 0) {
      grid[col][row] = currentPlayer + 1;
      checkWin(col, row);
      if (gameState === "playing") {
        currentPlayer = 1 - currentPlayer;
        updateHUD();
      }
      return;
    }
  }
}

function checkWin(col, row) {
  const player = grid[col][row];
  const dirs = [[0,1], [1,0], [1,1], [1,-1]];
  
  for (const [dx, dy] of dirs) {
    let count = 1;
    // Sens positif
    for (let i = 1; i < 4; i++) {
      const nc = col + dx * i;
      const nr = row + dy * i;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) break;
      if (grid[nc][nr] === player) count++;
      else break;
    }
    // Sens négatif
    for (let i = 1; i < 4; i++) {
      const nc = col - dx * i;
      const nr = row - dy * i;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) break;
      if (grid[nc][nr] === player) count++;
      else break;
    }
    
    if (count >= 4) {
      endRound(player === 1 ? "player1" : "player2");
      return;
    }
  }
  
  // Check grille pleine
  let full = true;
  for (let c = 0; c < COLS; c++) {
    if (grid[c][0] === 0) { full = false; break; }
  }
  if (full) endRound(null); // égalité
}

function endRound(winnerKey) {
  gameState = "gameover";
  const title = document.getElementById("overlay-title");
  const sub = document.getElementById("overlay-sub");
  
  if (winnerKey === "player1") {
    title.textContent = "J1 ROUGE GAGNE";
    title.style.color = COLORS.p1;
    sub.textContent = "4 jetons alignés !";
  } else if (winnerKey === "player2") {
    title.textContent = "J2 BLEU GAGNE";
    title.style.color = COLORS.p2;
    sub.textContent = "4 jetons alignés !";
  } else {
    title.textContent = "ÉGALITÉ !";
    title.style.color = "#8fb33f";
    sub.textContent = "Grille pleine";
  }
  
  document.getElementById("overlay").removeAttribute("hidden");
  if (winnerKey) recordResult(winnerKey);
}

function updateHUD() {
  const p1Full = grid.reduce((a, col) => a + col.filter(x => x !== 0).length, 0);
  const p1Pieces = COLS * ROWS / 2 - p1Full;
  const p2Pieces = COLS * ROWS / 2;
  
  document.getElementById("count-p1").textContent = p1Pieces;
  document.getElementById("count-p2").textContent = p2Pieces;
}

function render() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Grille
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      ctx.fillStyle = COLORS.slot;
      ctx.beginPath();
      ctx.arc(x, y, RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Pièces
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const piece = grid[c][r];
      if (piece === 0) continue;
      const x = c * CELL + CELL / 2;
      const y = r * CELL + CELL / 2;
      ctx.fillStyle = piece === 1 ? COLORS.p1 : COLORS.p2;
      ctx.beginPath();
      ctx.arc(x, y, RADIUS - 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Hover indicator
  if (hoverCol >= 0 && hoverCol < COLS && gameState === "playing") {
    const x = hoverCol * CELL + CELL / 2;
    ctx.fillStyle = currentPlayer === 0 ? COLORS.p1 : COLORS.p2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, CELL / 2, RADIUS - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

let loopStarted = false;
function tick() {
  render();
  requestAnimationFrame(tick);
}

async function recordResult(winnerKey) {
  try {
    const res = await fetch("/api/scores/connect4/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner: winnerKey }),
    });
    const s = await res.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

async function loadScores() {
  try {
    const r = await fetch("/api/scores/connect4");
    const s = await r.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("overlay-start").setAttribute("hidden", "");
  initRound();
  if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("overlay").setAttribute("hidden", "");
  initRound();
});

render();
loadScores();
