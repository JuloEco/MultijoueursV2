// ============================================================
// TRENCH RUN — 2 couloirs de survie en scrolling, 2 joueurs
// ============================================================

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const W = canvas.width;   // 980
const H = canvas.height;  // 540

// ─── Layout des couloirs ─────────────────────────────────────
const LANE_W    = W / 2 - 30;   // largeur de chaque couloir
const L1_X      = 15;            // X gauche du couloir 1
const L2_X      = W / 2 + 15;   // X gauche du couloir 2
const LANE_H    = H - 40;        // hauteur utile
const LANE_Y    = 20;
const CORRIDOR  = LANE_W - 8;   // largeur intérieure jouable

// ─── Constantes de jeu ───────────────────────────────────────
const SHIP_W    = 28;
const SHIP_H    = 14;
const MAX_LIVES = 3;
const BASE_SPEED= 3.5;
const SPEED_INC = 0.0008;   // accélération par frame
const OBS_MIN_W = 18;
const OBS_MAX_W = 80;
const OBS_MIN_H = 20;
const OBS_MAX_H = 110;
const OBS_GAP   = 220;      // espace min entre obstacles

// ─── Couleurs ────────────────────────────────────────────────
const C = {
  p1: "#d6543c", p1dim: "#6b3326",
  p2: "#4f8fae", p2dim: "#2c4956",
  phosphor: "#8fb33f", phosphorDim: "#5c7330",
  bg: "#11140f", wall: "#2e3a1f", wallBright: "#4a5a35",
  obs: "#3a4530", obsEdge: "#8fb33f",
  star: "rgba(143,179,63,0.3)",
  dead: "#333",
};

// ─── État ────────────────────────────────────────────────────
let players, obstacles1, obstacles2, scrollX, speed, frame, gameState, keys;

function resetRound() {
  players = [
    {
      y: LANE_Y + LANE_H / 2, vy: 0,
      lives: MAX_LIVES, alive: true,
      dist: 0, flashTimer: 0,
      laneX: L1_X, color: C.p1, dimColor: C.p1dim,
      keyUp: "KeyZ", keyDown: "KeyS",
      name: "PILOTE ROUGE", key: "p1",
    },
    {
      y: LANE_Y + LANE_H / 2, vy: 0,
      lives: MAX_LIVES, alive: true,
      dist: 0, flashTimer: 0,
      laneX: L2_X, color: C.p2, dimColor: C.p2dim,
      keyUp: "ArrowUp", keyDown: "ArrowDown",
      name: "PILOTE BLEU", key: "p2",
    },
  ];
  obstacles1 = generateObstacles(800);
  obstacles2 = generateObstacles(800);
  scrollX    = 0;
  speed      = BASE_SPEED;
  frame      = 0;
  gameState  = "playing";
  keys       = {};
  updateHUD();
}

// ─── Génération d'obstacles ──────────────────────────────────
function generateObstacles(startX) {
  const obs = [];
  let x = startX;
  while (x < startX + 4000) {
    x += OBS_GAP + Math.random() * 180;
    const w = OBS_MIN_W + Math.random() * (OBS_MAX_W - OBS_MIN_W);
    const h = OBS_MIN_H + Math.random() * (OBS_MAX_H - OBS_MIN_H);
    // Top ou bottom aléatoire
    const fromTop = Math.random() < 0.5;
    const y = fromTop ? LANE_Y : LANE_Y + LANE_H - h;
    obs.push({ x, y, w, h });
    // Parfois un obstacle symétrique côté opposé avec un gap jouable
    if (Math.random() < 0.4) {
      const gap   = 90 + Math.random() * 80;
      const h2    = OBS_MIN_H + Math.random() * 70;
      const y2    = fromTop ? LANE_Y + LANE_H - h2 : LANE_Y;
      obs.push({ x: x + w / 2, y: y2, w: w * 0.7, h: h2 });
    }
  }
  return obs;
}

function extendObstacles(obs) {
  const last  = obs[obs.length - 1];
  const start = last ? last.x + 300 : scrollX + W + 200;
  const fresh = generateObstacles(start);
  fresh.forEach(o => obs.push(o));
}

