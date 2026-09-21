"""
AI Balance Challenge — offline Flask backend.

Run with:  python app.py
Then open: http://localhost:5000  (or http://127.0.0.1:5000)

No internet connection is required — this only serves local files and
talks to the laptop's own webcam and a local SQLite file.
"""

from flask import Flask, render_template, jsonify, request

from color_detector import check_balance, calibrate_baseline
from database import init_db, save_attempt, get_leaderboard

app = Flask(__name__)

init_db()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/verify")
def verify():
    """Grabs a webcam frame and checks whether the seesaw is currently balanced."""
    result = check_balance()
    return jsonify(result)


@app.route("/recalibrate", methods=["POST"])
def recalibrate():
    """
    Re-zeroes the 'balanced' baseline angle from the current camera view.
    Level the seesaw with no weights on it before calling this.
    """
    result = calibrate_baseline()
    return jsonify(result)


@app.route("/save_attempt", methods=["POST"])
def save_attempt_route():
    """Logs one completed challenge attempt to the local SQLite database."""
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "Participant").strip() or "Participant"
    challenge = data.get("challenge")
    score = data.get("score")
    total_questions = data.get("total_questions")
    time_taken = data.get("time_taken")

    if challenge is None or score is None or total_questions is None or time_taken is None:
        return jsonify({"success": False, "error": "Missing required fields"}), 400

    save_attempt(name, challenge, score, total_questions, time_taken)

    return jsonify({"success": True})


@app.route("/leaderboard")
def leaderboard():
    """Returns top attempts, optionally filtered by ?challenge=1..4."""
    challenge = request.args.get("challenge", type=int)
    rows = get_leaderboard(challenge=challenge)
    return jsonify(rows)


if __name__ == "__main__":

    print("=" * 60)
    print("Make sure the seesaw is LEVEL with no weights on it right now.")
    print("Auto-calibrating the 'balanced' baseline from the camera...")
    print("=" * 60)

    startup_calibration = calibrate_baseline()

    if startup_calibration.get("success"):
        print(f"Baseline set: {startup_calibration['baseline_angle']} degrees. Ready to go!")
    else:
        print("Could not auto-calibrate:", startup_calibration.get("error"))
        print("Check both colored stickers are visible to the camera, then use")
        print("the 'Recalibrate' button in the app once it's running.")

    # host="0.0.0.0" lets other devices on the same local network (no internet
    # needed) reach it too, e.g. http://<laptop-ip>:5000 from a phone on the
    # same room's hotspot-free LAN. Use host="127.0.0.1" to restrict to this
    # machine only.
    app.run(debug=True, use_reloader=False, host="0.0.0.0", port=5000)
