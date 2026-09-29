"""Regenerate the ``output`` snapshot of every fixture in shared/fixtures.

Review the diff before committing: snapshots are the API contract for the frontend.
"""

import json
from pathlib import Path

from beam_solver.analysis import analyze
from beam_solver.io import beam_from_json, result_to_json

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


def main() -> None:
    for path in sorted(FIXTURES_DIR.glob("*.json")):
        data = json.loads(path.read_text())
        data["output"] = result_to_json(analyze(beam_from_json(data["input"])))
        path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"updated {path.name}")


if __name__ == "__main__":
    main()
