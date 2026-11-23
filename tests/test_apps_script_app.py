"""The Google Apps Script app (apps_script/ + course/ + tools/build.py)."""
import filecmp
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
needs_node = pytest.mark.skipif(not shutil.which("node"), reason="needs Node.js")


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    out = tmp_path_factory.mktemp("apps-script")
    r = subprocess.run([sys.executable, str(ROOT / "tools/build.py")], capture_output=True, text=True,
                       env={**os.environ, "MAKERLAB_APPS_SCRIPT_OUT": str(out)}, timeout=300)
    assert r.returncode == 0, r.stdout + r.stderr       # includes the lesson checks
    return out


@needs_node
def test_app_against_fake_google(built):
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/api_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


@needs_node
def test_reliability(built):
    """docs/RELIABILITY.md: Drive errors never create storage or blank records; one click reads one student; backups."""
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/reliability_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


@needs_node
def test_translation_reports_student_view(built):
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/a11y_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


def test_pasted_files_are_up_to_date(built):
    """dist/apps-script is what teachers paste, so it must match the lessons and code."""
    dist = ROOT / "dist" / "apps-script"
    names = sorted(p.name for p in built.iterdir())
    assert sorted(p.name for p in dist.iterdir()) == names, "run: python tools/build.py"
    _, mismatch, errors = filecmp.cmpfiles(built, dist, names, shallow=False)
    assert not mismatch and not errors, f"out of date: {mismatch}. Run: python tools/build.py"


@needs_node
def test_idle_and_partner(built):
    """Idle students show on the class display and expire; partners see who picked them and either can remove it."""
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/idle_partner_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


@needs_node
def test_arcade_games(built):
    """Circuit Driver unlocks at a level, keeps its own scores and leaderboard, and big scores win robot parts."""
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/arcade_games_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


@needs_node
def test_teacher_review(built):
    """Shipping sends the project to the teacher; approval completes the lesson; sent back shows the feedback."""
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/review_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr
