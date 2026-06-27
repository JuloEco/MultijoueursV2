"""
Arcade 2 joueurs — plateforme multijeux locale.
Flask sert les pages et conserve les scores en mémoire (reset au redémarrage).
Jeux : tanks, pong, snake, connect4, tug, gomoku, bomber, darts, breakout
"""
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

GAMES = ["tanks", "pong", "snake", "connect4", "tug", "gomoku", "bomber", "darts", "breakout", "mortar", "radar", "trench", "minesweeper", "supply", "codebreaker"]

SCORES = {
    game: {"player1": 0, "player2": 0, "rounds_played": 0}
    for game in GAMES
}

# ---------- Pages ----------
@app.route("/")
def index():
    return render_template("index.html")

for _g in ["tanks", "pong", "snake", "connect4", "tug", "gomoku", "bomber", "darts", "breakout"]:
    def _make_view(g):
        def view():
            return render_template(f"{g}.html")
        view.__name__ = g
        return view
    app.add_url_rule(f"/{_g}", _g, _make_view(_g))

# ---------- API scores ----------
@app.route("/api/scores/<game>", methods=["GET"])
def get_scores(game):
    if game not in GAMES:
        return jsonify({"error": "jeu inconnu"}), 404
    return jsonify(SCORES[game])

@app.route("/api/scores/<game>/record", methods=["POST"])
def record_result(game):
    if game not in GAMES:
        return jsonify({"error": "jeu inconnu"}), 404
    data = request.get_json(silent=True) or {}
    winner = data.get("winner")
    if winner not in ("player1", "player2"):
        return jsonify({"error": "winner doit être 'player1' ou 'player2'"}), 400
    SCORES[game][winner] += 1
    SCORES[game]["rounds_played"] += 1
    return jsonify(SCORES[game])

@app.route("/api/scores/<game>/reset", methods=["POST"])
def reset_scores(game):
    if game not in GAMES:
        return jsonify({"error": "jeu inconnu"}), 404
    SCORES[game] = {"player1": 0, "player2": 0, "rounds_played": 0}
    return jsonify(SCORES[game])

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
