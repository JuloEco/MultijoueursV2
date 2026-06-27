// ============================================================
// CODE BREAKER — Mastermind duel simultané, 2 joueurs
// Phases : setup_p1 → setup_p2 → playing (simultané) → end
// ============================================================

// ─── Palette ────────────────────────────────────────────────
const COLORS = [
  { id: 0, hex: "#d6543c", name: "rouge"  },
  { id: 1, hex: "#4f8fae", name: "bleu"   },
  { id: 2, hex: "#8fb33f", name: "vert"   },
  { id: 3, hex: "#f2a640", name: "or"     },
  { id: 4, hex: "#c875c4", name: "violet" },
  { id: 5, hex: "#d8d6c8", name: "blanc"  },
];

const CODE_LEN  = 4;
const MAX_TRIES = 10;
const BG        = "#11140f";
const P1_COLOR  = "#d6543c";
const P2_COLOR  = "#4f8fae";
const PHOS      = "#8fb33f";
const LINE      = "#3a4530";

// ─── État ────────────────────────────────────────────────────
let secrets    = [null, null];   // codes secrets [p1, p2]
let guesses    = [[], []];       // historique tentatives [{code, blacks, whites}]
let curGuess   = [[null,null,null,null], [null,null,null,null]];
let selColor   = [0, 0];        // couleur sélectionnée dans le picker
let solved     = [false, false];
let failed     = [false, false];
let setupPhase = "setup_p1";    // setup_p1 | setup_p2 | playing | done
let setupCode  = [null,null,null,null];
let setupSelColor = 0;

// ─── Utils ───────────────────────────────────────────────────
function evaluate(secret, guess) {
  let blacks = 0, whites = 0;
  const sUsed = Array(CODE_LEN).fill(false);
  const gUsed = Array(CODE_LEN).fill(false);
  // Noirs d'abord
  for (let i = 0; i < CODE_LEN; i++) {
    if (secret[i] === guess[i]) { blacks++; sUsed[i] = gUsed[i] = true; }
  }
  // Blancs/Verts
  for (let i = 0; i < CODE_LEN; i++) {
    if (gUsed[i]) continue;
    for (let j = 0; j < CODE_LEN; j++) {
      if (sUsed[j]) continue;
      if (guess[i] === secret[j]) { whites++; sUsed[j] = true; break; }
    }
  }
  return { blacks, whites };
}

function randomCode() {
  return Array(CODE_LEN).fill(0).map(() => Math.floor(Math.random() * COLORS.length));
}

// ─── Initialisation ──────────────────────────────────────────
function initRound() {
  secrets    = [null, null];
  guesses    = [[], []];
  curGuess   = [[null,null,null,null],[null,null,null,null]];
  selColor   = [0, 0];
  solved     = [false, false];
  failed     = [false, false];
  setupCode  = [null,null,null,null];
  setupSelColor = 0;
  setupPhase = "setup_p1";

  document.getElementById("overlay-end").setAttribute("hidden", "");
  document.getElementById("game-area").style.display = "none";

  buildSetupPicker();
  renderSetupCode();
  document.getElementById("setup-title").textContent = "J1 ROUGE — CHOISISSEZ VOTRE CODE";
  document.getElementById("setup-title").style.color = P1_COLOR;
  document.getElementById("overlay-setup").removeAttribute("hidden");

  buildPickers();
  drawBoard(0);
  drawBoard(1);
  drawSecret(0, false);
  drawSecret(1, false);
  updateAttemptsLabel();
}

// ─── Setup UI ────────────────────────────────────────────────
function buildSetupPicker() {
  const el = document.getElementById("setup-picker");
  el.innerHTML = "";
  COLORS.forEach(c => {
    const dot = document.createElement("div");
    dot.className = "color-dot" + (c.id === setupSelColor ? " sel" : "");
    dot.style.background = c.hex;
    dot.addEventListener("click", () => {
      setupSelColor = c.id;
      document.querySelectorAll("#setup-picker .color-dot").forEach((d, i) => {
        d.classList.toggle("sel", i === setupSelColor);
      });
    });
    el.appendChild(dot);
  });

  // Clic sur les peg du code setup
  for (let i = 0; i < CODE_LEN; i++) {
    const peg = document.getElementById(`sg-${i}`);
    peg.onclick = () => {
      setupCode[i] = setupSelColor;
      renderSetupCode();
    };
  }
}

function renderSetupCode() {
  for (let i = 0; i < CODE_LEN; i++) {
    const peg = document.getElementById(`sg-${i}`);
    peg.style.background = setupCode[i] !== null ? COLORS[setupCode[i]].hex : "#0a0c08";
    peg.style.border = setupCode[i] !== null ? "2px solid #fff4" : "2px dashed #3a4530";
  }
}

