// ============================================================
// SUPPLY DROP — caisses qui tombent, 2 zones de collecte
// Normale +1 · Dorée +3 · Piège −2 · Streak bonus · 60s
// ============================================================

const canvas = document.getElementById("game");
const ctx    = canvas.getContext("2d");
const W = canvas.width;   // 980
const H = canvas.height;  // 520

// ─── Constantes ──────────────────────────────────────────────
const GAME_DURATION = 60;      // secondes
const CATCHER_W     = 90;
const CATCHER_H     = 16;
const CATCHER_Y     = H - 40;
const CATCHER_SPEED = 5.5;
const BOX_W         = 30;
const BOX_H         = 26;
const BOX_SPAWN_INT = 55;      // frames entre apparitions
const BOX_FALL_BASE = 2.2;
const BOX_FALL_INC  = 0.0012;  // accélération progressive

// ─── Couleurs ────────────────────────────────────────────────
const C = {
  p1: "#d6543c", p1dim: "#6b3326", p1glow: "rgba(214,84,60,0.25)",
  p2: "#4f8fae", p2dim: "#2c4956", p2glow: "rgba(79,143,174,0.25)",
  phosphor: "#8fb33f", phosphorDim: "#5c7330",
  bg: "#11140f", ground: "#2e3a1f", groundLine: "#4a5a35",
  boxNormal: "#8fb33f", boxGold: "#f2a640", boxTrap: "#e05020",
  star: "rgba(143,179,63,0.25)",
  floatText: [],
};

// ─── État ────────────────────────────────────────────────────
let catchers, boxes, scores, streaks, frame, timeLeft, gameState, keys, spawnTimer;
let floatTexts = [];

// Types de caisses : normal | gold | trap
const BOX_TYPES = [
  { type: "normal", color: C.boxNormal, value: 1,  symbol: "■", weight: 60 },
  { type: "gold",   color: C.boxGold,   value: 3,  symbol: "★", weight: 20 },
  { type: "trap",   color: C.boxTrap,   value: -2, symbol: "✕", weight: 20 },
];

function randomBoxType() {
  const total = BOX_TYPES.reduce((s, t) => s + t.weight, 0);
  let r = Math.random() * total;
  for (const t of BOX_TYPES) { r -= t.weight; if (r <= 0) return t; }
  return BOX_TYPES[0];
}

function resetRound() {
  catchers = [
    { x: W * 0.25 - CATCHER_W / 2, color: C.p1, dimColor: C.p1dim, glow: C.p1glow, keyL: "KeyQ", keyR: "KeyD" },
    { x: W * 0.75 - CATCHER_W / 2, color: C.p2, dimColor: C.p2dim, glow: C.p2glow, keyL: "ArrowLeft", keyR: "ArrowRight" },
  ];
  boxes      = [];
  scores     = [0, 0];
  streaks    = [0, 0];
  frame      = 0;
  timeLeft   = GAME_DURATION;
  spawnTimer = 0;
  floatTexts = [];
  gameState  = "playing";
  keys       = {};
  updateHUD();
}

// ─── Input ───────────────────────────────────────────────────
window.addEventListener("keydown", e => {
  keys[e.code] = true;
  if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","KeyQ","KeyD"].includes(e.code))
    e.preventDefault();
});
window.addEventListener("keyup", e => { keys[e.code] = false; });

