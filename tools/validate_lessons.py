"""Validate every lesson YAML file.  Run:  python tools/validate_lessons.py [files...]"""
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.lessons import LESSON_DIR, validate_lesson  # noqa: E402


def main(argv):
    files = [Path(a) for a in argv] or sorted(LESSON_DIR.glob("*.yaml"))
    bad = 0
    ids = {}
    for path in files:
        try:
            data = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as e:
            print(f"FAIL {path.name}: YAML error: {e}")
            bad += 1
            continue
        errs = validate_lesson(data)
        if data.get("id") in ids:
            errs.append(f"duplicate id also used in {ids[data['id']]}")
        ids[data.get("id")] = path.name
        if errs:
            bad += 1
            print(f"FAIL {path.name}")
            for e in errs:
                print(f"   - {e}")
        else:
            print(f"ok   {path.name}")
    print(f"\n{len(files) - bad}/{len(files)} lessons valid")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
