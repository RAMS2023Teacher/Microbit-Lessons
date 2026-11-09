import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.mark.skipif(not shutil.which("node"), reason="needs Node.js")
def test_apps_script_against_fake_classroom():
    r = subprocess.run(["node", str(ROOT / "tests/apps_script_check.js"),
                        str(ROOT / "app/static/apps-script/maker-lab-classroom.gs")],
                       capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr


@pytest.mark.skipif(not shutil.which("node"), reason="needs Node.js")
def test_school_check_against_fake_google():
    r = subprocess.run(["node", str(ROOT / "tests/school_check.js"),
                        str(ROOT / "app/static/apps-script/school-check.gs")],
                       capture_output=True, text=True, timeout=30)
    assert r.returncode == 0, r.stderr