// ─── Update ──────────────────────────────────────────────────
function update() {
  frame++;

  // Timer (60 fps approx)
  if (frame % 60 === 0) {
    timeLeft--;
    if (timeLeft <= 0) { endRound(); return; }
  }

  // Mouvement catchers
  catchers.forEach(c => {
    if (keys[c.keyL]) c.x = Math.max(0, c.x - CATCHER_SPEED);
    if (keys[c.keyR]) c.x = Math.min(W - CATCHER_W, c.x + CATCHER_SPEED);
  });

  // Spawn de caisses
  spawnTimer++;
  if (spawnTimer >= BOX_SPAWN_INT) {
    spawnTimer = 0;
    const t = randomBoxType();
    boxes.push({
      x: 30 + Math.random() * (W - 60),
      y: -BOX_H,
      vy: BOX_FALL_BASE + frame * BOX_FALL_INC,
      ...t,
      shake: 0,
    });
  }

  // Chute des caisses + collision
  for (let i = boxes.length - 1; i >= 0; i--) {
    const b = boxes[i];
    b.vy = BOX_FALL_BASE + frame * BOX_FALL_INC;
    b.y += b.vy;

    // Collision avec catchers
    let caught = false;
    catchers.forEach((c, ci) => {
      if (caught) return;
      if (
        b.x + BOX_W > c.x && b.x < c.x + CATCHER_W &&
        b.y + BOX_H >= CATCHER_Y && b.y < CATCHER_Y + CATCHER_H
      ) {
        caught = true;
        let pts = b.value;
        if (pts > 0) {
          streaks[ci]++;
          if (streaks[ci] >= 3) pts += 1; // streak bonus
        } else {
          streaks[ci] = 0;
        }
        scores[ci] = Math.max(0, scores[ci] + pts);
        // Texte flottant
        floatTexts.push({
          x: c.x + CATCHER_W / 2, y: CATCHER_Y - 10,
          text: (pts >= 0 ? "+" : "") + pts + (streaks[ci] >= 3 ? " 🔥" : ""),
          color: pts > 0 ? (pts >= 3 ? C.boxGold : C.phosphor) : C.boxTrap,
          life: 1, vy: -1.2,
        });
        boxes.splice(i, 1);
        updateHUD();
      }
    });

    // Hors écran
    if (!caught && b.y > H + 20) {
      // Réinitialise le streak si c'était une caisse normale ou gold manquée
      boxes.splice(i, 1);
    }
  }

  // Float texts
  floatTexts.forEach(ft => { ft.y += ft.vy; ft.life -= 0.025; });
  floatTexts = floatTexts.filter(ft => ft.life > 0);
}

function endRound() {
  gameState = "gameover";
  const [s1, s2] = scores;
  const title = document.getElementById("overlay-title");
  const sub   = document.getElementById("overlay-sub");

  if (s1 > s2) {
    title.textContent = "J1 ROUGE GAGNE"; title.style.color = C.p1;
    sub.textContent   = `${s1} pts contre ${s2} pts`;
    recordResult("player1");
  } else if (s2 > s1) {
    title.textContent = "J2 BLEU GAGNE"; title.style.color = C.p2;
    sub.textContent   = `${s2} pts contre ${s1} pts`;
    recordResult("player2");
  } else {
    title.textContent = "ÉGALITÉ !"; title.style.color = C.phosphor;
    sub.textContent   = `${s1} pts partout`;
  }
  document.getElementById("overlay").removeAttribute("hidden");
}

// ─── Rendu ──────────────────────────────────────────────────
function render() {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  drawBackground();
  drawGround();
  drawBoxes();
  drawCatchers();
  drawFloatTexts();
}

function drawBackground() {
  // Étoiles filantes
  ctx.fillStyle = C.star;
  for (let i = 0; i < 35; i++) {
    ctx.fillRect(((i * 197 + frame * 0.3) % W + W) % W, (i * 83) % (H * 0.85), 1.5, 1.5);
  }
  // Ligne de séparation centrale (zone neutre)
  ctx.strokeStyle = "rgba(143,179,63,0.08)";
  ctx.lineWidth   = 1;
  ctx.setLineDash([8, 14]);
  ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, CATCHER_Y - 20); ctx.stroke();
  ctx.setLineDash([]);

  // Zones de collecte colorées (fond subtil)
  ctx.fillStyle = C.p1glow;
  ctx.fillRect(0, 0, W/2, H);
  ctx.fillStyle = C.p2glow;
  ctx.fillRect(W/2, 0, W/2, H);

  // Labels de zone
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = C.p1 + "44";
  ctx.fillText("ZONE J1", W * 0.25, 20);
  ctx.fillStyle = C.p2 + "44";
  ctx.fillText("ZONE J2", W * 0.75, 20);
  ctx.textAlign = "left";
}

function drawGround() {
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, H - 20, W, 20);
  ctx.strokeStyle = C.groundLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, H - 20); ctx.lineTo(W, H - 20); ctx.stroke();
}

