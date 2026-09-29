"""Shared test helpers."""

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from beam_solver.domain import Beam

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "shared" / "fixtures"


def load_fixtures() -> list[dict[str, Any]]:
    """Load every contract fixture (hand-solved case)."""
    return [json.loads(p.read_text()) for p in sorted(FIXTURES_DIR.glob("*.json"))]


def beam_from_fixture(data: dict[str, Any]) -> "Beam":
    """Fixture input -> Beam through the real io layer."""
    from beam_solver.io import beam_from_json

    return beam_from_json(data)
