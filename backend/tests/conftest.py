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
    """Minimal fixture -> domain conversion for tests (the real one is io, milestone M4)."""
    from beam_solver.domain import (
        Beam,
        DistributedLoad,
        Load,
        PointLoad,
        PointMoment,
        Support,
        SupportKind,
    )

    supports = tuple(
        Support(s["id"], SupportKind(s["type"]), s["position"]) for s in data["supports"]
    )
    loads: list[Load] = []
    for ld in data["loads"]:
        if ld["type"] == "point":
            loads.append(PointLoad(ld["id"], ld["position"], ld["magnitude"]))
        elif ld["type"] == "moment":
            loads.append(PointMoment(ld["id"], ld["position"], ld["magnitude"]))
        else:
            loads.append(
                DistributedLoad(ld["id"], ld["start"], ld["end"], ld["w_start"], ld["w_end"])
            )
    return Beam(data["length"], supports, tuple(loads))
