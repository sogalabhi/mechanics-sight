"""Write the API's OpenAPI description to shared/openapi.json (committed contract)."""

import json
from pathlib import Path

from beam_solver.api.app import create_app

OUT = Path(__file__).resolve().parents[2] / "shared" / "openapi.json"


def openapi_text() -> str:
    return json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n"


if __name__ == "__main__":
    OUT.write_text(openapi_text())
    print(f"wrote {OUT}")
