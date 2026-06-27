// ============================================================
// PONG — duel de raquettes 2 joueurs locaux
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const PADDLE_W = 12;
const PADDLE_H = 80;
const BALL_R = 7;
const PADDLE_SPEED = 5.5;
const BALL_SPEED_INIT = 6;
const MAX_SCORE = 7;

const COLORS = {
  p1: "#d6543c",
  p2: "#4f8fae",
  phosphor: "#8fb33f",
  phosphorDim: "#5c7330",
  bg: "#11140f",
  surface: "#171c14",
  line: "#3a4530",
};

let keys = {};
let gameState = "idle"; // idle | playing | gameover
let scores = { p1: 0, p2: 0 };
let winScores = { player1: 0, player2: 0 };
let paddle1, paddle2, ball;

function initRound() {
  paddle1 = { x: 28, y: H / 2 - PADDLE_H / 2 };
  paddle2 = { x: W - 28 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
  resetBall();
  scores = { p1: 0, p2: 0 };
  updatePtsHUD();
}

function resetBall() {
  const angle = (Math.random() * 60 - 30) * (Math.PI / 180);
  const dir = Math.random() < 0.5 ? 1 : -1;
  ball = {
    x: W / 2,
    y: H / 2,
    vx: Math.cos(angle) * BALL_SPEED_INIT * dir,
    vy: Math.sin(angle) * BALL_SPEED_INIT,
    speed: BALL_SPEED_INIT,
  };
}

window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","Space","KeyW","KeyS","KeyZ","KeyA"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

function update() {
  if (gameState !== "playing") return;

  // Paddle 1 — W / S
  if (keys["KeyW"]) paddle1.y = Math.max(0, paddle1.y - PADDLE_SPEED);
  if (keys["KeyS"]) paddle1.y = Math.min(H - PADDLE_H, paddle1.y + PADDLE_SPEED);
  // Paddle 2 — arrows
  if (keys["ArrowUp"]) paddle2.y = Math.max(0, paddle2.y - PADDLE_SPEED);
  if (keys["ArrowDown"]) paddle2.y = Math.min(H - PADDLE_H, paddle2.y + PADDLE_SPEED);

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounces (top/bottom)
  if (ball.y - BALL_R <= 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }
  if (ball.y + BALL_R >= H) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy); }

  // Paddle 1 collision
  if (
    ball.vx < 0 &&
    ball.x - BALL_R <= paddle1.x + PADDLE_W &&
    ball.x + BALL_R >= paddle1.x &&
    ball.y + BALL_R >= paddle1.y &&
    ball.y - BALL_R <= paddle1.y + PADDLE_H
  ) {
    ball.x = paddle1.x + PADDLE_W + BALL_R;
    bouncePaddle(paddle1);
  }

  // Paddle 2 collision
  if (
    ball.vx > 0 &&
    ball.x + BALL_R >= paddle2.x &&
    ball.x - BALL_R <= paddle2.x + PADDLE_W &&
    ball.y + BALL_R >= paddle2.y &&
    ball.y - BALL_R <= paddle2.y + PADDLE_H
  ) {
    ball.x = paddle2.x - BALL_R;
    bouncePaddle(paddle2);
  }

  // Scoring
  if (ball.x < 0) { scores.p2++; checkScoreEnd(); }
  if (ball.x > W) { scores.p1++; checkScoreEnd(); }

  updatePtsHUD();
}

function bouncePaddle(paddle) {
  const center = paddle.y + PADDLE_H / 2;
  const rel = (ball.y - center) / (PADDLE_H / 2); // -1..1
  const maxAngle = 60 * (Math.PI / 180);
  const angle = rel * maxAngle;
  ball.speed = Math.min(ball.speed + 0.3, 16);
  ball.vx = -Math.sign(ball.vx) * Math.cos(angle) * ball.speed;
  ball.vy = Math.sin(angle) * ball.speed;
}

function checkScoreEnd() {
  updatePtsHUD();
  if (scores.p1 >= MAX_SCORE) {
    endRound("player1");
  } else if (scores.p2 >= MAX_SCORE) {
    endRound("player2");
  } else {
    resetBall();
  }
}

function endRound(winnerKey) {
  gameState = "gameover";
  const isP1 = winnerKey === "player1";
  const title = document.getElementById("overlay-title");
  const sub = document.getElementById("overlay-sub");
  title.textContent = isP1 ? "J1 GAGNE LA MANCHE" : "J2 GAGNE LA MANCHE";
  title.style.color = isP1 ? COLORS.p1 : COLORS.p2;
  sub.textContent = `${scores.p1} — ${scores.p2}`;
  document.getElementById("overlay").removeAttribute("hidden");
  recordResult(winnerKey);
}

async function recordResult(winnerKey) {
  try {
    const res = await fetch("/api/scores/pong/record", {
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
    const r = await fetch("/api/scores/pong");
    const s = await r.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

function updatePtsHUD() {
  document.getElementById("pts-p1").textContent = scores.p1;
  document.getElementById("pts-p2").textContent = scores.p2;
}

// ---------- Rendu ----------
function render() {
  // Fond
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  // Ligne centrale pointillée
  ctx.setLineDash([12, 12]);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Score central en grand
  ctx.fillStyle = COLORS.line;
  ctx.font = "bold 72px monospace";
  ctx.textAlign = "center";
  ctx.fillText(scores.p1, W / 2 - 70, 80);
  ctx.fillText(scores.p2, W / 2 + 70, 80);

  // Paddles
  ctx.fillStyle = COLORS.p1;
  ctx.fillRect(paddle1.x, paddle1.y, PADDLE_W, PADDLE_H);
  ctx.fillStyle = COLORS.p2;
  ctx.fillRect(paddle2.x, paddle2.y, PADDLE_W, PADDLE_H);

  // Ball
  ctx.fillStyle = "#f2e9b0";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
  ctx.fill();

  // Traînée légère
  ctx.fillStyle = "rgba(242,233,176,0.15)";
  ctx.beginPath();
  ctx.arc(ball.x - ball.vx * 3, ball.y - ball.vy * 3, BALL_R * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

let loopStarted = false;
function tick() {
  update();
  render();
  requestAnimationFrame(tick);
}

document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("overlay-start").setAttribute("hidden", "");
  initRound();
  gameState = "playing";
  if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("overlay").setAttribute("hidden", "");
  initRound();
  gameState = "playing";
});

// Init
paddle1 = { x: 28, y: H / 2 - PADDLE_H / 2 };
paddle2 = { x: W - 28 - PADDLE_W, y: H / 2 - PADDLE_H / 2 };
ball = { x: W/2, y: H/2, vx: 0, vy: 0, speed: BALL_SPEED_INIT };
render();
loadScores();