document.getElementById("setup-confirm").addEventListener("click", () => {
  if (setupCode.some(c => c === null)) return; // code incomplet

  if (setupPhase === "setup_p1") {
    secrets[0] = [...setupCode];
    setupCode  = [null,null,null,null];
    setupPhase = "setup_p2";
    document.getElementById("setup-title").textContent = "J2 BLEU — CHOISISSEZ VOTRE CODE";
    document.getElementById("setup-title").style.color = P2_COLOR;
    renderSetupCode();
    buildSetupPicker();

    // Overlay "passez le clavier"
    showPassModal("J2 BLEU", () => {
      document.getElementById("overlay-setup").removeAttribute("hidden");
    });
    document.getElementById("overlay-setup").setAttribute("hidden","");

  } else if (setupPhase === "setup_p2") {
    secrets[1] = [...setupCode];
    setupPhase = "playing";
    document.getElementById("overlay-setup").setAttribute("hidden","");
    document.getElementById("game-area").style.display = "grid";
    document.getElementById("round-status").textContent = "JEU EN COURS — JOUEZ SIMULTANÉMENT";
  }
});

// ─── Pickers in-game ────────────────────────────────────────
function buildPickers() {
  [0, 1].forEach(pi => {
    const el = document.getElementById(`picker-p${pi + 1}`);
    el.innerHTML = "";
    COLORS.forEach(c => {
      const dot = document.createElement("div");
      dot.className = "color-dot" + (c.id === selColor[pi] ? " sel" : "");
      dot.style.background = c.hex;
      dot.addEventListener("click", () => {
        selColor[pi] = c.id;
        el.querySelectorAll(".color-dot").forEach((d, i) => {
          d.classList.toggle("sel", i === selColor[pi]);
        });
      });
      el.appendChild(dot);
    });

    // Peg de la rangée courante
    for (let i = 0; i < CODE_LEN; i++) {
      const peg = document.getElementById(`cp${pi+1}-${i}`);
      peg.onclick = () => {
        if (solved[pi] || failed[pi]) return;
        curGuess[pi][i] = selColor[pi];
        peg.style.background = COLORS[selColor[pi]].hex;
        peg.style.border = "2px solid #fff4";
      };
    }

    document.getElementById(`submit-p${pi+1}`).onclick = () => submitGuess(pi);
  });
}

// ─── Logique de jeu ──────────────────────────────────────────
function submitGuess(pi) {
  if (solved[pi] || failed[pi]) return;
  if (curGuess[pi].some(c => c === null)) return; // incomplet

  const { blacks, whites } = evaluate(secrets[1 - pi], curGuess[pi]);
  guesses[pi].push({ code: [...curGuess[pi]], blacks, whites });
  curGuess[pi] = [null,null,null,null];

  // Reset pegs visuels
  for (let i = 0; i < CODE_LEN; i++) {
    const peg = document.getElementById(`cp${pi+1}-${i}`);
    peg.style.background = "#0a0c08";
    peg.style.border = "2px dashed #3a4530";
  }

  if (blacks === CODE_LEN) {
    solved[pi] = true;
    document.getElementById(`badge-p${pi+1}`).style.display = "block";
    document.getElementById(`submit-p${pi+1}`).disabled = true;
    drawSecret(1 - pi, true); // révèle le code de l'adversaire
  } else if (guesses[pi].length >= MAX_TRIES) {
    failed[pi] = true;
    document.getElementById(`submit-p${pi+1}`).disabled = true;
    drawSecret(1 - pi, true);
  }

  drawBoard(pi);
  updateAttemptsLabel();
  checkEnd();
}

function checkEnd() {
  const bothDone = (solved[0] || failed[0]) && (solved[1] || failed[1]);
  if (!bothDone) return;

  setupPhase = "done";
  let winnerKey = null;
  let title, sub;

  const att0 = guesses[0].length;
  const att1 = guesses[1].length;

  if (solved[0] && solved[1]) {
    if (att0 < att1) { winnerKey = "player1"; title = "J1 ROUGE GAGNE"; sub = `${att0} tentatives contre ${att1}`; }
    else if (att1 < att0) { winnerKey = "player2"; title = "J2 BLEU GAGNE"; sub = `${att1} tentatives contre ${att0}`; }
    else { title = "ÉGALITÉ !"; sub = `Les deux en ${att0} tentatives`; }
  } else if (solved[0] && !solved[1]) {
    winnerKey = "player1"; title = "J1 ROUGE GAGNE"; sub = "J2 n'a pas trouvé le code";
  } else if (solved[1] && !solved[0]) {
    winnerKey = "player2"; title = "J2 BLEU GAGNE"; sub = "J1 n'a pas trouvé le code";
  } else {
    title = "AUCUN VAINQUEUR"; sub = "Les deux ont échoué !";
  }

  const el = document.getElementById("end-title");
  el.textContent = title;
  el.style.color  = winnerKey === "player1" ? P1_COLOR : winnerKey === "player2" ? P2_COLOR : PHOS;
  document.getElementById("end-sub").textContent = sub;
  document.getElementById("overlay-end").removeAttribute("hidden");
  if (winnerKey) recordResult(winnerKey);
}

