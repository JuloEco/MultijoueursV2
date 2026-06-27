// ============================================================
// TANKS — duel d'artillerie 2 joueurs locaux
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const GRAVITY = 0.22;
const MAX_POWER = 16;       // vitesse initiale max de l'obus
const CHARGE_RATE = 0.018;  // vitesse de charge de la puissance (0..1 par frame)
const MOVE_SPEED = 2.2;
const EXPLOSION_RADIUS = 34;
const TANK_WIDTH = 28;
const TANK_HEIGHT = 14;

// ---------- Etat global ----------
let terrain = [];           // hauteur du sol pour chaque x (0..W)
let tanks = [];              // {x, hp, angle, power, color, name, alive, charging}
let projectile = null;       // {x, y, vx, vy, owner}
let explosions = [];         // particules d'explosion en cours
let wind = 0;                // force du vent (-1..1)
let currentPlayer = 0;       // 0 = joueur1, 1 = joueur2
let gameState = "idle";      // idle | aiming | flying | exploding | gameover
let keys = {};

const COLORS = {
  p1: "#d6543c",
  p2: "#4f8fae",
  terrain: "#4a5a35",
  terrainDark: "#2e3a1f",
  sky1: "#1c2317",
  sky2: "#11140f",
};

// ---------- Génération du terrain ----------
function generateTerrain() {
  const points = [];
  const segments = 9;
  const segW = W / segments;
  for (let i = 0; i <= segments; i++) {
    const baseHeight = H * 0.62;
    const variance = H * 0.22;
    points.push(baseHeight + (Math.random() - 0.5) * variance);
  }
  // s'assure que les deux extremites (zones de spawn) sont plus plates
  points[0] = H * 0.6;
  points[1] = H * 0.6 + (Math.random() - 0.5) * 20;
  points[segments - 1] = H * 0.6 + (Math.random() - 0.5) * 20;
  points[segments] = H * 0.6;

  const heights = new Array(W + 1);
  for (let x = 0; x <= W; x++) {
    const seg = Math.min(Math.floor(x / segW), segments - 1);
    const t = (x - seg * segW) / segW;
    const smooth = t * t * (3 - 2 * t); // smoothstep
    heights[x] = points[seg] * (1 - smooth) + points[seg + 1] * smooth;
  }
  return heights;
}

function terrainHeightAt(x) {
  const xi = Math.max(0, Math.min(W, Math.round(x)));
  return terrain[xi];
}

function carveCrater(cx, radius) {
  const left = Math.max(0, Math.floor(cx - radius));
  const right = Math.min(W, Math.ceil(cx + radius));
  for (let x = left; x <= right; x++) {
    const dx = x - cx;
    const depth = Math.sqrt(Math.max(0, radius * radius - dx * dx));
    terrain[x] = Math.min(H - 4, terrain[x] + depth * 0.9);
  }
}

// ---------- Initialisation des tanks ----------
function initTanks() {
  const x1 = W * 0.12;
  const x2 = W * 0.88;
  tanks = [
    { x: x1, hp: 100, angle: 45, power: 0, charging: false, alive: true, color: COLORS.p1, key: "p1" },
    { x: x2, hp: 100, angle: 135, power: 0, charging: false, alive: true, color: COLORS.p2, key: "p2" },
  ];
}

function resetRound(keepScore = true) {
  terrain = generateTerrain();
  initTanks();
  projectile = null;
  explosions = [];
  wind = (Math.random() - 0.5) * 2;
  currentPlayer = 0;
  gameState = "aiming";
  updateHUD();
}

