"""Shared test helpers."""

import json
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


def load_fixtures() -> list[dict[str, Any]]:
    """Load every contract fixture (hand-solved case)."""
    return [json.loads(p.read_text()) for p in sorted(FIXTURES_DIR.glob("*.json"))]
