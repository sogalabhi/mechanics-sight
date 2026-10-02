# Mechanics Sight

Interactive Structural Mechanics & Exact Beam Analysis Engine.

**Mechanics Sight** is an interactive, browser-based structural mechanics platform for civil, mechanical, and aerospace engineers, educators, and students. It combines an **exact continuous Euler–Bernoulli polynomial solver** with an interactive canvas, **5 classical indeterminate worked analysis methods**, step-by-step pedagogical derivations, cross-section stress profiles, and print-ready calculation reports.

---

## Key Features

### 1. Universal Beam Solver (Determinate & Indeterminate)
- **Arbitrary Support Conditions**: Pin, Roller, Fixed, Guided / Shear-release, Translational Springs ($k_v$), Rotational Springs ($k_\theta$), and Support Settlements ($\Delta$, $\theta_0$).
- **Internal Releases**: Ideal internal hinges with zero-moment continuity enforcement.
- **Full Loading Suite**:
  - Point Loads: Vertical, Horizontal, and Inclined (with angle $\theta$ and automatic trigonometric decomposition into $F_x$ and $F_y$).
  - Concentrated Moments / Couples.
  - Uniformly Distributed Loads (UDL) and Linearly Varying Distributed Loads (triangular and trapezoidal).
- **Exact Symbolic Calculus (Zero-Meshing)**:
  - Internal action diagrams ($N(x)$, $V(x)$, $M(x)$) and deformation curves ($\theta(x)$, $v(x)$) are computed as exact piecewise polynomials.
  - No finite-element discretization mesh or numerical approximation errors—extreme values, inflection points, and discontinuity jumps are solved to machine precision.

