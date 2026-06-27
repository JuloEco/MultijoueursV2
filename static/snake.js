// ============================================================
// SNAKE DUEL — 2 serpents, 1 arène, dernière tête à survivre
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const CELL = 20;          // px par cellule
const COLS = Math.floor(W / CELL);
const ROWS = Math.floor(H / CELL);
const TICK_MS = 110;      // ms entre chaque avance

const COLORS = {
  p1: "#d6543c",
  p1dim: "#6b3326",
  p2: "#4f8fae",
  p2dim: "#2c4956",
  food: "#8fb33f",
  foodGlow: "#c6e060",
  bg: "#11140f",
  grid: "#191f15",
  wall: "#3a4530",
};

let snake1, snake2, foods, gameState, lastTick, pendingDir1, pendingDir2;

// ---------- Init ----------
function initRound() {
  snake1 = {
    body: [
      {x: 5, y: Math.floor(ROWS/2)},
      {x: 4, y: Math.floor(ROWS/2)},
      {x: 3, y: Math.floor(ROWS/2)},
    ],
    dir: {x:1, y:0},
    nextDir: {x:1, y:0},
    alive: true,
    color: COLORS.p1,
    dimColor: COLORS.p1dim,
  };
  snake2 = {
    body: [
      {x: COLS-6, y: Math.floor(ROWS/2)},
      {x: COLS-5, y: Math.floor(ROWS/2)},
      {x: COLS-4, y: Math.floor(ROWS/2)},
    ],
    dir: {x:-1, y:0},
    nextDir: {x:-1, y:0},
    alive: true,
    color: COLORS.p2,
    dimColor: COLORS.p2dim,
  };
  foods = [];
  spawnFood();
  spawnFood();
  pendingDir1 = null;
  pendingDir2 = null;
  gameState = "playing";
  lastTick = performance.now();
  updateLenHUD();
}

function spawnFood() {
  const occupied = new Set([
    ...snake1.body.map(c => `${c.x},${c.y}`),
    ...snake2.body.map(c => `${c.x},${c.y}`),
    ...foods.map(f => `${f.x},${f.y}`),
  ]);
  let pos;
  let tries = 0;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    tries++;
  } while (occupied.has(`${pos.x},${pos.y}`) && tries < 200);
  foods.push(pos);
}

// ---------- Input ----------
const keys = {};
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  const prevent = ["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"];
  if (prevent.includes(e.code)) e.preventDefault();

  // J1 : ZQSD or WASD
  if (gameState !== "playing") return;
  if      (e.code==="KeyW"||e.code==="KeyZ") trySetDir(snake1, {x:0,y:-1});
  else if (e.code==="KeyS")                  trySetDir(snake1, {x:0,y:1});
  else if (e.code==="KeyA"||e.code==="KeyQ") trySetDir(snake1, {x:-1,y:0});
  else if (e.code==="KeyD")                  trySetDir(snake1, {x:1,y:0});
  // J2 : arrows
  else if (e.code==="ArrowUp")    trySetDir(snake2, {x:0,y:-1});
  else if (e.code==="ArrowDown")  trySetDir(snake2, {x:0,y:1});
  else if (e.code==="ArrowLeft")  trySetDir(snake2, {x:-1,y:0});
  else if (e.code==="ArrowRight") trySetDir(snake2, {x:1,y:0});
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

function trySetDir(snake, dir) {
  // Interdit de faire demi-tour
  if (dir.x === -snake.dir.x && dir.y === -snake.dir.y) return;
  snake.nextDir = dir;
}

// ---------- Boucle ----------
function tick(now) {
  requestAnimationFrame(tick);
  if (gameState === "playing") {
    if (now - lastTick >= TICK_MS) {
      lastTick = now;
      stepGame();
    }
  }
  render();
}

function stepGame() {
  moveSnake(snake1);
  moveSnake(snake2);

  // Collision murs
  checkWall(snake1);
  checkWall(snake2);

  // Collision corps
  if (snake1.alive) checkBodyCollision(snake1, snake2);
  if (snake2.alive) checkBodyCollision(snake2, snake1);

  // Head-on head collision
  if (snake1.alive && snake2.alive) {
    const h1 = snake1.body[0], h2 = snake2.body[0];
    if (h1.x === h2.x && h1.y === h2.y) {
      snake1.alive = false;
      snake2.alive = false;
    }
  }

  // Nourriture
  eatFood(snake1);
  eatFood(snake2);

  updateLenHUD();

  // Fin de manche
  if (!snake1.alive || !snake2.alive) {
    setTimeout(() => checkGameOver(), 180);
    gameState = "over-pending";
  }
}

function moveSnake(snake) {
  if (!snake.alive) return;
  snake.dir = snake.nextDir;
  const head = snake.body[0];
  const newHead = { x: head.x + snake.dir.x, y: head.y + snake.dir.y };
  snake.body.unshift(newHead);
  snake.body.pop(); // sera rétabli si manger
}

