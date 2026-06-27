// ============================================================
// MORTAR DUEL — tir indirect à l'aveugle, 2 joueurs locaux
// Chaque joueur voit son camp. La fumée révèle le terrain ennemi.
// ============================================================

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const W = canvas.width;   // 980
const H = canvas.height;  // 540

// ─── Constantes physiques ────────────────────────────────────
const GRAVITY     = 0.18;
const MIN_POWER   = 4;
const MAX_POWER   = 22;
const ANGLE_STEP  = 1.5;   // degrés par frame de touche
const POWER_STEP  = 0.25;
const SHELL_R     = 4;
const EXPLOSION_R = 28;
const HIT_RADIUS  = 32;    // distance mortier → obus pour valider un hit
const MAX_HP      = 3;
const FOG_ALPHA   = 0.82;  // opacité du brouillard de guerre

// ─── Couleurs ────────────────────────────────────────────────
const C = {
  p1: "#d6543c", p1dim: "#6b3326",
  p2: "#4f8fae", p2dim: "#2c4956",
  phosphor: "#8fb33f", phosphorDim: "#5c7330",
  bg: "#11140f", surface: "#171c14",
  terrain: "#4a5a35", terrainDark: "#2e3a1f",
  sky1: "#1c2317", sky2: "#11140f",
  smoke: "rgba(180,180,160,",
  fog: "rgba(10,12,8,",
};

// ─── État global ─────────────────────────────────────────────
let terrain = [];       // hauteurs
let players = [];       // [{x,y,hp,angle,power,color,...}]
let shell    = null;    // obus en vol
let smokes   = [];      // [{x,y,r,alpha,age}]  — traces sur terrain ennemi
let explosions = [];    // particules visuelles
let currentPlayer = 0;
let gameState = "idle"; // idle | aiming | flying | exploding | gameover
let keys = {};

// ─── Génération du terrain ───────────────────────────────────
function generateTerrain() {
  const pts = [];
  const segs = 10;
  const sw   = W / segs;
  for (let i = 0; i <= segs; i++) {
    pts.push(H * 0.55 + (Math.random() - 0.5) * H * 0.25);
  }
  // zones de spawn plates
  pts[0] = pts[1] = H * 0.62;
  pts[segs - 1] = pts[segs] = H * 0.62;

  const h = new Array(W + 1);
  for (let x = 0; x <= W; x++) {
    const s   = Math.min(Math.floor(x / sw), segs - 1);
    const t   = (x - s * sw) / sw;
    const sm  = t * t * (3 - 2 * t);
    h[x] = pts[s] * (1 - sm) + pts[s + 1] * sm;
  }
  return h;
}

function tHeight(x) {
  return terrain[Math.max(0, Math.min(W, Math.round(x)))];
}

function carveCrater(cx, r) {
  for (let x = Math.max(0, cx - r | 0); x <= Math.min(W, cx + r | 0); x++) {
    const d = Math.sqrt(Math.max(0, r * r - (x - cx) ** 2));
    terrain[x] = Math.min(H - 4, terrain[x] + d * 0.85);
  }
}

// ─── Init joueurs ────────────────────────────────────────────
function initPlayers() {
  players = [
    { x: W * 0.10, hp: MAX_HP, angle: 60,  power: 12, color: C.p1, dimColor: C.p1dim, key: "p1", name: "MORTIER ROUGE", fireKey: "Space",  fireDir: 1 },
    { x: W * 0.90, hp: MAX_HP, angle: 120, power: 12, color: C.p2, dimColor: C.p2dim, key: "p2", name: "MORTIER BLEU",  fireKey: "Enter", fireDir: -1 },
  ];
}

function resetRound() {
  terrain     = generateTerrain();
  smokes      = [];
  explosions  = [];
  shell       = null;
  currentPlayer = 0;
  gameState   = "aiming";
  initPlayers();
  updateHUD();
}

// ─── Clavier ────────────────────────────────────────────────
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  const blocked = ["Space","Enter","ArrowUp","ArrowDown","ArrowLeft","ArrowRight","KeyZ","KeyS","KeyQ","KeyD","KeyW","KeyA"];
  if (blocked.includes(e.code)) e.preventDefault();
});
window.addEventListener("keyup",   e => { keys[e.code] = false; });