// ---------- Entrées clavier ----------
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["Space", "Enter", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

// ---------- Boucle de mise a jour ----------
function update() {
  if (gameState === "aiming") {
    handleAiming();
  } else if (gameState === "flying") {
    updateProjectile();
  } else if (gameState === "exploding") {
    updateExplosions();
  }
}

function handleAiming() {
  const tank = tanks[currentPlayer];
  const isP1 = currentPlayer === 0;

  const keyLeft = isP1 ? "KeyA" : "ArrowLeft";
  const keyRight = isP1 ? "KeyD" : "ArrowRight";
  const keyUp = isP1 ? "KeyW" : "ArrowUp";
  const keyDown = isP1 ? "KeyS" : "ArrowDown";
  const keyFire = isP1 ? "Space" : "Enter";

  // Deplacement laterale (reste sur le terrain)
  if (keys[keyLeft]) tank.x = Math.max(20, tank.x - MOVE_SPEED);
  if (keys[keyRight]) tank.x = Math.min(W - 20, tank.x + MOVE_SPEED);

  // Visee : 0..180 degres (demi-cercle vers le haut)
  if (isP1) {
    if (keys[keyUp]) tank.angle = Math.min(180, tank.angle + 1.3);
    if (keys[keyDown]) tank.angle = Math.max(0, tank.angle - 1.3);
  } else {
    if (keys[keyUp]) tank.angle = Math.max(0, tank.angle - 1.3);
    if (keys[keyDown]) tank.angle = Math.min(180, tank.angle + 1.3);
  }

  // Charge / tir
  if (keys[keyFire]) {
    tank.charging = true;
    tank.power = Math.min(1, tank.power + CHARGE_RATE);
  } else if (tank.charging) {
    fireProjectile(tank);
    tank.charging = false;
  }

  updateHUD();
}

function fireProjectile(tank) {
  const rad = (tank.angle * Math.PI) / 180;
  const speed = 4 + tank.power * MAX_POWER;
  const dir = currentPlayer === 0 ? 1 : -1; // p1 tire vers la droite, p2 vers la gauche

  projectile = {
    x: tank.x,
    y: terrainHeightAt(tank.x) - TANK_HEIGHT - 4,
    vx: Math.cos(rad) * speed * dir,
    vy: -Math.sin(rad) * speed,
    owner: currentPlayer,
    trail: [],
  };
  tank.power = 0;
  gameState = "flying";
}

function updateProjectile() {
  if (!projectile) return;

  projectile.trail.push({ x: projectile.x, y: projectile.y });
  if (projectile.trail.length > 18) projectile.trail.shift();

  projectile.vx += wind * 0.012;
  projectile.vy += GRAVITY;
  projectile.x += projectile.vx;
  projectile.y += projectile.vy;

  // Hors de l'ecran -> tour suivant
  if (projectile.x < 0 || projectile.x > W || projectile.y > H + 50) {
    endTurnNoHit();
    return;
  }

  // Collision avec le terrain
  if (projectile.y >= terrainHeightAt(projectile.x)) {
    resolveImpact(projectile.x, projectile.y);
    return;
  }

  // Collision avec un tank (boite simple)
  for (let i = 0; i < tanks.length; i++) {
    const t = tanks[i];
    if (!t.alive) continue;
    const top = terrainHeightAt(t.x) - TANK_HEIGHT;
    if (
      projectile.x > t.x - TANK_WIDTH / 2 &&
      projectile.x < t.x + TANK_WIDTH / 2 &&
      projectile.y > top &&
      projectile.y < top + TANK_HEIGHT
    ) {
      resolveImpact(projectile.x, projectile.y);
      return;
    }
  }
}

function resolveImpact(x, y) {
  carveCrater(x, EXPLOSION_RADIUS);

  // Degats par distance a chaque tank encore en vie
  tanks.forEach((t) => {
    if (!t.alive) return;
    const dist = Math.hypot(t.x - x, (terrainHeightAt(t.x) - TANK_HEIGHT / 2) - y);
    if (dist < EXPLOSION_RADIUS) {
      const dmg = Math.round((1 - dist / EXPLOSION_RADIUS) * 55 + 15);
      t.hp = Math.max(0, t.hp - dmg);
    }
    // un tank peut se retrouver en suspension si le sol s'est effondre sous lui
    const groundY = terrainHeightAt(t.x);
    t.y = groundY;
  });

  explosions.push({ x, y, r: 4, maxR: EXPLOSION_RADIUS * 1.4, life: 1 });
  projectile = null;
  gameState = "exploding";
}

function updateExplosions() {
  explosions.forEach((ex) => {
    ex.r += (ex.maxR - ex.r) * 0.18;
    ex.life -= 0.06;
  });
  explosions = explosions.filter((ex) => ex.life > 0);

  if (explosions.length === 0) {
    checkGameOver();
  }
}

function endTurnNoHit() {
  projectile = null;
  checkGameOver();
}

function checkGameOver() {
  const loser = tanks.find((t) => t.hp <= 0);
  if (loser) {
    loser.alive = false;
    const winnerKey = loser.key === "p1" ? "player2" : "player1";
    gameState = "gameover";
    showGameOver(winnerKey);
    recordResult(winnerKey);
  } else {
    currentPlayer = currentPlayer === 0 ? 1 : 0;
    wind = (Math.random() - 0.5) * 2;
    gameState = "aiming";
  }
  updateHUD();
}

// ---------- Rendu ----------
function render() {
  // Ciel
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, COLORS.sky1);
  skyGrad.addColorStop(1, COLORS.sky2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  drawStars();
  drawTerrain();
  tanks.forEach((t, i) => drawTank(t, i));
  if (projectile) drawProjectile();
  explosions.forEach(drawExplosion);
}

function drawStars() {
  ctx.fillStyle = "rgba(143,179,63,0.25)";
  for (let i = 0; i < 28; i++) {
    const sx = (i * 197) % W;
    const sy = (i * 83) % (H * 0.4);
    ctx.fillRect(sx, sy, 1, 1);
  }
}

function drawTerrain() {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 2) {
    ctx.lineTo(x, terrain[x]);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, H * 0.5, 0, H);
  grad.addColorStop(0, COLORS.terrain);
  grad.addColorStop(1, COLORS.terrainDark);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = "rgba(143,179,63,0.4)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, terrain[0]);
  for (let x = 0; x <= W; x += 2) ctx.lineTo(x, terrain[x]);
  ctx.stroke();
}

