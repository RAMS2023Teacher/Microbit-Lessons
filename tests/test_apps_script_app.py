"""The Google Apps Script version (apps_script/ + tools/build_apps_script.py)."""
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
    r = subprocess.run([sys.executable, str(ROOT / "tools/build_apps_script.py")], capture_output=True, text=True,
                       env={**os.environ, "MAKERLAB_APPS_SCRIPT_OUT": str(out)}, timeout=300)
    assert r.returncode == 0, r.stdout + r.stderr       # includes the JS-vs-Python grading check
    return out


@needs_node
def test_app_against_fake_google(built):
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_app/api_check.js"), str(built)],
                       capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stdout + r.stderr


def test_pasted_files_are_up_to_date(built):
    """dist/apps-script is what teachers paste, so it must match the lessons and code."""
    dist = ROOT / "dist" / "apps-script"
    names = sorted(p.name for p in built.iterdir())
    assert sorted(p.name for p in dist.iterdir()) == names, "run: python tools/build_apps_script.py"
    _, mismatch, errors = filecmp.cmpfiles(built, dist, names, shallow=False)
    assert not mismatch and not errors, f"out of date: {mismatch}. Run: python tools/build_apps_script.py"