// ─── Boucle update ──────────────────────────────────────────
function update() {
  if (gameState === "aiming")    handleAiming();
  else if (gameState === "flying")    updateShell();
  else if (gameState === "exploding") updateExplosions();
}

function handleAiming() {
  const p    = players[currentPlayer];
  const isP1 = currentPlayer === 0;

  const kUp    = isP1 ? "KeyZ"  : "ArrowUp";
  const kDown  = isP1 ? "KeyS"  : "ArrowDown";
  const kLeft  = isP1 ? "KeyQ"  : "ArrowLeft";
  const kRight = isP1 ? "KeyD"  : "ArrowRight";
  const kFire  = isP1 ? "Space" : "Enter";

  if (keys[kUp])    p.angle = Math.min(175, p.angle + ANGLE_STEP);
  if (keys[kDown])  p.angle = Math.max(5,   p.angle - ANGLE_STEP);
  if (keys[kLeft])  p.power = Math.max(MIN_POWER, p.power - POWER_STEP);
  if (keys[kRight]) p.power = Math.min(MAX_POWER, p.power + POWER_STEP);

  if (keys[kFire]) {
    keys[kFire] = false; // one-shot
    fireShell(p);
  }
  updateHUD();
}

function fireShell(p) {
  const rad   = (p.angle * Math.PI) / 180;
  const speed = p.power;
  shell = {
    x:  p.x,
    y:  tHeight(p.x) - 14,
    vx: Math.cos(rad) * speed * p.fireDir,
    vy: -Math.sin(rad) * speed,
    owner: currentPlayer,
    trail: [],
  };
  gameState = "flying";
}

function updateShell() {
  if (!shell) return;

  shell.trail.push({ x: shell.x, y: shell.y });
  if (shell.trail.length > 22) shell.trail.shift();

  shell.vx += 0;           // pas de vent pour ce jeu
  shell.vy += GRAVITY;
  shell.x  += shell.vx;
  shell.y  += shell.vy;

  // Hors carte
  if (shell.x < -50 || shell.x > W + 50 || shell.y > H + 50) {
    // Raté — laisse une marque de fumée aléatoire sur la carte
    addSmoke(Math.random() * W, H * 0.3 + Math.random() * H * 0.3, false);
    endTurn();
    return;
  }

  // Collision terrain
  if (shell.y >= tHeight(shell.x)) {
    resolveImpact(shell.x, shell.y);
    return;
  }

  // Collision joueur adverse
  const target = players[1 - shell.owner];
  if (Math.hypot(shell.x - target.x, shell.y - (tHeight(target.x) - 10)) < HIT_RADIUS) {
    resolveImpact(shell.x, shell.y, true);
  }
}

function resolveImpact(ix, iy, directHit = false) {
  carveCrater(ix, EXPLOSION_R);

  // Dégâts
  players.forEach((p, i) => {
    if (i === shell.owner) return;
    const dist = Math.hypot(p.x - ix, (tHeight(p.x) - 10) - iy);
    if (dist < EXPLOSION_R * 1.2 || directHit) {
      p.hp = Math.max(0, p.hp - 1);
    }
  });

  // Fumée révélatrice sur le camp ennemi
  addSmoke(ix, iy, true);

  // Explosion visuelle
  for (let i = 0; i < 18; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 4;
    explosions.push({
      x: ix, y: iy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 2,
      life: 1, r: 3 + Math.random() * 5,
      color: Math.random() < 0.5 ? "#f2a640" : "#e05020",
    });
  }

  shell = null;
  gameState = "exploding";
}

function addSmoke(x, y, real) {
  // Ajoute plusieurs anneaux de fumée qui persistent
  const count = real ? 5 : 2;
  for (let i = 0; i < count; i++) {
    smokes.push({
      x: x + (Math.random() - 0.5) * (real ? 30 : 80),
      y: y + (Math.random() - 0.5) * (real ? 30 : 80),
      r: 8 + Math.random() * 20,
      alpha: 0.55 + Math.random() * 0.3,
      age: 0,
      real,
    });
  }
}

