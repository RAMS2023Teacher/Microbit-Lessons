"""Validate the `visual:` blocks lessons use (rendered by static/js/visuals.js)."""
import re

from .circuits import analyze

LED_ROW = re.compile(r"^[0-9]{5}(:[0-9]{5}){4}$")
NAMED_IMAGES = {"HEART", "HEART_SMALL", "HAPPY", "SMILE", "SAD", "YES", "NO", "SQUARE", "DIAMOND",
                "STICKFIGURE", "ARROW_N", "ARROW_E", "ARROW_W", "ARROW_S", "SKULL", "GHOST", "TARGET",
                "ALL", "OFF"}
PARTS = {"led", "resistor", "button", "ldr", "potentiometer", "transistor", "diode", "buzzer",
         "servo", "dcmotor", "battery"}


def _num(v, key, errs, where):
    if not isinstance(v.get(key), (int, float)):
        errs.append(f"{where}: '{key}' must be a number")


def check_visual(v, where="visual") -> list[str]:
    errs: list[str] = []
    if not isinstance(v, dict) or "type" not in v:
        return [f"{where}: needs a 'type'"]
    t = v["type"]
    if v.get("caption") and len(str(v["caption"]).split()) > 14:
        errs.append(f"{where}: keep the caption under 14 words")
    if t == "leds":
        frames = v.get("frames") or [v.get("image")]
        if not frames or len(frames) > 4:
            errs.append(f"{where}: leds needs 'image' or 1-4 'frames'")
        for f in frames:
            if isinstance(f, bool):
                errs.append(f"{where}: YAML read YES/NO as true/false - put quotes around it: \"YES\"")
                continue
            if not (isinstance(f, str) and (f in NAMED_IMAGES or LED_ROW.match(f))):
                errs.append(f"{where}: LED image {f!r} must be a name ({', '.join(sorted(NAMED_IMAGES))}) "
                            f"or a pattern like 09090:99999:99999:09990:00900")
    elif t == "part":
        if v.get("part") not in PARTS:
            errs.append(f"{where}: part must be one of {sorted(PARTS)}")
        if v.get("part") == "transistor" and v.get("pins") and sorted(v["pins"]) != ["B", "C", "E"]:
            errs.append(f"{where}: transistor pins must be E, B and C in some order")
    elif t == "circuit":
        res = analyze([{"add": v.get("add") or []}])
        errs += [f"{where}: {e}" for e in res["errors"]]
    elif t == "flow":
        steps = v.get("steps") or []
        if not 2 <= len(steps) <= 5:
            errs.append(f"{where}: flow needs 2-5 steps")
        for s in steps:
            if not s.get("label") or len(str(s["label"])) > 26:
                errs.append(f"{where}: each flow step needs a short label (26 characters max)")
    elif t == "wave":
        duty = v.get("duty") or []
        if not 1 <= len(duty) <= 4 or not all(isinstance(d, (int, float)) and 0 <= d <= 100 for d in duty):
            errs.append(f"{where}: wave 'duty' must be 1-4 percentages")
    elif t == "scale":
        _num(v, "min", errs, where)
        _num(v, "max", errs, where)
        for m in v.get("marks") or []:
            if not isinstance(m.get("at"), (int, float)):
                errs.append(f"{where}: every mark needs a numeric 'at'")
        if v.get("map") and (len(v["map"]) != 2 or v["map"][1] - v["map"][0] > 12):
            errs.append(f"{where}: map must be [low, high] with at most 12 steps")
    elif t == "compare":
        items = v.get("items") or []
        if not 2 <= len(items) <= 4:
            errs.append(f"{where}: compare needs 2-4 items")
        for i in items:
            if not i.get("title"):
                errs.append(f"{where}: every compare item needs a title")
            if len(str(i.get("text", "")).split()) > 12:
                errs.append(f"{where}: compare text '{i.get('title')}' is over 12 words")
    elif t == "bits":
        _num(v, "value", errs, where)
        if not isinstance(v.get("bits"), int) or not 1 <= v["bits"] <= 10:
            errs.append(f"{where}: bits must be 1-10")
        elif isinstance(v.get("value"), int) and v["value"] >= 2 ** v["bits"]:
            errs.append(f"{where}: {v['value']} doesn't fit in {v['bits']} bits")
    elif t == "dial":
        for m in v.get("marks") or []:
            if not isinstance(m.get("angle"), (int, float)) or not 0 <= m["angle"] <= 180:
                errs.append(f"{where}: dial angles must be 0-180")
    elif t == "graph":
        pts = v.get("points") or []
        if not 2 <= len(pts) <= 40 or not all(isinstance(p, (int, float)) for p in pts):
            errs.append(f"{where}: graph needs 2-40 numeric points")
    else:
        errs.append(f"{where}: unknown visual type {t!r}")
    return errs