// ─── Canvas drawing ─────────────────────────────────────────
function drawBoard(pi) {
  const canvas = document.getElementById(`board-p${pi+1}`);
  const ctx    = canvas.getContext("2d");
  const cw     = canvas.width;
  const ch     = canvas.height;
  const ROW_H  = ch / MAX_TRIES;
  const PEG_R  = 10;
  const PEG_GAP= 30;
  const START_X= 20;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, cw, ch);

  // Numéros de rangée + historique
  guesses[pi].forEach((g, row) => {
    const y = ch - (row + 1) * ROW_H + ROW_H / 2;

    // Fond de rangée alternée
    ctx.fillStyle = row % 2 === 0 ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.1)";
    ctx.fillRect(0, ch - (row + 1) * ROW_H, cw, ROW_H);

    // Numéro
    ctx.fillStyle = "#3a4530";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(row + 1, 14, y + 4);
    ctx.textAlign = "left";

    // Pegs couleur
    g.code.forEach((c, i) => {
      ctx.fillStyle = COLORS[c].hex;
      ctx.beginPath();
      ctx.arc(START_X + i * PEG_GAP, y, PEG_R, 0, Math.PI * 2);
      ctx.fill();
    });

    // Indices (2×2 grille)
    const hx = START_X + CODE_LEN * PEG_GAP + 16;
    let idx = 0;
    for (let hy = 0; hy < 2; hy++) {
      for (let hxi = 0; hxi < 2; hxi++) {
        const filled = idx < g.blacks ? "black" : idx < g.blacks + g.whites ? "white" : "empty";
        ctx.fillStyle = filled === "black" ? "#d8d6c8" : filled === "white" ? PHOS : "#232a1c";
        ctx.beginPath();
        ctx.arc(hx + hxi * 14, y - 6 + hy * 12, 4, 0, Math.PI * 2);
        ctx.fill();
        idx++;
      }
    }
  });

  // Ligne de séparation entre les tentatives
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 0.5;
  for (let i = 1; i < MAX_TRIES; i++) {
    ctx.beginPath();
    ctx.moveTo(0, ch - i * ROW_H);
    ctx.lineTo(cw, ch - i * ROW_H);
    ctx.stroke();
  }
}

function drawSecret(codeIdx, reveal) {
  // codeIdx = index du code (0=p1, 1=p2)
  // On dessine dans le canvas "secret-p{codeIdx+1}"
  const canvas = document.getElementById(`secret-p${codeIdx+1}`);
  const ctx    = canvas.getContext("2d");
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!reveal || !secrets[codeIdx]) {
    // Masqué
    for (let i = 0; i < CODE_LEN; i++) {
      ctx.fillStyle = "#232a1c";
      ctx.beginPath();
      ctx.arc(14 + i * 24, 18, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3a4530";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText("?", 14 + i * 24, 22);
      ctx.textAlign = "left";
    }
  } else {
    secrets[codeIdx].forEach((c, i) => {
      ctx.fillStyle = COLORS[c].hex;
      ctx.beginPath();
      ctx.arc(14 + i * 24, 18, 9, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function updateAttemptsLabel() {
  document.getElementById("att-p1").textContent = guesses[0].length;
  document.getElementById("att-p2").textContent = guesses[1].length;
}

// ─── Modal "passez le clavier" ───────────────────────────────
function showPassModal(playerName, callback) {
  const modal = document.createElement("div");
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(10,12,8,0.96);display:flex;" +
    "align-items:center;justify-content:center;z-index:200;font-family:monospace;";
  const color = playerName.includes("BLEU") ? P2_COLOR : P1_COLOR;
  modal.innerHTML = `
    <div style="text-align:center;border:1px solid #3a4530;background:#11140f;padding:32px 48px;max-width:380px;">
      <h2 style="color:${color};letter-spacing:2px;margin-bottom:12px;font-size:17px;">AU TOUR DE ${playerName}</h2>
      <p style="color:#5c7330;font-size:12px;margin-bottom:20px;">
        Passez l'écran. L'autre joueur ferme les yeux.<br>
        Choisissez votre code secret.
      </p>
      <button id="pass-ok" style="font-family:monospace;background:#8fb33f;color:#11140f;border:none;padding:10px 22px;font-size:12px;letter-spacing:2px;font-weight:700;cursor:pointer;">PRÊT →</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector("#pass-ok").addEventListener("click", () => {
    modal.remove();
    callback();
  });
}

// ─── API scores ──────────────────────────────────────────────
async function recordResult(winnerKey) {
  try {
    const r = await fetch("/api/scores/codebreaker/record", {
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
    const r = await fetch("/api/scores/codebreaker");
    const s = await r.json();
    document.getElementById("score-p1").textContent = s.player1;
    document.getElementById("score-p2").textContent = s.player2;
  } catch(e) {}
}

// ─── Boutons ────────────────────────────────────────────────
document.getElementById("btn-start").addEventListener("click", () => {
  document.getElementById("overlay-start").setAttribute("hidden", "");
  initRound();
});

document.getElementById("btn-restart").addEventListener("click", () => {
  showPassModal("J1 ROUGE", () => initRound());
});

loadScores();
