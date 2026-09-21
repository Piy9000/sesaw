# AI Balance Challenge — Offline Setup Guide

Runs entirely on one laptop, no wifi/mobile data needed. It serves a local
web page, watches the seesaw with the webcam, and checks/saves scores in a
local SQLite file.

Balance detection uses two colored stickers (one near each hook end of
the beam) — but **there's no manual calibration tool to run.** Bright,
saturated colors like red/blue/green have well-known HSV ranges that work
reliably under normal indoor lighting, so this ships with ready-to-use
presets. You just make sure your stickers are two different colors from
the list below, and it works out of the box.

## 1. Install dependencies

You already have these:
```
pip install flask opencv-python numpy pandas pygame pillow
```
(`sqlite3` needs no install — it ships with Python itself.)

## 2. Stick the markers on

Use **two different, brightly-colored** stickers (matte, not shiny/glossy
— glare confuses color detection), one near each hook end of the beam.
Supported preset colors: `red`, `orange`, `yellow`, `green`, `blue`,
`purple`, `pink`. Defaults to **red** (left) and **blue** (right) — if
that's what you're using, there's nothing to configure.

If you used different colors, open `config.json` after the first run and
change:
```json
{
  "left_color": "red",
  "right_color": "blue"
}
```
to whichever two preset names match your stickers. That's the only "setup"
step, and it's a one-line edit, not a tuning tool.

## 3. Position the camera

Point the webcam at the seesaw so **both stickers stay in view at all
times**, even when the beam tilts fully to one side with weights on it.
Reasonably even lighting helps — avoid deep shadows over either marker.

## 4. Run the app

```
python app.py
```

- On startup, the server automatically reads the current beam angle and
  sets it as the "balanced" baseline — **make sure the seesaw is level
  with no weights on it right when you start `app.py`.**
- Then open the printed URL — normally **http://localhost:5000** — in a
  browser on the same laptop.
- If the seesaw gets bumped later, hit the **RECALIBRATE** button on the
  home screen (level it first, then click it) — no restart needed.

Everything (page, camera check, database) runs locally; no internet
connection is used at any point.

## 5. How a round works

1. Enter a name on the home screen, pick a challenge.
2. Read the equation, pick the MCQ option, then **physically hang the
   matching weight** on the seesaw hook.
3. Click **VERIFY ANSWER** — the camera checks the beam angle.
   - Balanced → green flash + correct sound, score +1.
   - Not balanced → red flash + buzzer sound.
4. It auto-advances to the next question. After the last question, an
   animated results screen shows score/time with a tier based on
   percentage (all three tiers are written to be encouraging).
5. The attempt (name, challenge, score, time) is saved to
   `balance_challenge.db` automatically.

## 6. Files

| File | Purpose |
|---|---|
| `app.py` | Flask server: routes, startup auto-calibration |
| `color_detector.py` | Preset-color marker detection + angle/balance logic |
| `database.py` | SQLite read/write helpers |
| `config.json` | Marker colors + baseline angle (created automatically) |
| `balance_challenge.db` | SQLite database of all attempts (created on first run) |
| `templates/index.html` | Page markup |
| `static/style.css` | Styling |
| `static/app.js` | Frontend logic (quiz flow, camera calls, leaderboard) |

## 7. Troubleshooting

- **"Camera not accessible"** — another app (Zoom, Teams, etc.) may be
  holding the webcam. Close it and retry.
- **"Could not see both stickers clearly"** — check both are fully in
  frame, not glossy/glaring, and not covered by a hand while hanging
  weights. If your color is close to a preset boundary (e.g. an
  orange-red), try switching to a more clearly distinct preset color.
- **Wrong object being detected as a marker** — something else in the
  background shares that color. Move it out of frame, or pick a less
  common color for your stickers (purple and pink are rarely present in
  a typical room).
- **Verify always says "not balanced"** — level the seesaw and hit
  **RECALIBRATE** on the home screen. If it still misfires with small
  natural wobble, open `config.json` and raise `"angle_threshold"` a bit
  (e.g. from `6.0` to `8.0`).