function updateExplosions() {
  explosions.forEach(e => {
    e.x   += e.vx;
    e.y   += e.vy;
    e.vy  += 0.15;
    e.life -= 0.04;
    e.vx  *= 0.96;
  });
  explosions = explosions.filter(e => e.life > 0);
  if (explosions.length === 0) checkGameOver();
}

function checkGameOver() {
  const dead = players.find(p => p.hp <= 0);
  if (dead) {
    const winnerKey = dead.key === "p1" ? "player2" : "player1";
    gameState = "gameover";
    showGameOver(winnerKey);
    recordResult(winnerKey);
  } else {
    endTurn();
  }
}

function endTurn() {
  shell = null;
  currentPlayer = 1 - currentPlayer;
  gameState = "aiming";
  updateHUD();
}

// ─── Rendu ──────────────────────────────────────────────────
function render() {
  // Ciel
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, C.sky1);
  sky.addColorStop(1, C.sky2);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawTerrain();
  smokes.forEach(drawSmokeBlob);
  players.forEach((p, i) => drawMortar(p, i));
  if (shell) drawShell();
  explosions.forEach(drawParticle);
  drawFogOfWar();
  drawAimingUI();
}

function drawStars() {
  ctx.fillStyle = "rgba(143,179,63,0.2)";
  for (let i = 0; i < 32; i++) {
    ctx.fillRect((i * 211) % W, (i * 79) % (H * 0.35), 1.2, 1.2);
  }
}

function drawTerrain() {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 2) ctx.lineTo(x, terrain[x]);
  ctx.lineTo(W, H);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, C.terrain);
  g.addColorStop(1, C.terrainDark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(143,179,63,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, terrain[0]);
  for (let x = 0; x <= W; x += 2) ctx.lineTo(x, terrain[x]);
  ctx.stroke();
}

function drawSmokeBlob(s) {
  ctx.fillStyle = C.smoke + (s.alpha * 0.7) + ")";
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  ctx.fill();
  // Halo vert phosphore pour les vrais impacts
  if (s.real) {
    ctx.strokeStyle = "rgba(143,179,63,0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMortar(p, idx) {
  const gx = p.x;
  const gy = tHeight(p.x);

  ctx.save();
  ctx.translate(gx, gy);

  // base
  ctx.fillStyle = p.color;
  ctx.fillRect(-10, -18, 20, 18);
  // chenilles
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-13, -5, 26, 6);

  // tube du mortier
  if (p.hp > 0) {
    const rad = (p.angle * Math.PI) / 180;
    const tx  = Math.cos(rad) * 22 * p.fireDir;
    const ty  = -Math.sin(rad) * 22;
    ctx.strokeStyle = p.color;
    ctx.lineWidth   = 5;
    ctx.lineCap     = "round";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(tx, -14 + ty);
    ctx.stroke();
  }

  // Indicateur vies (petits carrés)
  for (let i = 0; i < MAX_HP; i++) {
    ctx.fillStyle = i < p.hp ? p.color : p.dimColor;
    ctx.fillRect(-12 + i * 9, -30, 7, 5);
  }

  ctx.restore();
}

