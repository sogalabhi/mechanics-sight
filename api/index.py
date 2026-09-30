"""Vercel entrypoint for the Mechanics Sight FastAPI application."""

import sys
from pathlib import Path

BACKEND_SRC = Path(__file__).resolve().parents[1] / "backend" / "src"
sys.path.insert(0, str(BACKEND_SRC))

from beam_solver.api.app import app

__all__ = ["app"]