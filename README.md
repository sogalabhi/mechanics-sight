# Mechanics Sight

Exact axial force (AFD), shear force (SFD), and bending moment (BMD) diagrams for beams, with a web UI.
Supports internal hinges and horizontal/inclined point loads.
Optional material and cross-section inputs produce exact Euler-Bernoulli slope and physical
deflection results for constant-EI determinate beams.
Axially indeterminate beams with horizontal loads require Phase 4 compatibility and are rejected.
See [plan.md](plan.md) for the design and [docs/SIGN_CONVENTIONS.md](docs/SIGN_CONVENTIONS.md) for signs.

## Layout
- `backend/` — Python package `beam_solver` (physics, solver, CLI, FastAPI)
- `frontend/` — React + TypeScript beam editor
- `shared/fixtures/` — hand-solved cases used by backend and frontend tests

## Development

Prerequisites: Python 3.12+, `uv`, and Node.js 22+ with npm.
Run the two development servers in separate terminals, starting from the repository root.

**Terminal 1 — backend:**

```bash
cd backend
uv sync --all-extras
uv run uvicorn beam_solver.api.app:app --reload --port 8000
```

`uv sync --all-extras` creates `backend/.venv` automatically. `uv run` uses that
environment without activation. If you prefer to activate it manually, run the
following from the repository root after syncing dependencies:

```bash
cd backend
source .venv/bin/activate
uvicorn beam_solver.api.app:app --reload --port 8000
```

Run `deactivate` to leave the virtual environment after stopping the server.

**Terminal 2 — frontend:**

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173** for the app. API documentation is available at
http://localhost:8000/docs. Vite proxies `/api` requests to the backend on port 8000.
Keep both terminals running; press `Ctrl+C` in each to stop.

On subsequent starts, run just the `uv run uvicorn ...` and `npm run dev` commands
from their respective directories. Repeat dependency installation when dependencies change.

Run checks separately from the servers:

```bash
cd backend
uv run pytest
uv run ruff check && uv run ruff format --check && uv run mypy && uv run lint-imports
```

```bash
cd frontend
npm test && npm run lint && npm run build
```

## Dragging in the editor

Drag pin/roller supports, point loads, moments, or hinges along the beam. Fixed
supports stay at their end. Drag a distributed load to move its span; select it
and drag either end handle to resize it. You can also drag items from the desktop
palette onto the beam, or click the palette to add them as before.

Positions snap to nearby beam points within 8 pixels, then to a grid. Hold `Alt`
to bypass snapping (positions still round to millimetres). `Escape` cancels a drag;
one `Undo` reverses a completed drag. Diagrams update while dragging, and invalid
arrangements show an error while retaining the last valid diagrams.

## Physical properties and deflection

Enable **Physical properties** in the inspector, enter Young's modulus and yield strength, then
choose a solid/hollow rectangle, solid/pipe circle, I-section, or T-section. The backend returns
exact piecewise slope and deflection polynomials. The elastic-curve panel displays deflection in
millimetres with an exaggerated shape; hover values include physical deflection and rotation.

## Browser tests

After installing backend and frontend dependencies, run from the repository root:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

The tests start the backend using `backend/.venv/bin/python` on port 18000 and Vite
on port 5174. On Linux, use `npx playwright install --with-deps chromium` if browser
system libraries are missing. Browser tests also run in CI.

## Docker
```bash
docker compose up --build       # app on http://localhost:8080
WEB_PORT=3000 docker compose up # or pick another port
docker compose down
```
Two containers: `backend` (FastAPI on port 8000, not published) and `frontend` (nginx serving the
built app and proxying `/api` to the backend, so the browser sees a single origin and needs no CORS).
The frontend image is built from the repository root because the app bundles `shared/fixtures`.

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