// ─── Input ───────────────────────────────────────────────────
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","KeyZ","KeyS"].includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ─── Update ──────────────────────────────────────────────────
function update() {
  frame++;
  speed = BASE_SPEED + frame * SPEED_INC;
  scrollX += speed;

  players.forEach((p, idx) => {
    if (!p.alive) return;

    // Mouvement vertical — style "flappy" fluide
    const accel = 0.45;
    const damping = 0.82;
    if (keys[p.keyUp])   p.vy -= accel;
    if (keys[p.keyDown]) p.vy += accel;
    p.vy *= damping;
    p.vy  = Math.max(-6, Math.min(6, p.vy));
    p.y  += p.vy;

    // Bornes du couloir
    const minY = LANE_Y + 4;
    const maxY = LANE_Y + LANE_H - SHIP_H - 4;
    if (p.y < minY) { p.y = minY; p.vy = Math.abs(p.vy) * 0.3; }
    if (p.y > maxY) { p.y = maxY; p.vy = -Math.abs(p.vy) * 0.3; }

    p.dist = Math.round(scrollX / 10);
    if (p.flashTimer > 0) p.flashTimer--;

    // Collision obstacles
    const obs = idx === 0 ? obstacles1 : obstacles2;
    const shipX = p.laneX + 30;
    for (const o of obs) {
      const ox = o.x - scrollX + p.laneX;
      if (ox + o.w < shipX - SHIP_W / 2) continue;
      if (ox > shipX + SHIP_W / 2 + CORRIDOR) break;
      if (
        shipX + SHIP_W / 2 > ox &&
        shipX - SHIP_W / 2 < ox + o.w &&
        p.y + SHIP_H > o.y &&
        p.y < o.y + o.h
      ) {
        if (p.flashTimer === 0) {
          p.lives--;
          p.flashTimer = 60;
          p.vy = p.y < o.y + o.h / 2 ? -3 : 3;
          if (p.lives <= 0) { p.alive = false; }
        }
        break;
      }
    }
  });

  // Étend les obstacles si nécessaire
  [obstacles1, obstacles2].forEach(obs => {
    if (obs.length === 0 || obs[obs.length - 1].x - scrollX < W + 400)
      extendObstacles(obs);
    // Purge les obstacles trop loin derrière
    while (obs.length && obs[0].x - scrollX < -200) obs.shift();
  });

  updateHUD();
  checkGameOver();
}

function checkGameOver() {
  const [p1, p2] = players;
  if (!p1.alive || !p2.alive) {
    gameState = "gameover";
    let winnerKey = null;
    let title, sub;

    if (!p1.alive && !p2.alive) {
      title = "MATCH NUL !";
      sub   = "Les deux pilotes éliminés simultanément.";
    } else if (!p1.alive) {
      winnerKey = "player2";
      title = "PILOTE BLEU GAGNE";
      sub   = `Rouge éliminé à ${p1.dist}m`;
    } else {
      winnerKey = "player1";
      title = "PILOTE ROUGE GAGNE";
      sub   = `Bleu éliminé à ${p2.dist}m`;
    }

    const el = document.getElementById("overlay-title");
    el.textContent = title;
    el.style.color = winnerKey === "player1" ? C.p1 : winnerKey === "player2" ? C.p2 : C.phosphor;
    document.getElementById("overlay-sub").textContent = sub;
    document.getElementById("overlay").removeAttribute("hidden");
    if (winnerKey) recordResult(winnerKey);
  }
}

// ─── Rendu ──────────────────────────────────────────────────
function render() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawSeparator();
  drawLane(0, obstacles1);
  drawLane(1, obstacles2);
  players.forEach((p, i) => drawShip(p, i));
  drawSpeedBanner();
}

function drawStars() {
  ctx.fillStyle = C.star;
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 173 + frame * 0.5) % W + W) % W;
    const sy = (i * 97) % H;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
}