function drawTank(t, index) {
  const groundY = terrainHeightAt(t.x);
  const x = t.x;
  const y = groundY;

  ctx.save();
  ctx.translate(x, y);

  // corps
  ctx.fillStyle = t.alive ? t.color : "#444";
  ctx.fillRect(-TANK_WIDTH / 2, -TANK_HEIGHT, TANK_WIDTH, TANK_HEIGHT);
  // chenilles
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(-TANK_WIDTH / 2 - 2, -4, TANK_WIDTH + 4, 5);

  // tourelle / canon
  if (t.alive) {
    const rad = (t.angle * Math.PI) / 180;
    const dir = index === 0 ? 1 : -1;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -TANK_HEIGHT);
    ctx.lineTo(Math.cos(rad) * 20 * dir, -TANK_HEIGHT - Math.sin(rad) * 20);
    ctx.stroke();
  }

  ctx.restore();

  // barre de charge au-dessus du tank actif
  if (t.alive && t.charging) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - 16, y - TANK_HEIGHT - 30, 32, 5);
    ctx.fillStyle = "#8fb33f";
    ctx.fillRect(x - 16, y - TANK_HEIGHT - 30, 32 * t.power, 5);
  }
}

function drawProjectile() {
  // trainee
  projectile.trail.forEach((p, i) => {
    ctx.globalAlpha = i / projectile.trail.length * 0.5;
    ctx.fillStyle = "#e8d77a";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#f2e9b0";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawExplosion(ex) {
  if (ex.life <= 0) return;
  const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, ex.r);
  grad.addColorStop(0, `rgba(255,220,130,${ex.life})`);
  grad.addColorStop(0.5, `rgba(255,120,60,${ex.life * 0.7})`);
  grad.addColorStop(1, "rgba(255,80,40,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- HUD / DOM ----------
function updateHUD() {
  document.getElementById("hp-p1").style.width = `${tanks[0].hp}%`;
  document.getElementById("hp-p2").style.width = `${tanks[1].hp}%`;
  document.getElementById("angle-p1").textContent = `${Math.round(tanks[0].angle)}°`;
  document.getElementById("angle-p2").textContent = `${Math.round(tanks[1].angle)}°`;
  document.getElementById("power-p1").textContent = `${Math.round(tanks[0].power * 100)}%`;
  document.getElementById("power-p2").textContent = `${Math.round(tanks[1].power * 100)}%`;

  const turnName = currentPlayer === 0 ? "TANK ROUGE" : "TANK BLEU";
  document.getElementById("turn-name").textContent = turnName;
  document.getElementById("turn-name").style.color = currentPlayer === 0 ? COLORS.p1 : COLORS.p2;

  document.getElementById("hud-p1").style.outline = currentPlayer === 0 && gameState === "aiming" ? "1px solid " + COLORS.p1 : "none";
  document.getElementById("hud-p2").style.outline = currentPlayer === 1 && gameState === "aiming" ? "1px solid " + COLORS.p2 : "none";

  const windArrow = document.getElementById("wind-arrow");
  const windValue = document.getElementById("wind-value");
  windArrow.textContent = wind > 0.05 ? "→" : wind < -0.05 ? "←" : "·";
  windValue.textContent = Math.abs(Math.round(wind * 10));
}

function showGameOver(winnerKey) {
  const overlay = document.getElementById("overlay");
  const title = document.getElementById("overlay-title");
  const sub = document.getElementById("overlay-sub");
  const isP1 = winnerKey === "player1";
  title.textContent = isP1 ? "TANK ROUGE GAGNE" : "TANK BLEU GAGNE";
  title.style.color = isP1 ? COLORS.p1 : COLORS.p2;
  sub.textContent = "Manche terminée";
  overlay.removeAttribute("hidden");
}

async function recordResult(winnerKey) {
  try {
    const res = await fetch("/api/scores/tanks/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ winner: winnerKey }),
    });
    const scores = await res.json();
    applyScores(scores);
  } catch (err) {
    console.error("Impossible d'enregistrer le score :", err);
  }
}

function applyScores(scores) {
  document.getElementById("score-p1").textContent = scores.player1;
  document.getElementById("score-p2").textContent = scores.player2;
}

async function loadScores() {
  try {
    const res = await fetch("/api/scores/tanks");
    const scores = await res.json();
    applyScores(scores);
  } catch (err) {
    console.error("Impossible de charger les scores :", err);
  }
}

// ---------- Boutons ----------
document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("overlay-start").setAttribute("hidden", "");
  resetRound();
  loop();
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("overlay").setAttribute("hidden", "");
  resetRound();
});

// ---------- Boucle principale ----------
let loopStarted = false;
function loop() {
  if (loopStarted) return;
  loopStarted = true;
  requestAnimationFrame(tick);
}
function tick() {
  if (gameState !== "gameover") {
    update();
  }
  render();
  requestAnimationFrame(tick);
}

// Etat initial : terrain genere derriere l'overlay de bienvenue
terrain = generateTerrain();
initTanks();
render();
loadScores();