function drawShell() {
  // traînée
  shell.trail.forEach((pt, i) => {
    ctx.globalAlpha = (i / shell.trail.length) * 0.45;
    ctx.fillStyle   = "#e8d77a";
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.fillStyle   = "#f2e9b0";
  ctx.beginPath();
  ctx.arc(shell.x, shell.y, SHELL_R, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticle(e) {
  ctx.globalAlpha = e.life;
  ctx.fillStyle   = e.color;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r * e.life, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Brouillard de guerre : cache le camp ennemi, révélé par la fumée
function drawFogOfWar() {
  const p = players[currentPlayer];
  const isLeft = currentPlayer === 0;

  // Le camp ennemi est la moitié opposée
  const fogX = isLeft ? W / 2 : 0;
  const fogW = W / 2;

  // Masque de base
  ctx.fillStyle = C.fog + FOG_ALPHA + ")";
  ctx.fillRect(fogX, 0, fogW, H);

  // Révélations circulaires à travers la fumée (destination-out trick via offscreen)
  // On utilise une approche directe : un gradient "trou" par blob de fumée
  smokes.forEach(s => {
    const inFog = isLeft ? s.x > W / 2 : s.x < W / 2;
    if (!inFog) return;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 2.2);
    g.addColorStop(0,   C.fog + "0)");
    g.addColorStop(0.4, C.fog + "0)");
    g.addColorStop(1,   C.fog + FOG_ALPHA + ")");
    ctx.fillStyle = g;
    ctx.fillRect(fogX, 0, fogW, H);
  });

  // Ligne de séparation centrale
  ctx.strokeStyle = "rgba(143,179,63,0.25)";
  ctx.lineWidth   = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label "ZONE ENNEMIE"
  ctx.fillStyle   = "rgba(143,179,63,0.18)";
  ctx.font        = "bold 13px monospace";
  ctx.textAlign   = "center";
  ctx.letterSpacing = "3px";
  ctx.fillText("ZONE ENNEMIE", isLeft ? W * 0.75 : W * 0.25, 30);
  ctx.textAlign   = "left";
}

// Indicateur visuel de visée pour le joueur actif
function drawAimingUI() {
  if (gameState !== "aiming") return;
  const p    = players[currentPlayer];
  const isP1 = currentPlayer === 0;
  const gx   = p.x;
  const gy   = tHeight(p.x) - 14;
  const rad  = (p.angle * Math.PI) / 180;

  // Trajectoire parabolique prédite (pointillés)
  ctx.save();
  ctx.setLineDash([4, 8]);
  ctx.strokeStyle = p.color + "55";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();

  let px = gx, py = gy;
  let vx = Math.cos(rad) * p.power * p.fireDir;
  let vy = -Math.sin(rad) * p.power;
  ctx.moveTo(px, py);

  for (let i = 0; i < 90; i++) {
    vx += 0;
    vy += GRAVITY;
    px += vx;
    py += vy;
    if (py > tHeight(px) || px < 0 || px > W) break;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

// ─── HUD DOM ────────────────────────────────────────────────
function updateHUD() {
  players.forEach((p, i) => {
    const n = i === 0 ? "p1" : "p2";
    document.getElementById(`hp-${n}`).textContent    = p.hp;
    document.getElementById(`hp-bar-${n}`).style.width = `${(p.hp / MAX_HP) * 100}%`;
    document.getElementById(`angle-${n}`).textContent  = `${Math.round(p.angle)}°`;
    document.getElementById(`power-${n}`).textContent  = Math.round(p.power);
  });

  const tn    = document.getElementById("turn-name");
  const cp    = players[currentPlayer];
  tn.textContent = cp.name;
  tn.style.color  = cp.color;

  document.getElementById("hud-p1").style.outline =
    currentPlayer === 0 && gameState === "aiming" ? `1px solid ${C.p1}` : "none";
  document.getElementById("hud-p2").style.outline =
    currentPlayer === 1 && gameState === "aiming" ? `1px solid ${C.p2}` : "none";
}

function showGameOver(winnerKey) {
  const isP1  = winnerKey === "player1";
  const title = document.getElementById("overlay-title");
  title.textContent = isP1 ? "MORTIER ROUGE GAGNE" : "MORTIER BLEU GAGNE";
  title.style.color  = isP1 ? C.p1 : C.p2;
  document.getElementById("overlay-sub").textContent = "Adversaire réduit en cendres !";
  document.getElementById("overlay").removeAttribute("hidden");
}

// ─── API scores ──────────────────────────────────────────────
async function recordResult(winnerKey) {
  try {
    const r = await fetch("/api/scores/mortar/record", {
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
    const r = await fetch("/api/scores/mortar");
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
  if (gameState !== "gameover") update();
  render();
  requestAnimationFrame(tick);
}

// Init preview
terrain = generateTerrain();
initPlayers();
render();
loadScores();