function drawSeparator() {
  ctx.strokeStyle = "rgba(143,179,63,0.15)";
  ctx.lineWidth   = 1;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawLane(idx, obstacles) {
  const lx = idx === 0 ? L1_X : L2_X;
  const color = idx === 0 ? C.p1 : C.p2;

  // Fond du couloir
  ctx.fillStyle = "rgba(10,15,8,0.6)";
  ctx.fillRect(lx, LANE_Y, CORRIDOR, LANE_H);

  // Murs haut/bas
  ctx.fillStyle = C.wall;
  ctx.fillRect(lx - 6, LANE_Y - 12, CORRIDOR + 12, 12);
  ctx.fillRect(lx - 6, LANE_Y + LANE_H, CORRIDOR + 12, 12);
  ctx.strokeStyle = C.wallBright;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lx - 6, LANE_Y); ctx.lineTo(lx + CORRIDOR + 6, LANE_Y);
  ctx.moveTo(lx - 6, LANE_Y + LANE_H); ctx.lineTo(lx + CORRIDOR + 6, LANE_Y + LANE_H);
  ctx.stroke();

  // Obstacles
  obstacles.forEach(o => {
    const ox = o.x - scrollX + lx;
    if (ox + o.w < lx - 10 || ox > lx + CORRIDOR + 10) return;

    // Corps
    ctx.fillStyle = C.obs;
    ctx.fillRect(ox, o.y, o.w, o.h);

    // Bord phosphore
    ctx.strokeStyle = C.obsEdge + "66";
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(ox, o.y, o.w, o.h);

    // Motif hachuré
    ctx.strokeStyle = C.obsEdge + "22";
    ctx.lineWidth   = 1;
    for (let hx = ox; hx < ox + o.w; hx += 10) {
      ctx.beginPath();
      ctx.moveTo(hx, o.y);
      ctx.lineTo(hx, o.y + o.h);
      ctx.stroke();
    }
  });

  // Label couloir
  ctx.fillStyle   = color + "55";
  ctx.font        = "bold 10px monospace";
  ctx.textAlign   = "center";
  ctx.fillText(idx === 0 ? "J1" : "J2", lx + CORRIDOR / 2, LANE_Y + 16);
  ctx.textAlign   = "left";
}

function drawShip(p, idx) {
  const shipX = p.laneX + 30;

  if (!p.alive) return;

  // Flash d'invincibilité
  if (p.flashTimer > 0 && Math.floor(p.flashTimer / 5) % 2 === 0) return;

  ctx.save();
  ctx.translate(shipX, p.y + SHIP_H / 2);

  const col = p.alive ? p.color : C.dead;

  // Fuselage
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(SHIP_W / 2, 0);
  ctx.lineTo(-SHIP_W / 2, -SHIP_H / 2);
  ctx.lineTo(-SHIP_W / 2 + 6, 0);
  ctx.lineTo(-SHIP_W / 2, SHIP_H / 2);
  ctx.closePath();
  ctx.fill();

  // Aile
  ctx.fillStyle = idx === 0 ? C.p1dim : C.p2dim;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, -SHIP_H);
  ctx.lineTo(-18, -SHIP_H / 2);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-10, SHIP_H);
  ctx.lineTo(-18, SHIP_H / 2);
  ctx.lineTo(-10, 0);
  ctx.closePath();
  ctx.fill();

  // Réacteur
  ctx.fillStyle = "#f2a640";
  ctx.globalAlpha = 0.6 + Math.random() * 0.4;
  ctx.beginPath();
  ctx.arc(-SHIP_W / 2 + 2, 0, 4 + Math.random() * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawSpeedBanner() {
  document.getElementById("speed-val").textContent = speed.toFixed(1) + "×";
}

// ─── HUD ────────────────────────────────────────────────────
function updateHUD() {
  players.forEach((p, i) => {
    const n = i === 0 ? "p1" : "p2";
    document.getElementById(`dist-${n}`).textContent = `${p.dist}m`;
    const hearts = "♥".repeat(p.lives) + "♡".repeat(MAX_LIVES - p.lives);
    document.getElementById(`lives-${n}`).textContent = hearts;
    document.getElementById(`hud-${n}`).style.outline =
      p.alive && gameState === "playing"
        ? `1px solid ${p.color}`
        : !p.alive ? `1px solid ${C.dead}` : "none";
  });
}

// ─── API scores ──────────────────────────────────────────────
async function recordResult(winnerKey) {
  try {
    const r = await fetch("/api/scores/trench/record", {
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
    const r = await fetch("/api/scores/trench");
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
keys = {};

function tick() {
  if (gameState === "playing") update();
  render();
  requestAnimationFrame(tick);
}

// Preview statique
players = [
  { y: LANE_Y + LANE_H / 2, vy: 0, lives: 3, alive: true, dist: 0, flashTimer: 0, laneX: L1_X, color: C.p1 },
  { y: LANE_Y + LANE_H / 2, vy: 0, lives: 3, alive: true, dist: 0, flashTimer: 0, laneX: L2_X, color: C.p2 },
];
obstacles1 = generateObstacles(400);
obstacles2 = generateObstacles(400);
scrollX = 0; speed = BASE_SPEED; frame = 0; gameState = "idle";
render();
loadScores();