### 2. Five Classical Worked Indeterminate Methods
Mechanics Sight generates complete, textbook-grade step-by-step worked solutions formatted in LaTeX:
1. **Force Method (Flexibility / Consistent Deformations)**: Redundant selection, primary determinate structure release, flexibility coefficients $f_{ij}$, compatibility equations, and reaction recovery.
2. **Slope-Deflection Method**: Fixed-end moments (FEM), member slope-deflection equations, rotational joint equilibrium ($\sum M_{\text{joint}} = 0$), and joint rotation solutions.
3. **Moment Distribution Method (Hardy Cross)**: Member stiffness ($k$), distribution factors ($DF$), carry-over factors ($COF = 0.5$), and a complete cycle-by-cycle distribution table tracking balanced moments until convergence.
4. **Three-Moment Equation (Clapeyron's Theorem)**: Support moment formulation across adjacent continuous spans ($M_{n-1} L_n + 2 M_n (L_n + L_{n+1}) + M_{n+1} L_{n+1} = \dots$).
5. **Direct Stiffness Method (Matrix Structural Analysis)**: Local/global element stiffness matrices $[k_e]$, global system stiffness assembly $[K]$, boundary condition partition, displacement vector $\{d\}$, and internal member end action recovery.

### 3. Interactive Pedagogical Derivations
- **Canonical Formula Matcher**: Instant pattern recognition for textbook canonical configurations (e.g. propped cantilever UDL $wL^2/8$, $9wL^2/128$, fixed-fixed beam $wL^2/12$, center point load $PL/8$, cantilever tip load $PL$) with complete closed-form proofs.
- **"Virtual Saw" Free-Body Cut**: Section the beam at any coordinate $x$ along its length. Inspect left and right isolated free-body diagrams with active equilibrium equations ($\sum F_x = 0$, $\sum F_y = 0$, $\sum M = 0$) and explicit internal action arrows ($N, V, M$).
- **Calculus Integration Cards**: Step-by-step mathematical proofs showing direct integration from load intensity $q(x)$ to shear $V(x)$, bending moment $M(x)$, slope $\theta(x)$, and deflection $v(x)$ with boundary condition evaluation.

### 4. Comprehensive 5-Diagram Suite & Stress Profiles
- **Live Synchronized Diagrams**:
  1. **Beam Layout & Loading Schematic**: Real-time rendering of supports, settlements, springs, loads, hinges, and dimension lines.
  2. **Axial Force Diagram (AFD)**: Axial tension and compression distributions.
  3. **Shear Force Diagram (SFD)**: Point-load jumps, distributed load slopes, and zero-shear crossings.
  4. **Bending Moment Diagram (BMD)**: Exact parabolic, cubic, and linear moment envelopes with maximum sagging and hogging flags.
  5. **Elastic Curve (Deflected Shape)**: Physical deflection $v(x)$ in millimetres and cross-section rotation $\theta(x)$ in radians or degrees.
- **Stress Profile Visualizer**:
  - Extreme-fibre normal bending stress: $\sigma(x, y) = -\frac{M(x)\,y}{I_x}$ (maximum tension and compression fibers).
  - Transverse shear stress: $\tau(x, y) = \frac{V(x)\,Q(y)}{I_x\,b(y)}$ across standard cross-sections.
  - Yield checks against material yield strength $\sigma_y$.

### 5. Tactile Direct-Manipulation Canvas & UI
- **Canvas Interaction**: Drag supports, loads, hinges, and distributed load spans directly along the beam.
- **Magnetic Snapping**: 8-pixel magnetic snapping to support locations, load boundaries, midpoints, hinges, and grid lines (hold `Alt` to bypass snapping).
- **Inspector Panel**:
  - **Beam Properties**: Length, material library presets (Structural Steel, Aluminum 6061-T6, Timber, or custom $E, G, \sigma_y$), and standard cross-sections (solid/hollow rectangle, solid/pipe circle, standard I-section, T-section).
  - **3-Way Load Orientation Switcher**: Quick toggle between Vertical, Horizontal, and Inclined configurations with live magnitude and angle inputs.
- **History & Keyboard Shortcuts**: Full Undo/Redo stack (`Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`), delete (`Delete` / `Backspace`), and cut tool (`S`).
- **Calculation Report Generator**: Export clean, print-ready HTML/PDF calculation sheets with high-resolution vector SVG diagrams, reactions summary, and LaTeX derivation cards.
- **Theme Support**: Seamless Dark, Light, and System theme switching with high-contrast accessibility.

---

## Repository Layout

```
mechanics-sight/
├── backend/                  # Python package `beam_solver`
│   ├── src/beam_solver/      # Core solver, domain models, classical methods, FastAPI app, CLI
│   │   ├── domain/           # Beam, Support, Load, Material, CrossSection models
│   │   ├── solvers/          # Equilibrium solver, matrix stiffness solver, axial solver
│   │   ├── analysis/         # Exact piecewise calculus, 5 indeterminate methods, stress analysis
│   │   ├── api/              # FastAPI REST endpoints
│   │   └── io/               # Pydantic schemas, serializers, validation
│   └── tests/                # 300+ unit, property-based (Hypothesis), and benchmark tests
├── frontend/                 # React 19 + TypeScript + Vite web application
│   ├── src/
│   │   ├── canvas/           # Interactive SVG canvas, beam rendering, drag-and-drop
│   │   ├── components/       # Diagrams (AFD, SFD, BMD, Elastic Curve), Inspector, Working Panel
│   │   ├── derivation/       # Virtual Saw card, Integration card, Canonical formula viewer
│   │   └── report/           # Print-ready calculation report generator
│   └── tests/                # Vitest unit & integration tests, Playwright e2e tests
├── shared/
│   ├── fixtures/             # 20-case textbook benchmark suite (Hibbeler, Gere & Timoshenko)
│   └── openapi.json          # Synchronized OpenAPI specification
├── docs/                     # Engineering design specifications, sign conventions, hand solutions
└── plan.md                   # Architecture plan, roadmap, and milestone tracking
```

---

## Getting Started

### Prerequisites
- **Python 3.12+** with `uv` (or standard `venv` + `pip`)
- **Node.js 22+** with `npm`

---

### Local Development Setup

Run the backend and frontend in separate terminals from the repository root:

#### Terminal 1 — Backend (FastAPI)

Using `uv`:
```bash
cd backend
uv sync --all-extras
uv run uvicorn beam_solver.api.app:app --reload --port 8000
```

Or using standard Python `venv`:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[api,plot,dev]"
uvicorn beam_solver.api.app:app --reload --port 8000
```

- API Server: **http://localhost:8000**
- Interactive Swagger API Docs: **http://localhost:8000/docs**

#### Terminal 2 — Frontend (Vite + React)

```bash
cd frontend
npm ci
npm run dev
```

- Web Application: **http://localhost:5173** (automatically proxies `/api` requests to backend port 8000)

---

## Verification & Test Suite

Mechanics Sight enforces strict mathematical and visual verification across every layer.

### Backend Tests & Verification
Run the 300+ test suite, property-based invariant checks, and architectural boundary linter:
```bash
# Unit & benchmark test suite (319 tests)
backend/.venv/bin/pytest backend/tests/

# Architectural import layer contract verification
backend/.venv/bin/lint-imports --config=backend/pyproject.toml
```

### Frontend Tests & Typecheck
```bash
cd frontend
npm test -- --run     # Vitest suite (112 tests)
npm run lint          # ESLint rules
npm run build         # TypeScript type-check and Vite production build
```

### End-to-End Browser Tests
```bash
cd frontend
npx playwright install --with-deps chromium
npm run test:e2e
```

---

## Docker Deployment

Launch the entire stack with Docker Compose:

```bash
docker compose up --build       # Application on http://localhost:8080
WEB_PORT=3000 docker compose up # Or specify custom host port
docker compose down
```

The Docker deployment contains two optimized containers:
1. `backend`: FastAPI Python service.
2. `frontend`: High-performance Nginx web server serving the compiled SPA and reverse-proxying `/api` to the backend.

---

## Sign Conventions

Mechanics Sight adheres to standard civil and structural engineering sign conventions:

| Action / Quantity | Positive (+) Convention | Negative (-) Convention |
| :--- | :--- | :--- |
| **Axial Force ($N$)** | Tension (pulling outward) | Compression (pushing inward) |
| **Shear Force ($V$)** | Sum of vertical forces left of the cut (left part pushed up) | Left part pushed down |
| **Bending Moment ($M$)** | Sagging (compression at top fibres, tension at bottom fibres) | Hogging (tension at top fibres, compression at bottom fibres) |
| **Vertical Deflection ($y$)** | Upward displacement | Downward displacement |
| **Rotation ($\theta$)** | Anticlockwise rotation | Clockwise rotation |
| **Loads, reactions, UDL ($w$)** | Upward (a downward 10 kN load is stored as −10) | Downward |
| **Applied couples / reaction moments** | Anticlockwise | Clockwise |

For full mathematical definitions and derivation diagrams, see [docs/SIGN_CONVENTIONS.md](docs/SIGN_CONVENTIONS.md).

---

## Contract Synchronization

When API schemas or solver structures are modified, contract files must be regenerated:

```bash
cd backend
python scripts/export_openapi.py      # Updates shared/openapi.json
python scripts/update_snapshots.py    # Updates shared/fixtures/*.json
cd ../frontend && npx openapi-typescript ../shared/openapi.json -o src/api/schema.d.ts
```

---

## Scope & Engineering Assumptions

### Current Scope & Supported Physics
- 1D linear elastic Euler–Bernoulli beam theory ($EI \frac{d^4 v}{dx^4} = q(x)$).
- Small deflections and linear material behavior (Hooke's Law).
- Statically determinate beams and statically indeterminate beams with arbitrary boundary conditions, springs, settlements, and internal hinges.
- Coplanar loading (transverse loads, axial point loads, in-plane moments).
- Standard SI engineering units (m, mm, kN, kN·m, MPa, GPa).

### Explicitly Out of Scope
The following advanced structural behaviors are outside the scope of the current 1D beam solver:
- Moving loads and influence lines.
- 2D/3D frames, trusses, and curved beams.
- 3D spatial loading, torsion, and biaxial bending.
- Non-linear behavior (geometric P-$\Delta$ large deformations, plastic yielding, buckling).
- Shear deformation (Timoshenko beam theory).
- Distributed axial loads, distributed couples, and thermal gradient loads.
- Non-SI imperial unit conversions.

---

## License

MIT
