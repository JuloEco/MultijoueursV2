// ============================================================
// touch.js — Moteur de gestes universel pour tous les jeux
// Injecté sur chaque page de jeu. Détecte le jeu courant
// et injecte les contrôles tactiles appropriés.
// Stratégie : simuler des KeyboardEvent pour réutiliser
// les handlers clavier existants sans les modifier.
// ============================================================

(function () {
  "use strict";

  // ── Détection mobile ───────────────────────────────────────
  const isTouchDevice = () =>
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice()) return;

  // ── Bannière rotation (déjà dans le HTML via rotate-banner) ─
  // Injectée dynamiquement si absente
  if (!document.getElementById("rotate-banner")) {
    const banner = document.createElement("div");
    banner.id = "rotate-banner";
    banner.innerHTML = `
      <div class="rotate-icon">⟳</div>
      <p>TOURNEZ VOTRE TÉLÉPHONE<br>EN MODE PAYSAGE</p>`;
    document.body.prepend(banner);
  }

  // ── Identifier le jeu courant ──────────────────────────────
  const path   = window.location.pathname.replace("/", "") || "index";
  const GAME   = path;

  // ── Utilitaire : simuler une touche ───────────────────────
  function fireKey(code, type = "keydown") {
    const e = new KeyboardEvent(type, {
      code, key: code, bubbles: true, cancelable: true,
    });
    document.dispatchEvent(e);
    window.dispatchEvent(e);
  }

  function holdKey(code, active) {
    // Inject dans window.keys si disponible (accès direct plus fiable)
    if (window.keys !== undefined) {
      window.keys[code] = active;
    } else {
      fireKey(code, active ? "keydown" : "keyup");
    }
  }

  // ── Flash visuel au toucher ────────────────────────────────
  const flash = document.createElement("div");
  flash.className = "gesture-flash";
  document.body.appendChild(flash);

  function showFlash(x, y) {
    flash.style.left = x + "px";
    flash.style.top  = y + "px";
    flash.classList.remove("active");
    void flash.offsetWidth;
    flash.classList.add("active");
  }

  // ── Conteneur des contrôles tactiles ──────────────────────
  function createTouchControls(html) {
    let el = document.getElementById("touch-controls");
    if (!el) {
      el = document.createElement("div");
      el.id = "touch-controls";
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    return el;
  }

  // ── Bouton utilitaire ──────────────────────────────────────
  function btn(label, cls, extra = "") {
    return `<button class="t-btn ${cls}" ${extra}>${label}</button>`;
  }

  // ── Attacher un bouton à une touche (hold) ─────────────────
  function bindHold(el, code) {
    if (!el) return;
    const start = () => holdKey(code, true);
    const end   = () => holdKey(code, false);
    el.addEventListener("touchstart",  start, { passive: true });
    el.addEventListener("touchend",    end,   { passive: true });
    el.addEventListener("touchcancel", end,   { passive: true });
    el.addEventListener("mousedown",   start);
    el.addEventListener("mouseup",     end);
  }

  // ── Attacher un bouton à un tap unique ────────────────────
  function bindTap(el, code, duration = 80) {
    if (!el) return;
    el.addEventListener("touchstart", (e) => {
      showFlash(e.touches[0].clientX, e.touches[0].clientY);
      holdKey(code, true);
      setTimeout(() => holdKey(code, false), duration);
    }, { passive: true });
    el.addEventListener("mousedown", () => {
      holdKey(code, true);
      setTimeout(() => holdKey(code, false), duration);
    });
  }

  // ── Détection de swipe sur une zone ───────────────────────
  function bindSwipe(el, { up, down, left, right, tap } = {}) {
    if (!el) return;
    let sx, sy, moved;
    const THRESH = 28;

    el.addEventListener("touchstart", e => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      moved = false;
    }, { passive: true });

    el.addEventListener("touchmove", e => {
      if (!sx) return;
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESH) return;
      moved = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0 && right) { holdKey(right, true); setTimeout(() => holdKey(right, false), 120); }
        else if (left)       { holdKey(left,  true); setTimeout(() => holdKey(left,  false), 120); }
      } else {
        if (dy > 0 && down)  { holdKey(down,  true); setTimeout(() => holdKey(down,  false), 120); }
        else if (up)         { holdKey(up,    true); setTimeout(() => holdKey(up,    false), 120); }
      }
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener("touchend", e => {
      if (!moved && tap) {
        showFlash(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        holdKey(tap, true);
        setTimeout(() => holdKey(tap, false), 80);
      }
      sx = sy = null; moved = false;
    }, { passive: true });
  }

  // ── Construction d'un D-pad ────────────────────────────────
  function dpad(prefix, { up, down, left, right }, pClass) {
    return `
    <div class="dpad">
      <div></div>
      ${btn("▲", `t-btn t-btn-sm ${pClass}`, `id="${prefix}-up"`)}
      <div></div>
      ${btn("◀", `t-btn t-btn-sm ${pClass}`, `id="${prefix}-left"`)}
      <div class="dpad-center"></div>
      ${btn("▶", `t-btn t-btn-sm ${pClass}`, `id="${prefix}-right"`)}
      <div></div>
      ${btn("▼", `t-btn t-btn-sm ${pClass}`, `id="${prefix}-down"`)}
      <div></div>
    </div>`;
  }

  function bindDpad(prefix, { up, down, left, right }) {
    bindHold(document.getElementById(`${prefix}-up`),    up);
    bindHold(document.getElementById(`${prefix}-down`),  down);
    bindHold(document.getElementById(`${prefix}-left`),  left);
    bindHold(document.getElementById(`${prefix}-right`), right);
  }

  // ══════════════════════════════════════════════════════════
  // Configurations par jeu
  // ══════════════════════════════════════════════════════════

  // ── Attente que le DOM soit prêt ──────────────────────────
  function init() {
    switch (GAME) {

      // ── TANKS ───────────────────────────────────────────
      case "tanks": {
        createTouchControls(`
          <div class="touch-zone">
            <div class="touch-zone-label">J1 ROUGE</div>
            <div class="touch-zone-inner">
              ${dpad("t1", {up:"t1u",down:"t1d",left:"t1l",right:"t1r"}, "p1")}
              ${btn("🔥", "t-btn t-btn-lg p1", 'id="t1-fire"')}
            </div>
          </div>
          <div class="touch-divider"></div>
          <div class="touch-zone">
            <div class="touch-zone-label">J2 BLEU</div>
            <div class="touch-zone-inner">
              ${btn("🔥", "t-btn t-btn-lg p2", 'id="t2-fire"')}
              ${dpad("t2", {up:"t2u",down:"t2d",left:"t2l",right:"t2r"}, "p2")}
            </div>
          </div>`);

        bindDpad("t1", { up:"KeyW", down:"KeyS", left:"KeyA", right:"KeyD" });
        bindDpad("t2", { up:"ArrowUp", down:"ArrowDown", left:"ArrowLeft", right:"ArrowRight" });
        // Feu = appui long sur Space / Enter
        bindHold(document.getElementById("t1-fire"), "Space");
        bindHold(document.getElementById("t2-fire"), "Enter");
        break;
      }

      // ── PONG ────────────────────────────────────────────
      case "pong": {
        createTouchControls(`
          <div class="touch-zone">
            <div class="touch-zone-label">J1 ROUGE</div>
            <div class="touch-zone-inner">
              ${btn("▲", "t-btn t-btn-xl p1", 'id="p1-up"')}
              ${btn("▼", "t-btn t-btn-xl p1", 'id="p1-down"')}
            </div>
          </div>
          <div class="touch-divider"></div>
          <div class="touch-zone">
            <div class="touch-zone-label">J2 BLEU</div>
            <div class="touch-zone-inner">
              ${btn("▲", "t-btn t-btn-xl p2", 'id="p2-up"')}
              ${btn("▼", "t-btn t-btn-xl p2", 'id="p2-down"')}
            </div>
          </div>`);

        bindHold(document.getElementById("p1-up"),   "KeyW");
        bindHold(document.getElementById("p1-down"), "KeyS");
        bindHold(document.getElementById("p2-up"),   "ArrowUp");
        bindHold(document.getElementById("p2-down"), "ArrowDown");
        break;
      }

      // ── SNAKE ───────────────────────────────────────────
      case "snake": {
        createTouchControls(`
          <div class="swipe-zone" id="snake-swipe-p1" style="border-right:1px solid rgba(58,69,48,0.4)">
            <div style="font-size:28px;color:var(--p1)">⊕</div>
            <span style="color:var(--p1)">J1 — SWIPE</span>
          </div>
          <div class="swipe-zone" id="snake-swipe-p2">
            <div style="font-size:28px;color:var(--p2)">⊕</div>
            <span style="color:var(--p2)">J2 — SWIPE</span>
          </div>`);

        bindSwipe(document.getElementById("snake-swipe-p1"), {
          up:"KeyW", down:"KeyS", left:"KeyA", right:"KeyD",
        });
        bindSwipe(document.getElementById("snake-swipe-p2"), {
          up:"ArrowUp", down:"ArrowDown", left:"ArrowLeft", right:"ArrowRight",
        });
        break;
      }

      // ── TRENCH RUN ──────────────────────────────────────
      case "trench": {
        createTouchControls(`
          <div class="swipe-zone" id="trench-p1" style="border-right:1px solid rgba(58,69,48,0.4)">
            <div style="font-size:28px;color:var(--p1)">↕</div>
            <span style="color:var(--p1)">J1 — SWIPE</span>
          </div>
          <div class="swipe-zone" id="trench-p2">
            <div style="font-size:28px;color:var(--p2)">↕</div>
            <span style="color:var(--p2)">J2 — SWIPE</span>
          </div>`);

        bindSwipe(document.getElementById("trench-p1"), { up:"KeyZ", down:"KeyS" });
        bindSwipe(document.getElementById("trench-p2"), { up:"ArrowUp", down:"ArrowDown" });
        break;
      }

      // ── MORTAR ──────────────────────────────────────────
      case "mortar": {
        createTouchControls(`
          <div class="touch-zone">
            <div class="touch-zone-label">J1 ROUGE · angle/force · feu</div>
            <div class="touch-zone-inner">
              ${dpad("m1", {up:"m1u",down:"m1d",left:"m1l",right:"m1r"}, "p1")}
              ${btn("💥", "t-btn t-btn-lg p1", 'id="m1-fire"')}
            </div>
          </div>
          <div class="touch-divider"></div>
          <div class="touch-zone">
            <div class="touch-zone-label">J2 BLEU · angle/force · feu</div>
            <div class="touch-zone-inner">
              ${btn("💥", "t-btn t-btn-lg p2", 'id="m2-fire"')}
              ${dpad("m2", {up:"m2u",down:"m2d",left:"m2l",right:"m2r"}, "p2")}
            </div>
          </div>`);

        // J1 : Z/S=angle, Q/D=force, Espace=feu
        bindDpad("m1", { up:"KeyZ", down:"KeyS", left:"KeyQ", right:"KeyD" });
        bindHold(document.getElementById("m1-fire"), "Space");
        // J2 : ↑/↓=angle, ←/→=force, Entrée=feu
        bindDpad("m2", { up:"ArrowUp", down:"ArrowDown", left:"ArrowLeft", right:"ArrowRight" });
        bindHold(document.getElementById("m2-fire"), "Enter");
        break;
      }

      // ── BOMBER ──────────────────────────────────────────
      case "bomber": {
        createTouchControls(`
          <div class="touch-zone">
            <div class="touch-zone-label">J1 ROUGE</div>
            <div class="touch-zone-inner">
              ${btn("◀", "t-btn t-btn-md p1", 'id="b1-left"')}
              ${btn("💣", "t-btn t-btn-lg p1", 'id="b1-bomb"')}
              ${btn("▶", "t-btn t-btn-md p1", 'id="b1-right"')}
            </div>
          </div>
          <div class="touch-divider"></div>
          <div class="touch-zone">
            <div class="touch-zone-label">J2 BLEU</div>
            <div class="touch-zone-inner">
              ${btn("◀", "t-btn t-btn-md p2", 'id="b2-left"')}
              ${btn("💣", "t-btn t-btn-lg p2", 'id="b2-bomb"')}
              ${btn("▶", "t-btn t-btn-md p2", 'id="b2-right"')}
            </div>
          </div>`);

        bindHold(document.getElementById("b1-left"),  "KeyQ");
        bindHold(document.getElementById("b1-right"), "KeyD");
        bindTap (document.getElementById("b1-bomb"),  "Space");
        bindHold(document.getElementById("b2-left"),  "ArrowLeft");
        bindHold(document.getElementById("b2-right"), "ArrowRight");
        bindTap (document.getElementById("b2-bomb"),  "Enter");
        break;
      }

      // ── SUPPLY DROP ─────────────────────────────────────
      case "supply": {
        createTouchControls(`
          <div class="touch-zone">
            <div class="touch-zone-label">J1 ROUGE</div>
            <div class="touch-zone-inner">
              ${btn("◀", "t-btn t-btn-xl p1", 'id="s1-left"')}
              ${btn("▶", "t-btn t-btn-xl p1", 'id="s1-right"')}
            </div>
          </div>
          <div class="touch-divider"></div>
          <div class="touch-zone">
            <div class="touch-zone-label">J2 BLEU</div>
            <div class="touch-zone-inner">
              ${btn("◀", "t-btn t-btn-xl p2", 'id="s2-left"')}
              ${btn("▶", "t-btn t-btn-xl p2", 'id="s2-right"')}
            </div>
          </div>`);

        bindHold(document.getElementById("s1-left"),  "KeyQ");
        bindHold(document.getElementById("s1-right"), "KeyD");
        bindHold(document.getElementById("s2-left"),  "ArrowLeft");
        bindHold(document.getElementById("s2-right"), "ArrowRight");
        break;
      }

      // ── TIR À LA CORDE ──────────────────────────────────
      case "tug": {
        createTouchControls(`
          <div class="tap-zone-full p1" id="tug-p1"
            style="border-right:1px solid rgba(58,69,48,0.4);background:rgba(214,84,60,0.06)">
            <span style="color:var(--p1);letter-spacing:2px;font-size:13px;">J1 — TAPEZ ICI !</span>
          </div>
          <div class="tap-zone-full p2" id="tug-p2"
            style="background:rgba(79,143,174,0.06)">
            <span style="color:var(--p2);letter-spacing:2px;font-size:13px;">J2 — TAPEZ ICI !</span>
          </div>`);

        document.getElementById("tug-p1").addEventListener("touchstart", (e) => {
          showFlash(e.touches[0].clientX, e.touches[0].clientY);
          holdKey("KeyQ", true);
          setTimeout(() => holdKey("KeyQ", false), 60);
        }, { passive: true });

        document.getElementById("tug-p2").addEventListener("touchstart", (e) => {
          showFlash(e.touches[0].clientX, e.touches[0].clientY);
          holdKey("KeyP", true);
          setTimeout(() => holdKey("KeyP", false), 60);
        }, { passive: true });
        break;
      }

      // ── JEUX DE GRILLE (Puissance 4, Gomoku, Minesweeper,
      //    Radar, Connect4, Darts, Breakout) ───────────────
      // Ces jeux utilisent déjà le clic souris — le touch
      // est converti en click natif automatiquement par le
      // navigateur, mais on améliore la réactivité :
      case "connect4":
      case "gomoku":
      case "minesweeper":
      case "radar":
      case "darts":
      case "codebreaker": {
        // Empêche le délai de 300ms sur mobile
        const canvas = document.getElementById("game");
        if (canvas) {
          canvas.style.touchAction = "manipulation";
          // Convertit touchend en click immédiat (sans délai)
          canvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            const t   = e.changedTouches[0];
            const evt = new MouseEvent("click", {
              bubbles: true, cancelable: true,
              clientX: t.clientX, clientY: t.clientY,
            });
            canvas.dispatchEvent(evt);
            showFlash(t.clientX, t.clientY);
          }, { passive: false });

          // Appui long = clic droit (pour drapeaux dans Minesweeper)
          if (GAME === "minesweeper") {
            let longTimer = null;
            canvas.addEventListener("touchstart", (e) => {
              const t = e.touches[0];
              longTimer = setTimeout(() => {
                const evt = new MouseEvent("contextmenu", {
                  bubbles: true, cancelable: true,
                  clientX: t.clientX, clientY: t.clientY,
                });
                canvas.dispatchEvent(evt);
                showFlash(t.clientX, t.clientY);
              }, 500);
            }, { passive: true });
            canvas.addEventListener("touchend",   () => clearTimeout(longTimer), { passive: true });
            canvas.addEventListener("touchmove",  () => clearTimeout(longTimer), { passive: true });
          }
        }

        // Pour CodeBreaker les boutons HTML sont déjà tactiles — juste supprimer le délai
        document.querySelectorAll(".color-dot, .cur-peg, .submit-btn, .setup-confirm, .btn-primary").forEach(el => {
          el.style.touchAction = "manipulation";
        });
        break;
      }

      // ── BREAKOUT ────────────────────────────────────────
      case "breakout": {
        createTouchControls(`
          <div class="touch-zone">
            <div class="touch-zone-label">J1 ROUGE</div>
            <div class="touch-zone-inner">
              ${btn("◀", "t-btn t-btn-xl p1", 'id="br1-left"')}
              ${btn("▶", "t-btn t-btn-xl p1", 'id="br1-right"')}
            </div>
          </div>
          <div class="touch-divider"></div>
          <div class="touch-zone">
            <div class="touch-zone-label">J2 BLEU</div>
            <div class="touch-zone-inner">
              ${btn("◀", "t-btn t-btn-xl p2", 'id="br2-left"')}
              ${btn("▶", "t-btn t-btn-xl p2", 'id="br2-right"')}
            </div>
          </div>`);

        bindHold(document.getElementById("br1-left"),  "KeyQ");
        bindHold(document.getElementById("br1-right"), "KeyD");
        bindHold(document.getElementById("br2-left"),  "ArrowLeft");
        bindHold(document.getElementById("br2-right"), "ArrowRight");
        break;
      }

      // ── INDEX ────────────────────────────────────────────
      case "index":
      case "": {
        // Index : les liens sont déjà tactiles, on optimise juste
        document.querySelectorAll(".play-btn, .btn-primary, .game-card").forEach(el => {
          el.style.touchAction = "manipulation";
        });
        break;
      }

    } // end switch
  } // end init

  // ── Lancer après le DOM ──────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // ── Prévenir le zoom double-tap sur tout le document ─────
  document.addEventListener("touchend", (e) => {
    if (e.target.closest("#touch-controls, #rotate-banner")) return;
    // Laisser passer les taps sur canvas (géré dans init)
  }, { passive: true });

})();
