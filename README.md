# Mechanics Sight

Exact shear force (SFD) and bending moment (BMD) diagrams for beams, with a web UI.
See [plan.md](plan.md) for the design and [docs/SIGN_CONVENTIONS.md](docs/SIGN_CONVENTIONS.md) for signs.

## Layout
- `backend/` — Python package `beam_solver` (physics, solver, CLI, FastAPI)
- `frontend/` — React + TypeScript (Phase 1.5)
- `shared/fixtures/` — hand-solved cases used by backend and frontend tests

## Development
```bash
cd backend
uv sync --all-extras
uv run pytest
uv run uvicorn beam_solver.api.app:app --reload   # API on http://127.0.0.1:8000/docs
uv run ruff check && uv run ruff format --check && uv run mypy && uv run lint-imports
```

## Out of scope
Moving loads and influence lines; frames, trusses, curved beams; 3D, torsion, biaxial bending;
dynamics; non-linear behaviour (large deflection, yielding, P-Δ); shear deformation (Timoshenko);
distributed axial loads, distributed couples, thermal loads; non-SI units.

## Contract files
After changing schemas or the solver output, regenerate and review:
```bash
cd backend
uv run python scripts/export_openapi.py      # shared/openapi.json
uv run python scripts/update_snapshots.py    # shared/fixtures/*.json "output"
cd ../frontend && npx openapi-typescript ../shared/openapi.json -o src/api/schema.d.ts
```