function drawBoxes() {
  boxes.forEach(b => {
    // Ombre portée
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(b.x + 4, b.y + 4, BOX_W, BOX_H);

    // Corps de la caisse
    ctx.fillStyle = b.color + "cc";
    ctx.fillRect(b.x, b.y, BOX_W, BOX_H);
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(b.x, b.y, BOX_W, BOX_H);

    // Croix de cerclage
    ctx.strokeStyle = b.color + "66";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.x + BOX_W / 2, b.y);
    ctx.lineTo(b.x + BOX_W / 2, b.y + BOX_H);
    ctx.moveTo(b.x, b.y + BOX_H / 2);
    ctx.lineTo(b.x + BOX_W, b.y + BOX_H / 2);
    ctx.stroke();

    // Symbole
    ctx.fillStyle = b.type === "normal" ? C.bg : "#fff";
    ctx.font = b.type === "gold" ? "bold 14px monospace" : "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(b.symbol, b.x + BOX_W / 2, b.y + BOX_H / 2 + 5);
    ctx.textAlign = "left";

    // Traînée de chute
    ctx.fillStyle = b.color + "22";
    for (let t = 1; t <= 4; t++) {
      ctx.fillRect(b.x + t, b.y - t * 6, BOX_W - t * 2, 4);
    }
  });
}

function drawCatchers() {
  catchers.forEach((c, i) => {
    const cx = c.x + CATCHER_W / 2;

    // Halo
    const grad = ctx.createRadialGradient(cx, CATCHER_Y, 0, cx, CATCHER_Y, CATCHER_W * 0.8);
    grad.addColorStop(0, c.color + "33");
    grad.addColorStop(1, c.color + "00");
    ctx.fillStyle = grad;
    ctx.fillRect(c.x - 20, CATCHER_Y - 20, CATCHER_W + 40, 40);

    // Corps du capteur
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(c.x, CATCHER_Y, CATCHER_W, CATCHER_H, 4);
    ctx.fill();

    // Bord brillant
    ctx.strokeStyle = "#fff4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x + 6, CATCHER_Y + 2);
    ctx.lineTo(c.x + CATCHER_W - 6, CATCHER_Y + 2);
    ctx.stroke();

    // Score en direct au-dessus
    ctx.fillStyle = c.color;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${scores[i]} pts`, cx, CATCHER_Y - 8);
    ctx.textAlign = "left";

    // Streak indicator
    if (streaks[i] >= 3) {
      ctx.fillStyle = C.boxGold;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`×${streaks[i]} 🔥`, cx, CATCHER_Y - 22);
      ctx.textAlign = "left";
    }
  });
}

function drawFloatTexts() {
  floatTexts.forEach(ft => {
    ctx.globalAlpha = ft.life;
    ctx.fillStyle   = ft.color;
    ctx.font        = "bold 16px monospace";
    ctx.textAlign   = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.textAlign   = "left";
  });
  ctx.globalAlpha = 1;
}

// ─── HUD ────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById("score-val-p1").textContent = scores[0];
  document.getElementById("score-val-p2").textContent = scores[1];
  document.getElementById("timer").textContent        = `${timeLeft}s`;

  const s1 = streaks[0], s2 = streaks[1];
  // On réutilise le champ streak-p2, et on crée un équivalent pour p1 dans le JS
  const streakEl = document.getElementById("streak-p2");
  if (streakEl) streakEl.textContent = s2 >= 3 ? `×${s2} 🔥` : `×${s2 || 1}`;

  document.getElementById("hud-p1").style.outline = `1px solid ${C.p1}`;
  document.getElementById("hud-p2").style.outline = `1px solid ${C.p2}`;
}

// ─── API scores ──────────────────────────────────────────────
async function recordResult(winnerKey) {
  try {
    const r = await fetch("/api/scores/supply/record", {
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
    const r = await fetch("/api/scores/supply");
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

// Preview
catchers = [
  { x: W * 0.25 - CATCHER_W / 2, color: C.p1, dimColor: C.p1dim, glow: C.p1glow },
  { x: W * 0.75 - CATCHER_W / 2, color: C.p2, dimColor: C.p2dim, glow: C.p2glow },
];
boxes = []; scores = [0,0]; streaks = [0,0]; frame = 0; timeLeft = 60;
floatTexts = []; gameState = "idle";
render();
loadScores();