function checkWall(snake) {
  if (!snake.alive) return;
  const h = snake.body[0];
  if (h.x < 0 || h.x >= COLS || h.y < 0 || h.y >= ROWS) {
    snake.alive = false;
  }
}

function checkBodyCollision(snake, other) {
  const h = snake.body[0];
  const selfBody = snake.body.slice(1);
  const allObstacles = [...selfBody, ...other.body];
  for (const seg of allObstacles) {
    if (h.x === seg.x && h.y === seg.y) { snake.alive = false; return; }
  }
}

function eatFood(snake) {
  if (!snake.alive) return;
  const h = snake.body[0];
  for (let i = foods.length - 1; i >= 0; i--) {
    if (foods[i].x === h.x && foods[i].y === h.y) {
      foods.splice(i, 1);
      // Grandir : réajouter la queue
      snake.body.push({ ...snake.body[snake.body.length - 1] });
      spawnFood();
    }
  }
}

function checkGameOver() {
  gameState = "gameover";
  let winnerKey = null;
  let reason = "";

  if (!snake1.alive && !snake2.alive) {
    // Égalité : le plus long gagne
    if (snake1.body.length > snake2.body.length) { winnerKey = "player1"; reason = "Le serpent rouge est plus long"; }
    else if (snake2.body.length > snake1.body.length) { winnerKey = "player2"; reason = "Le serpent bleu est plus long"; }
    else { reason = "Égalité parfaite !"; }
  } else if (!snake1.alive) {
    winnerKey = "player2"; reason = "Le serpent rouge s'est crashé";
  } else {
    winnerKey = "player1"; reason = "Le serpent bleu s'est crashé";
  }

  const title = document.getElementById("overlay-title");
  const sub = document.getElementById("overlay-sub");

  if (winnerKey === "player1") {
    title.textContent = "SERPENT ROUGE GAGNE";
    title.style.color = COLORS.p1;
  } else if (winnerKey === "player2") {
    title.textContent = "SERPENT BLEU GAGNE";
    title.style.color = COLORS.p2;
  } else {
    title.textContent = "ÉGALITÉ !";
    title.style.color = "#8fb33f";
  }
  sub.textContent = reason;
  document.getElementById("overlay").removeAttribute("hidden");

  if (winnerKey) recordResult(winnerKey);
}

// ---------- Rendu ----------
function render() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Grille légère
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < COLS; x++) {
    for (let y = 0; y < ROWS; y++) {
      ctx.strokeRect(x * CELL, y * CELL, CELL, CELL);
    }
  }

  // Nourriture
  foods.forEach(f => {
    const px = f.x * CELL + CELL / 2;
    const py = f.y * CELL + CELL / 2;
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(143,179,63,0.25)";
    ctx.beginPath();
    ctx.arc(px, py, CELL * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });

  drawSnake(snake1);
  drawSnake(snake2);
}

function drawSnake(snake) {
  snake.body.forEach((seg, i) => {
    const isHead = i === 0;
    const alpha = snake.alive ? 1 : 0.35;
    ctx.globalAlpha = alpha;

    if (isHead) {
      ctx.fillStyle = snake.color;
    } else {
      ctx.fillStyle = i % 2 === 0 ? snake.color : snake.dimColor;
    }

    const pad = isHead ? 1 : 2;
    ctx.fillRect(
      seg.x * CELL + pad,
      seg.y * CELL + pad,
      CELL - pad * 2,
      CELL - pad * 2
    );

    // Yeux sur la tête
    if (isHead && snake.alive) {
      ctx.fillStyle = COLORS.bg;
      const ex = seg.x * CELL + CELL * 0.3;
      const ey = seg.y * CELL + CELL * 0.3;
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
      ctx.fillRect(ex + 4, ey - 2, 4, 4);
    }
  });
  ctx.globalAlpha = 1;
}

function updateLenHUD() {
  document.getElementById("len-p1").textContent = snake1 ? snake1.body.length : 3;
  document.getElementById("len-p2").textContent = snake2 ? snake2.body.length : 3;
}

// ---------- API ----------
async function recordResult(winnerKey) {
  try {
    const res = await fetch("/api/scores/snake/record", {
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
    const r = await fetch("/api/scores/snake");
    const s = await r.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

// ---------- Boutons ----------
document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("overlay-start").setAttribute("hidden", "");
  snake1 = snake1 || {};
  snake2 = snake2 || {};
  initRound();
  requestAnimationFrame(tick);
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("overlay").setAttribute("hidden", "");
  initRound();
});

// Preview statique avant démarrage
snake1 = {
  body: [{x:5,y:13},{x:4,y:13},{x:3,y:13}],
  dir:{x:1,y:0}, nextDir:{x:1,y:0}, alive:true,
  color:COLORS.p1, dimColor:COLORS.p1dim
};
snake2 = {
  body: [{x:43,y:13},{x:44,y:13},{x:45,y:13}],
  dir:{x:-1,y:0}, nextDir:{x:-1,y:0}, alive:true,
  color:COLORS.p2, dimColor:COLORS.p2dim
};
foods = [{x:24,y:13},{x:12,y:7}];
render();
loadScores();
