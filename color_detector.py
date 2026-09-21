"""
Detects whether the physical seesaw is balanced by tracking two colored
stickers — one near each hook end of the beam — with the laptop webcam,
and measuring the tilt angle of the line between them.

No manual calibration tool to run. Bright, saturated colors (red, blue,
green, etc.) have well-known HSV ranges that work reliably under normal
indoor lighting, so this ships with ready-to-use presets — you just pick
which two colors your stickers are in config.json (defaults to red/blue).

The only thing that's still "calibrated" is the beam's own baseline
tilt angle, and that happens automatically: it's read once when app.py
starts (level the seesaw with no weights on it at that moment), and can
be re-zeroed anytime via the Recalibrate button — no separate step.

Everything here is fully offline: OpenCV + numpy only, no network calls.
"""

import json
import os

import cv2
import numpy as np

CONFIG_PATH = "config.json"

# Ready-to-use HSV ranges for common bright sticker colors. Red wraps
# around the hue wheel (0 and 180 are both "red"), so it uses two ranges.
COLOR_PRESETS = {
    "red": [
        {"lower": [0, 120, 70], "upper": [10, 255, 255]},
        {"lower": [170, 120, 70], "upper": [180, 255, 255]},
    ],
    "orange": [{"lower": [10, 150, 100], "upper": [25, 255, 255]}],
    "yellow": [{"lower": [25, 150, 100], "upper": [35, 255, 255]}],
    "green": [{"lower": [40, 80, 60], "upper": [85, 255, 255]}],
    "blue": [{"lower": [95, 120, 60], "upper": [130, 255, 255]}],
    "purple": [{"lower": [130, 80, 60], "upper": [160, 255, 255]}],
    "pink": [{"lower": [160, 80, 120], "upper": [172, 255, 255]}],
}

DEFAULT_CONFIG = {
    "left_color": "red",
    "right_color": "blue",
    "angle_threshold": 6.0,   # degrees of tilt still counted as "balanced"
    "baseline_angle": 0.0,    # angle measured when beam was level (auto-set at startup)
    "camera_index": 0,
    "min_marker_area": 60,    # ignore tiny color specks/noise
}


def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r") as f:
            saved = json.load(f)
        cfg = dict(DEFAULT_CONFIG)
        cfg.update(saved)
        return cfg
    return dict(DEFAULT_CONFIG)


def save_config(cfg):
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def build_mask(hsv_frame, color_name):
    """Combines all HSV ranges for a preset color (handles red's hue wraparound)."""
    ranges = COLOR_PRESETS.get(color_name)

    if ranges is None:
        available = ", ".join(COLOR_PRESETS.keys())
        raise ValueError(f"Unknown color '{color_name}'. Available presets: {available}")

    mask = None
    for r in ranges:
        lower = np.array(r["lower"], dtype=np.uint8)
        upper = np.array(r["upper"], dtype=np.uint8)
        part = cv2.inRange(hsv_frame, lower, upper)
        mask = part if mask is None else cv2.bitwise_or(mask, part)

    return mask


def find_marker_centroid(hsv_frame, color_name, min_area):
    mask = build_mask(hsv_frame, color_name)

    mask = cv2.erode(mask, None, iterations=2)
    mask = cv2.dilate(mask, None, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    largest = max(contours, key=cv2.contourArea)

    if cv2.contourArea(largest) < min_area:
        return None

    M = cv2.moments(largest)

    if M["m00"] == 0:
        return None

    cx = int(M["m10"] / M["m00"])
    cy = int(M["m01"] / M["m00"])

    return (cx, cy)


def get_beam_angle(frame, cfg):
    """Returns (angle_degrees, left_point, right_point). angle is None if either marker missing."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    min_area = cfg.get("min_marker_area", 60)

    left = find_marker_centroid(hsv, cfg.get("left_color", "red"), min_area)
    right = find_marker_centroid(hsv, cfg.get("right_color", "blue"), min_area)

    if left is None or right is None:
        return None, left, right

    dx = right[0] - left[0]
    dy = right[1] - left[1]

    # image y-axis grows downward, so a positive dy means the right marker
    # is lower on screen than the left one
    angle = np.degrees(np.arctan2(dy, dx)) if dx != 0 else 90.0

    return angle, left, right


def grab_settled_frame(camera_index, warmup_frames=5):
    cap = cv2.VideoCapture(camera_index)

    if not cap.isOpened():
        return None, "Camera not accessible. Check it isn't in use by another app."

    frame = None
    for _ in range(warmup_frames):
        ret, f = cap.read()
        if ret:
            frame = f

    cap.release()

    if frame is None:
        return None, "Could not read a frame from the camera."

    return frame, None


def calibrate_baseline(camera_index=None):
    """
    Reads the current beam angle and stores it as the 'level' baseline.
    Call this once at server startup (with the seesaw physically level and
    no weights on it), and again anytime via the Recalibrate button.
    """
    cfg = load_config()
    cam_index = camera_index if camera_index is not None else cfg.get("camera_index", 0)

    frame, error = grab_settled_frame(cam_index)

    if frame is None:
        return {"success": False, "error": error}

    angle, left, right = get_beam_angle(frame, cfg)

    if angle is None:
        return {
            "success": False,
            "error": "Could not see both stickers to calibrate. Check they're both in view.",
            "left_marker_found": left is not None,
            "right_marker_found": right is not None,
        }

    cfg["baseline_angle"] = float(angle)
    save_config(cfg)

    return {"success": True, "baseline_angle": round(float(angle), 2)}


def check_balance(camera_index=None):
    """
    Opens the webcam, grabs a settled frame, measures the beam angle
    relative to the calibrated baseline, and reports whether it's balanced.
    """
    cfg = load_config()
    cam_index = camera_index if camera_index is not None else cfg.get("camera_index", 0)

    frame, error = grab_settled_frame(cam_index)

    if frame is None:
        return {"success": False, "error": error}

    angle, left, right = get_beam_angle(frame, cfg)

    if angle is None:
        return {
            "success": False,
            "error": "Could not see both stickers clearly. Check lighting/visibility, or that a hand isn't covering one.",
            "left_marker_found": left is not None,
            "right_marker_found": right is not None,
        }

    relative_angle = float(angle) - cfg.get("baseline_angle", 0.0)
    threshold = cfg.get("angle_threshold", 6.0)
    balanced = bool(abs(relative_angle) <= threshold)

    return {
        "success": True,
        "balanced": balanced,
        "angle": round(float(angle), 2),
        "relative_angle": round(float(relative_angle), 2),
        "threshold": threshold,
    }
