# Mechanics Sight — Project Plan

A website where a user describes a beam (length, supports, loads) and gets exact shear force (SFD) and bending moment (BMD) diagrams, with hover values at any point. Later phases add hinges, axial force, deflection and indeterminate beams.

This plan replaces `prompt.md` and `prompt 2.md`. Every open choice in those drafts has been decided here. Section 14 lists what changed and why.

---

## 1. Core idea

Treat every load the same way, including the unknown reactions. Each load answers a few questions: how much does it push up, how much does it turn the beam about a point, and what does it add to V and M in a segment. Reactions, SFD, BMD, and later deflection and indeterminate beams all reuse that one interface.

One general method computes the answer. Hand-calculation tricks (free-end moments, "area of SFD = change in BM", "M is maximum where V = 0") become **tests**, not code paths.

---

## 2. Scope

Each phase must be finished, tested and working before the next starts.

### Phase 1 — statically determinate beams, vertical loads only

| Item | Decision |
|---|---|
| Supports | `PIN`, `ROLLER`, `FIXED`. A free end is simply "no support" and is **not** an enum member. |
| Support positions | Pin and roller: anywhere in [0, L]. Fixed: only at x = 0 or x = L. At most one support at any position. |
| Stability and determinacy | Found from the directions each support restrains (Section 6). The beam is classified first as unstable, determinate, or indeterminate with its degree, and only then solved. There are no hard-coded rules for particular support combinations. |
| Beam types covered | Simply supported, cantilever (fixed at either end), overhanging on one or both sides, pin–pin. The type is never stored; it follows from the supports. |
| Loads | Point load, point moment (couple), distributed load (UDL, triangular, trapezoidal, full or partial). Any number, overlapping allowed. |
| Distributed load sign | `w_start` and `w_end` must not have opposite signs (zero is allowed). Users model a sign-changing load as two loads. |
| Cross-section / material | Not needed. SFD and BMD come from statics alone. |
| Indeterminate input | Indeterminate in bending (propped cantilever, three supports, and so on) → `IndeterminateBeamError` giving the degree, never a wrong answer. Indeterminate only in the axial direction (pin–pin) → solved exactly (Section 6.4). |

Edge cases Phase 1 must handle: a load exactly on a support, a load at x = 0 or x = L, a couple at the free end of a cantilever, a beam with no loads (all zeros, no crash), unstable setups (clear error), indeterminate setups (clear error).

### Phase 1.5 — API and basic web page
FastAPI endpoint and a React page with a form, stacked SFD/BMD graphs, and exact hover values.

### Phase 1.6 — drag and drop
Drag supports and loads on the beam, with snapping and live updates.

### Phase 2 — still statics, more setups
- Internal hinges (Gerber / compound beams).
- Horizontal and inclined point loads, plus an Axial Force Diagram (AFD).
- Optional: guided (sliding) support.

### Phase 3 — deflection
Constant EI, then a cross-section library (rectangle, circle, I, T) with E, then stepped beams (EI changes along the length). Slope and deflection diagrams. Bending and shear stresses.

### Phase 4 — indeterminate beams
Propped cantilever, fixed–fixed, continuous beams, support settlement, spring supports.

### Out of scope (also stated in the README)
- Moving loads and influence lines
- Frames, trusses, curved beams
- 3D, torsion, bending about two axes
- Dynamics and vibration
- Large deflection, material yielding, P-Δ effects (anything non-linear)
- Shear deformation (Timoshenko). The project uses Euler–Bernoulli beams only.
- Distributed axial loads, distributed couples, thermal loads
- Units other than SI. Converting polynomial coefficients needs a different factor per power, so this is not an "edge only" change.

**Product positioning vs enterprise tools (e.g. STAAD.Pro):**
STAAD.Pro is an enterprise 3D structural analysis and design program using numerical finite element approximations (FEA) to size concrete and steel members for construction. It is a "black box" design code checker with high friction and no step-by-step transparency. Mechanics Sight is the **"Desmos for Structural Mechanics"**: instant interactive feedback, exact closed-form calculus (piecewise polynomials with zero meshing error), and first-principles transparency with step-by-step LaTeX proofs.

**Why frames and trusses are out of scope:**
Straight beams operate on a 1D continuous coordinate $x \in [0, L]$ with piecewise integration. 2D/3D frames and trusses require a completely different mathematical architecture: a 2D/3D node-and-member graph, coordinate transformation matrices ($T$), and the Direct Stiffness Method ($K \mathbf{d} = \mathbf{F}$). Furthermore, their diagrams cannot be projected on a single horizontal axis. Straight beam mechanics (including Gerber hinges, deflections, cross-section stresses, and continuous beams) will be taken to full depth rather than diluting the product into a shallow 2D CAD tool.

**Why write this down:** the code can give an honest error instead of a wrong answer, and a clearly limited project that works well is worth more than a large one that half-works.

---

## 3. Conventions (fixed before any code)

These go into `docs/SIGN_CONVENTIONS.md` in milestone M0 and are used identically in the domain, the solver, the API and the UI.

### Units
SI only: m, kN, kN·m, kN/m. The API sends and receives these same units. The UI may *display* deflection in mm (Phase 3), but it never sends converted numbers to the backend.

### Coordinates and signs

| Quantity | Positive direction |
|---|---|
| Position x | From the left end, 0 ≤ x ≤ L |
| Forces, reactions, distributed intensity w | Upward |
| Applied couples, reaction moments, all equilibrium moments | Anticlockwise |
| Internal shear V(x) | Sum of vertical forces to the left of the cut (the left part is pushed up) |
| Internal moment M(x) | Sagging |
| Horizontal forces and reactions | To the right |
| Axial force N(x) (Phase 2) | Tension |
| Deflection y, slope θ (Phase 3) | Upward, anticlockwise |

A downward 10 kN load is stored as −10. A clockwise 12 kN·m couple is stored as −12. The UI shows direction toggles (↓/↑, ↻/↺) and a positive magnitude, then stores the signed value. There is **one** sign convention everywhere, including in the API.

### The two section rules (left and right)

For a cut at x:

```
From the left:   V(x) = + Σ (forces left of x)
                 M(x) = − Σ (anticlockwise moments about x of the loads left of x)

From the right:  V(x) = − Σ (forces right of x)
                 M(x) = + Σ (anticlockwise moments about x of the loads right of x)
```

What follows from these rules (all checked in tests):
- An upward point load F at a < x adds F·(x − a) to M. This is sagging, as expected.
- An anticlockwise couple C makes the BMD **drop** by C (going left to right). A clockwise couple makes it **jump up**, which matches the textbooks.
- dV/dx = w and dM/dx = V.
- Just to the right of x = L, both V and M must be zero. This is global equilibrium, and the analysis checks it on every run.

**Why the "left" rule is primary:** each load then only has to answer "what do I add to V and M at a point to my right?". The right-side rule exists so the tests can compute the same answer a second, independent way.

### Tolerances (`beam_solver/tolerances.py`, the only place they are defined)
- `POSITION_TOL = 1e-6` m. Two positions closer than this are the same point. They are compared with helpers such as `same_position(a, b)`, never `==`.
- Value tolerance is relative to the size of the loads: `scale = max(1, Σ|F| + Σ|W| + Σ|C|/L)`. Forces use `1e-9·scale` and moments use `1e-9·scale·L`. This decides "is this zero?" for extremes, coefficient trimming and residual checks.

---

## 4. Architecture

### Repository layout

```
mechanics-sight/
  README.md
  plan.md
  docs/
    SIGN_CONVENTIONS.md
    hand-solutions/            # scanned or typed hand solutions for the test cases
  shared/
    fixtures/                  # contract fixtures used by backend AND frontend tests
    openapi.json               # exported from FastAPI, committed
  backend/
    pyproject.toml
    src/beam_solver/
      __init__.py              # public API: Beam, Support, loads, analyze, errors
      errors.py
      tolerances.py
      domain/
        supports.py            # SupportKind, Support
        loads.py               # Load ABC, PointLoad, PointMoment, DistributedLoad
        beam.py                # Beam + validation
      solvers/
        equilibrium.py         # Unknown, EquilibriumSystem (A, b, axial/bending blocks)
        classification.py      # Determinacy, Classification, classify()
        reactions.py           # solve_reactions(), Reaction
      analysis/
        segments.py            # segment polynomials
        critical_points.py
        extremes.py
        results.py             # result dataclasses
        analyze.py             # analyze(beam) -> AnalysisResult
      io/
        schemas.py             # pydantic models (API/CLI JSON format)
        convert.py             # schema <-> domain / results
      plotting/
        diagrams.py            # matplotlib
      api/
        app.py                 # FastAPI app
        errors.py              # exception -> error envelope
      cli.py
    tests/
  frontend/
    package.json
    src/
```

### Layer rules (enforced with `import-linter` in CI)

```
api, cli            (top)
io, plotting
analysis
solvers
domain              (bottom)
errors, tolerances  (usable by all)
```

A layer may import only from layers below it. The physics (`domain`, `solvers`, `analysis`) never imports pydantic, FastAPI or matplotlib.

**Why:** the web API becomes "JSON → Beam → analyze → JSON", and none of the maths changes when the UI arrives. The linter makes the rule impossible to break by accident.

### Dependencies
- Core: `numpy>=2`, `pydantic>=2` (for `io`)
- Optional extra `plot`: `matplotlib`
- Optional extra `api`: `fastapi`, `uvicorn`
- Dev: `pytest`, `pytest-cov`, `hypothesis`, `mypy`, `ruff`, `import-linter`, `sympy` (cross-checks only), `pre-commit`

---

## 5. Domain model

All domain classes are `@dataclass(frozen=True)`. Collections are `tuple`s, never `list`s. (`frozen=True` alone does not stop a list from being changed.) Every support and load has a string `id`, which must be unique within the beam. Reactions refer back to supports by this id, and the UI uses it for selection and dragging.

### Errors (`errors.py`)
Each error has a `code` string that the API uses directly.

```
BeamError                      (base)
├── InvalidBeamError           code "invalid_beam"
│   ├── InvalidPositionError   code "invalid_position"
│   ├── InvalidLoadError       code "invalid_load"
│   └── InvalidSupportError    code "invalid_support"
├── UnstableBeamError          code "unstable"
├── IndeterminateBeamError     code "indeterminate"
└── SolverConsistencyError     code "internal_error"   (a bug in our code, never a user error)
```

`UnstableBeamError` and `IndeterminateBeamError` carry the `Classification` (Section 6.2), so the message and the API can say exactly why.

### Supports

```python
class Direction(Enum):
    X = "x"                # horizontal translation
    Y = "y"                # vertical translation
    ROTATION = "rotation"

class SupportKind(Enum):
    PIN = "pin"
    ROLLER = "roller"
    FIXED = "fixed"

RESTRAINTS: Mapping[SupportKind, tuple[Direction, ...]] = {
    SupportKind.ROLLER: (Direction.Y,),
    SupportKind.PIN:    (Direction.X, Direction.Y),
    SupportKind.FIXED:  (Direction.X, Direction.Y, Direction.ROTATION),
}

@dataclass(frozen=True)
class Support:
    id: str
    kind: SupportKind
    position: float

    @property
    def restraints(self) -> tuple[Direction, ...]:
        return RESTRAINTS[self.kind]
```

Each restrained direction produces one unknown reaction. A new support type is just one new row in `RESTRAINTS`, for example `GUIDED: (X, ROTATION)` in Phase 2. The classifier and the solver don't change.

### Loads

```python
class Load(ABC):
    id: str

    @abstractmethod
    def resultant(self) -> float:
        """Total vertical force, upward positive (kN)."""

    @abstractmethod
    def moment_about(self, x0: float) -> float:
        """Moment about x0, anticlockwise positive (kN·m)."""

    @abstractmethod
    def breakpoints(self) -> tuple[float, ...]:
        """Positions where this load starts, ends or acts."""

    @abstractmethod
    def section_polynomials(self, x0: float) -> tuple[Polynomial, Polynomial]:
        """Contribution to V and M on a segment starting at x0, as polynomials
        in the local coordinate t = x - x0. Valid only when none of this load's
        breakpoints lies strictly inside the segment."""

    @abstractmethod
    def split(self, x: float) -> tuple[Load | None, Load | None]:
        """The parts of this load left and right of x. A point load exactly
        at x goes to the left."""
```

`Polynomial` is `numpy.polynomial.Polynomial` (coefficients in ascending order).

**Why two routes to V and M:** production code uses `section_polynomials`. The tests compute the same values a second way, using `split` + `resultant` + `moment_about` with the right-side rule. If both routes agree everywhere, the formulas are consistent. Adding a new load type means writing one class and touching nothing else (Open/Closed principle).

#### Formulas

The loads are `PointLoad(id, position a, magnitude F)`, `PointMoment(id, position a, magnitude C)` and `DistributedLoad(id, start a, end b, w_start w₁, w_end w₂)`, with l = b − a and k = (w₂ − w₁)/l.

| Load | `resultant` | `moment_about(x0)` |
|---|---|---|
| Point load | F | F·(a − x0) |
| Couple | 0 | C |
| Distributed | (w₁ + w₂)·l/2 | rectangle + triangle (below) |

The distributed load is split into a **rectangle** (w₁·l acting at a + l/2) and a **triangle** ((w₂ − w₁)·l/2 acting at a + 2l/3). Each piece is added as force × (position − x0). There is no centroid formula and no division, so w₁ + w₂ = 0 can never divide by zero.

`section_polynomials(x0)` (in t = x − x0):

| Case | V(t) | M(t) |
|---|---|---|
| Point load, a ≤ x0 | F | F·(x0 − a) + F·t |
| Couple, a ≤ x0 | 0 | −C |
| Distributed, fully left (b ≤ x0) | W | −moment_about(x0) + W·t |
| Distributed, spanning (a ≤ x0 < b) | w₁u + k·u²/2 | w₁u²/2 + k·u³/6 |
| Load to the right of x0 | 0 | 0 |

For the spanning case, u = t + (x0 − a). Build the polynomial in u and shift it with `P(Polynomial([x0 - a, 1]))`. All "≤" comparisons use `POSITION_TOL`.

Degree bounds: V ≤ 2 and M ≤ 3 in every segment. These are asserted in the tests.

### Beam

```python
@dataclass(frozen=True)
class Beam:
    length: float
    supports: tuple[Support, ...]
    loads: tuple[Load, ...] = ()
```

`__post_init__` checks the following, raising the matching `InvalidBeamError` subclass:
- `length` is finite and > 0
- every position (supports, load positions, load starts and ends) lies in [0, L] within tolerance
- at least one support
- ids are unique across supports and loads
- no two supports at the same position
- `FIXED` only at x = 0 or x = L
- distributed loads: `end − start > POSITION_TOL`, and `w_start`, `w_end` not of opposite sign
- all numbers are finite (no NaN or inf)

The domain does **not** change positions (no snapping). It accepts values within tolerance and compares with tolerance. Snapping belongs to the UI.

---

## 6. Classification and reaction solver

The first step of every analysis is to classify the beam from its support restraints. Only a beam that passes is solved.

### 6.1 The equilibrium system A·r = b
- **Unknowns r:** one per restrained direction of every support (Section 5). Each unknown knows its support id, position and direction.
- **Equations:** ΣFx = 0, ΣFy = 0, ΣM about x = 0 equals 0, plus one M(x_h) = 0 row per internal hinge from Phase 2. So there are **e = 3 + h** equations, where h is the number of hinges (0 in Phase 1).
- **Columns of A, built by reusing the Load interface:** every unknown becomes a **unit load** at its position.

| Direction | Unit load | Column (ΣFx, ΣFy, ΣM) |
|---|---|---|
| X | unit horizontal force | (1, 0, 0) |
| Y | `PointLoad(1.0)` | (0, `resultant()`, `moment_about(0)`) = (0, 1, x) |
| ROTATION | `PointMoment(1.0)` | (0, 0, `moment_about(0)`) = (0, 0, 1) |

- **b** = −(Σ applied horizontal forces, Σ `resultant()`, Σ `moment_about(0)`). The horizontal term is 0 in Phase 1.

**Why unit loads:** the solver has no formulas of its own. A sign mistake could only live in the load classes, where the unit tests catch it.

`EquilibriumSystem` builds A, b and the list of unknowns once. Both `classify()` and `solve_reactions()` use it.

### 6.2 Classification: count first, then rank
Let r be the total number of restraints and e = 3 + h:

1. **Count (the textbook formula):**
   - r < e → **unstable**: too few restraints.
   - r = e → determinate, *if* step 2 passes.
   - r > e → indeterminate to degree r − e, *if* step 2 passes.
2. **Rank:** if `np.linalg.matrix_rank(A) < e` → **unstable**, even when the count looks fine. The restraints are arranged so that some movement is still free.

   Example: three rollers give r = 3 = e, but nothing resists horizontal movement. The ΣFx row of A is all zeros, so the rank is 2.

**Why both steps:** the count is necessary but not sufficient. rank(A) = e means every equilibrium equation can be satisfied for *any* load, which is exactly what "stable" means. Step 1 is implied by step 2, since the rank can never exceed r, but it is kept because it gives a clearer message.

```python
class Determinacy(Enum):
    UNSTABLE = "unstable"
    DETERMINATE = "determinate"
    INDETERMINATE = "indeterminate"

@dataclass(frozen=True)
class Classification:
    status: Determinacy
    restraints: int         # r
    equations: int          # e = 3 + h
    axial_degree: int       # see 6.3 (meaningful only when stable)
    bending_degree: int
    reason: str | None      # plain-language cause when unstable

    @property
    def degree(self) -> int:
        return self.axial_degree + self.bending_degree   # equals r − e when stable
```

### 6.3 Axial and bending parts are independent
All loads and reactions act on the beam axis, so a horizontal force has no lever arm about any point on it. Horizontal unknowns therefore appear **only** in the ΣFx row, and ΣFy, ΣM and the hinge rows never contain them. A splits into two independent blocks:

| Block | Equations | Unknowns | Stable when | Degree |
|---|---|---|---|---|
| Axial | ΣFx (1) | X restraints (r_a) | r_a ≥ 1 | r_a − 1 |
| Bending | ΣFy, ΣM, hinge rows (2 + h) | Y and ROTATION restraints (r_b) | rank(A_b) = 2 + h | r_b − (2 + h) |

The beam is stable only if both blocks are stable. The two degrees add up to r − (3 + h), which is the textbook formula again, but now the result also says **where** the indeterminacy is.

Unstable messages come from the block that failed:
- Axial: "Nothing resists horizontal movement: add a pin or fixed support."
- Bending, count: "Too few vertical or rotational restraints (have r_b, need at least 2 + h)."
- Bending, rank: "The supports are arranged so that part of the beam can move freely."

### 6.4 What Phase 1 solves

| Classification | Phase 1 behaviour |
|---|---|
| Unstable | `UnstableBeamError` with the reason |
| Bending degree > 0 | `IndeterminateBeamError("indeterminate to degree n in bending; supported from Phase 4")` |
| Both degrees 0 | Solve |
| Bending degree 0, axial degree > 0 (for example pin–pin) | Solve the bending block and set the horizontal reactions to 0, with a note in `warnings`. |

Setting the horizontal reactions to 0 in that last row is **exact, not an assumption**. With no horizontal loads, the axial force between the X restraints is the same everywhere. The beam's total change of length between them must be zero, so that axial force is zero whatever EA is. (Temperature change is out of scope.) In Phase 2, once horizontal loads exist, this case becomes `IndeterminateBeamError` until Phase 4 adds axial compatibility.

### 6.5 Solving
- Solve each determinate block with `np.linalg.solve`. The axial block is a single equation.
- **Residual check:** if `‖A·r − b‖` is above tolerance → `SolverConsistencyError`.
- A raw `numpy.linalg.LinAlgError` never escapes the solver.

### 6.6 Output
`Reaction(support_id, fx, fy, moment)`. Components the support doesn't restrain are 0.0.

The reactions are turned into load objects and combined with the applied loads in a **new** tuple inside the analysis layer. The `Beam` is never changed.

### 6.7 Classification examples (also a parametrized test)

| Supports | r | e | rank(A) | Result |
|---|---|---|---|---|
| Roller | 1 | 3 | – | Unstable: r < e |
| Roller + roller | 2 | 3 | – | Unstable: r < e (axial block has no restraint) |
| Pin | 2 | 3 | – | Unstable: r < e |
| Roller + roller + roller | 3 | 3 | 2 | **Unstable:** the count passes, but nothing resists horizontal movement |
| Pin + roller | 3 | 3 | 3 | Determinate |
| Fixed | 3 | 3 | 3 | Determinate |
| Pin + pin | 4 | 3 | 3 | Indeterminate, degree 1 (axial only) → solved, H = 0 |
| Fixed + roller | 4 | 3 | 3 | Indeterminate, degree 1 (bending) → Phase 4 |
| Pin + roller + roller | 4 | 3 | 3 | Indeterminate, degree 1 (bending) → Phase 4 |
| Fixed + pin | 5 | 3 | 3 | Indeterminate, degree 2 (1 axial + 1 bending) → Phase 4 |
| Fixed + fixed | 6 | 3 | 3 | Indeterminate, degree 3 (1 axial + 2 bending) → Phase 4 |
| Fixed 0, hinge 3, roller 6 (Phase 2) | 4 | 4 | 4 | Determinate |
| Fixed 0, roller 1, hinge 3 (Phase 2) | 4 | 4 | 3 | **Unstable:** nothing supports the part right of the hinge |

---

## 7. Analysis

`analyze(beam: Beam) -> AnalysisResult`

### 7.1 Critical points
The sorted positions {0, L} ∪ support positions ∪ every load's `breakpoints()` (reactions included), with positions within `POSITION_TOL` merged. Points where V = 0 are **not** critical points; they are reported separately (7.4).

### 7.2 Segments
Each pair of neighbouring critical points is one segment `[x_start, x_end]`. On each segment:
- V = Σ `section_polynomials(x_start)[0]` over all loads, reactions included
- M = Σ `section_polynomials(x_start)[1]`

Coefficients are stored as `tuple[float, ...]`, ascending, in **local t = x − x_start**. Trailing coefficients below the value tolerance are dropped, but at least one coefficient is always kept.

**Why local coordinates:** coefficients in global x lose precision far along the beam. At x ≈ 40 m, the x³ term is about 64,000, so the value you actually want becomes a small difference between huge numbers.

### 7.3 Values at critical points
`CriticalPoint(x, shear_left, shear_right, moment_left, moment_right)`:
- At x = 0: the left values are 0. The right values come from segment 0 at t = 0.
- At an interior point: the left values come from the previous segment at t = its length; the right values from the next segment at t = 0.
- At x = L: the left values come from the last segment. The right values are Σ resultant and −Σ moment_about(L) over all loads. These **must** be zero within tolerance, otherwise `SolverConsistencyError`. They are then stored as exactly 0.0.

This replaces the "evaluate at x ± ε" idea: the values are exact, and there is no ε to choose.

### 7.4 Extremes and zero shear
Everything is computed from the polynomials, exactly:
- **Moment candidates:** the left and right M at every critical point, plus M at every real root of V strictly inside a segment (`Polynomial.roots()`, keeping roots with |imag| below tolerance and t in (0, h)). A segment where V ≡ 0 has constant M; its endpoints already cover it.
- **Shear candidates:** the left and right V at every critical point, plus V at the roots of V′ (= w) inside a segment. That only happens when overlapping loads make the net w cross zero.
- `max_sagging`: the largest positive moment and its x, or `None` if no moment exceeds the tolerance. `max_hogging`: the most negative, or `None`. `max_positive_shear` and `max_negative_shear` are defined the same way.
- Ties go to the **leftmost** x.
- `zero_shear_points`: the roots of V inside segments, plus critical points where V changes sign across the jump (shear_left · shear_right < 0).

The largest moment can occur at a V = 0 root, at a point load where V jumps across zero, at a couple, or at a fixed end. That is why all the candidates are checked, not only the V = 0 points.

### 7.5 Result dataclasses (`analysis/results.py`)

```python
class Side(Enum): LEFT = "left"; RIGHT = "right"

@dataclass(frozen=True)
class Segment:
    x_start: float
    x_end: float
    shear: tuple[float, ...]    # ascending coefficients in t = x - x_start
    moment: tuple[float, ...]

@dataclass(frozen=True)
class CriticalPoint:
    x: float
    shear_left: float
    shear_right: float
    moment_left: float
    moment_right: float

@dataclass(frozen=True)
class Extreme:
    x: float
    value: float

@dataclass(frozen=True)
class AnalysisResult:
    classification: Classification
    reactions: tuple[Reaction, ...]
    segments: tuple[Segment, ...]
    critical_points: tuple[CriticalPoint, ...]
    zero_shear_points: tuple[float, ...]
    max_sagging: Extreme | None
    max_hogging: Extreme | None
    max_positive_shear: Extreme | None
    max_negative_shear: Extreme | None
    warnings: tuple[str, ...]

    def shear_at(self, x: float, *, side: Side) -> float: ...
    def moment_at(self, x: float, *, side: Side) -> float: ...
    def sample(self, points_per_segment: int = 100) -> SampledDiagram: ...
```

`side` is a required keyword, so no caller can silently pick a side at a jump. Away from critical points, both sides give the same value.

The same result object feeds the matplotlib plots, the CLI and the API. The API simply turns it into JSON.

### 7.6 Plotting (`plotting/diagrams.py`)
Stacked beam sketch, SFD and BMD sharing one x-axis. Sample 100 points per segment, always including the exact segment ends. Draw a vertical line at each jump (left value → right value). Mark the reactions, the extremes and the zero-shear points.

---

## 8. Testing strategy

### 8.1 Hand-solved cases (M0, written before any solver code)
Solve each by hand. Store the solutions in `docs/hand-solutions/` and as `shared/fixtures/*.json` (Section 8.4). Signs follow Section 3; all values are in kN, m, kN·m.

| # | Setup | Expected |
|---|---|---|
| 1 | SS: pin 0, roller 6. Point load −10 at 3 | R = 5, 5. V = +5 / −5. M(3) = +15 (= PL/4). No hogging. |
| 2 | SS: pin 0, roller 6. UDL −2 over 0–6 | R = 6, 6. Zero shear at 3. max_sagging = 9 at 3 (= wL²/8). |
| 3 | Cantilever fixed at 0, L = 4. UDL −3 over 0–4 | R = 12, reaction moment **+24** (anticlockwise). M(0⁺) = **−24** (= −wL²/2). No sagging. |
| 4 | Cantilever fixed at 4 (right end). Point load −5 at 0 | R = 5, reaction moment **−20**. V = −5 throughout. M(4⁻) = −20. |
| 5 | Overhang: pin 0, roller 4, L = 6. Point load −10 at 6 | R_pin = **−5** (downward), R_roller = 15. V = −5 then +10. max_hogging = −20 at 4. No sagging. |
| 6 | SS: pin 0, roller 6. Clockwise couple 12 (stored −12) at 2 | R = −2, +2. V = −2 throughout. M(2⁻) = −4, M(2⁺) = +8 (jump **up** by 12). |
| 7 | SS: pin 0, roller 6. Triangular load 0 → −3 over 0–6 | R = 3, 6. Zero shear at 6/√3 ≈ 3.4641. max_sagging = 4√3 ≈ 6.9282 (= w₀L²/(9√3)). |
| 8 | SS: pin 0, roller 8. UDL −4 over 2–6 (partial) | R = 8, 8. max_sagging = 24 at 4. |
| 9 | SS: pin 0, roller 6. Point load −10 at 0 (on the pin) | R = 10, 0. V ≡ 0, M ≡ 0 inside. Critical point at 0: left 0, right 0. |
| 10 | Cantilever fixed at 0, L = 4. Anticlockwise couple 8 at 4 (free end) | R = 0, reaction moment −8. M ≡ +8. max_sagging = 8 at 0 (leftmost tie). |
| 11 | SS: pin 0, roller 5. No loads | Everything zero. All extremes `None`. No crash. |
| 12 | Pin 0, **pin** 6. Point load −10 at 3 | Same V and M as case 1. Reactions fx = 0, fy = 5 at both pins. Classified as indeterminate, degree 1 (axial only), with a note in `warnings`. |

### 8.2 Error cases

| Setup | Expected |
|---|---|
| Single roller | `UnstableBeamError` (r = 1 < 3) |
| Two rollers | `UnstableBeamError` (r = 2 < 3) |
| Single pin | `UnstableBeamError` (r = 2 < 3) |
| Three rollers | `UnstableBeamError` (the count passes, rank 2 < 3: nothing resists horizontal movement) |
| Fixed + roller (propped cantilever) | `IndeterminateBeamError`, degree 1 |
| Pin + roller + roller | `IndeterminateBeamError`, degree 1 |
| Fixed + fixed | `IndeterminateBeamError`, degree 3 |
| Pin and roller both at x = 3 | `InvalidSupportError` |
| Fixed support at x = 2 on a 6 m beam | `InvalidSupportError` |
| Load at x = 7 on a 6 m beam | `InvalidPositionError` |
| Distributed load from +2 to −2 | `InvalidLoadError` |
| No supports, duplicate ids, L ≤ 0, NaN values | `InvalidBeamError` subclasses |

The whole Section 6.7 table is also a parametrized test of `classify()`.

### 8.3 Invariant (property) tests
Run them on the hand cases **and** on random determinate beams generated with `hypothesis` (random pin–roller, overhanging and cantilever beams with random loads):
1. **Left vs right:** at many x, V and M from the segment polynomials equal V and M from the right-side rule, which is computed independently with `split` + `resultant` + `moment_about`. This catches disagreements between the two routes. It does **not** catch a helper that is wrong the same way in both routes, which is why the hand cases exist.
2. **Calculus:** in every segment, `M.deriv() == V` and `V.deriv() == w`, compared coefficient by coefficient within tolerance. (This replaces the trapezoid-area check: the polynomials are exact, so compare them exactly.)
3. **Degree:** deg V ≤ 2 and deg M ≤ 3.
4. **Closure:** V and M just right of L are zero.
5. **Per load:** for every load type, `section_polynomials` evaluated beyond the load's end equals (`resultant()`, `−moment_about(x)`).
6. **Moment jumps** at a critical point equal minus the couples there. **Shear jumps** equal the point forces there.

### 8.4 Contract fixtures (`shared/fixtures/`)
Each hand case is one JSON file with three parts:
- `input`: the API request body
- `checks`: the hand-solved values, e.g. `{"x": 3, "side": "left", "moment": 15}`
- `output`: the API response snapshot, generated by a script and reviewed before committing

The backend tests check that `analyze(input)` matches `output` and satisfies `checks`. The frontend tests (Vitest) evaluate the polynomials in `output` and check them against `checks`. This catches coefficient-order and local/global coordinate mistakes on **both** sides with one set of files.

### 8.5 SymPy cross-check
`sympy.physics.continuum_mechanics.beam.Beam` uses its own sign convention. Establish the mapping once on case 1, write it down in the test module, then compare reactions and moments for the other hand cases. It is a dev-only dependency and is never used by the solver.

---

## 9. Coding standards (set up in M0)

Backend:
- `uv` for environments and the lock file, Python `>=3.12`, `src/` layout
- `ruff check` (rule sets E, F, I, B, UP, SIM, N, RUF, PT) and `ruff format`
- `mypy --strict`
- `pytest` + `hypothesis` + `pytest-cov`, with coverage ≥ 90% on `domain`, `solvers`, `analysis`
- `import-linter` for the layer rules
- Type hints on every function. Docstrings on every public class and function, stating units and signs.
- Custom exceptions only. No `print` in library code (use `logging`).
- `pre-commit` running ruff, mypy and the fast tests

Frontend:
- Vite + React + TypeScript (`strict: true`)
- ESLint + Prettier
- Vitest for pure helpers; Playwright for drag tests (Phase 1.6)

CI (GitHub Actions) on every push:
- **Backend:** ruff, format check, mypy, lint-imports, pytest with coverage
- **Frontend:** oxlint, `tsc -b`, vitest (which also runs the shared contract fixtures), production build
- **Contract:** export `openapi.json` from the app, regenerate the TypeScript types, and fail if either differs from what is committed

---

## 10. API (Phase 1.5)

### Endpoint
`POST /api/v1/analyze`. It is stateless: request in, result out.

### Request

```json
{
  "schema_version": 1,
  "length": 6.0,
  "supports": [
    {"id": "s1", "type": "pin",    "position": 0.0},
    {"id": "s2", "type": "roller", "position": 6.0}
  ],
  "loads": [
    {"id": "p1", "type": "point",       "position": 3.0, "magnitude": -10.0},
    {"id": "c1", "type": "moment",      "position": 2.0, "magnitude": 5.0},
    {"id": "d1", "type": "distributed", "start": 0.0, "end": 6.0, "w_start": -2.0, "w_end": -2.0}
  ]
}
```

Loads are a pydantic discriminated union on `type`. Limits (to protect the server): length ≤ 1000 m, ≤ 20 supports, ≤ 100 loads, ids ≤ 32 characters.

### Response

```json
{
  "schema_version": 1,
  "classification": {"status": "determinate", "degree": 0, "axial_degree": 0, "bending_degree": 0},
  "reactions": [{"support_id": "s1", "fx": 0.0, "fy": 5.0, "moment": 0.0}],
  "segments": [
    {"x_start": 0.0, "x_end": 3.0, "shear": [5.0], "moment": [0.0, 5.0]}
  ],
  "critical_points": [
    {"x": 3.0, "shear_left": 5.0, "shear_right": -5.0, "moment_left": 15.0, "moment_right": 15.0}
  ],
  "zero_shear_points": [3.0],
  "extremes": {
    "max_sagging": {"x": 3.0, "value": 15.0},
    "max_hogging": null,
    "max_positive_shear": {"x": 0.0, "value": 5.0},
    "max_negative_shear": {"x": 3.0, "value": -5.0}
  },
  "warnings": []
}
```

The contract rules, stated in the OpenAPI descriptions and in `docs/`:
- Polynomial coefficients are in **ascending** order, in the **local** coordinate t = x − x_start.
- Segment polynomials are valid **strictly inside** the segment. At a critical point, clients must use the `critical_points` left and right values.

### Errors
Every failure uses one envelope. Pydantic validation errors are converted into it too.

```json
{"error": {"code": "unstable",
           "message": "Nothing resists horizontal movement: add a pin or fixed support.",
           "details": {"classification": {"status": "unstable", "restraints": 2, "equations": 3}}}}
```

Codes: `invalid_input` (schema), `invalid_position`, `invalid_load`, `invalid_support`, `unstable`, `indeterminate` → HTTP 422. `internal_error` → HTTP 500 (logged).

For `unstable` and `indeterminate`, `details` contains the `classification`. The UI shows it as a badge, for example "Statically indeterminate, degree 1 (bending)". That is useful teaching information in itself.

### Versioning
- Later phases add **optional fields with defaults** (for example `fx: 0.0`, `hinges: []`), so every v1 request stays a valid request.
- `schema_version` changes only on a breaking change. The frontend owns a `migrate(beamJson)` function for old saved and shared beams.

### Working steps (M6.5)
The solver already builds the equilibrium system, so it also records how it got each number. `steps` is an optional list of items `{kind, group, title, symbolic, substituted, result, notes, x_start, x_end, at}` for reactions (ΣFy = 0, ΣM = 0), each segment's V(x) and M(x), and the zero-shear and extreme points. The math fields are LaTeX strings written by the backend (so the wording and notation live in one place); the frontend only renders them with KaTeX and uses `x_start`/`x_end`/`at` to pin the crosshair. The frontend still does no mechanics.
- It is returned only with `?steps=true`, so live analysis and dragging (M7) stay small and fast.
- It is an optional field with a default, so `schema_version` does not change (see Versioning).
- Steps come from the same computation as the numbers, so they cannot disagree with the diagrams.

### Performance
The solve takes a few milliseconds including validation. The network round trip dominates.

---

## 11. Frontend (Phase 1.5 and 1.6)

The detailed UI/UX design (layout, exact symbol geometry, interactions, diagrams, React structure) is in `docs/UI_DESIGN.md`.

### Rule
The frontend never does mechanics. It evaluates polynomials (Horner's method), snaps positions, and draws. All physics lives in Python.

### State (`zustand`)

```
model:   beam                         (API request format; the only thing sent to the API or put in URLs)
         history { past[], future[] } (undo/redo)
draft:   beam | null                  (the beam during a drag)
result:  last good AnalysisResult, current error, request sequence number
ui:      selectedId, hover x, panel state
```

UI-only state (selection, hover, draft) never goes into `beam`. Ids are created on the client (`crypto.randomUUID()`).

### Types
`openapi-typescript` generates `src/api/schema.d.ts` from `shared/openapi.json`. When a field is renamed in Python, the frontend stops compiling until it is fixed there too.

### Validation
Pydantic is the authority. The frontend does light checks only, for a better user experience: position within [0, L], end > start, and similar.

### Layout
Stacked panels sharing **one** `d3-scale` x-scale:

```
[ beam with supports and loads — drag here ]
[ SFD                                      ]
[ BMD                                      ]
[ (Phase 3) slope, deflection              ]
```

- Graphs are plain SVG with `d3-scale` and `d3-shape`. Plotly is not used, because syncing hover across charts and drawing jumps is awkward there.
- Curves are sampled from the segment polynomials at about one point per 2 px of width. Every jump is drawn as a vertical line from the left value to the right value.
- Reactions, extremes and zero-shear points are marked directly on the graphs.

### Hover
- One vertical line runs through all panels, with a small box showing V and M at that x.
- If the pointer is within **6 px** of a critical point, the hover snaps to it and shows both sides, for example "V = +5 kN (left) / −5 kN (right)".
- Otherwise the frontend evaluates the segment polynomial containing x.

### Input form (Phase 1.5)
- Add and edit supports and loads, with direction toggles (↓/↑, ↻/↺) and positive magnitudes.
- Positions can be typed "from left" or "from right". The form converts to x from the left before storing.
- Clicking any item opens an edit panel with exact values. This panel stays in Phase 1.6.

### Drag and drop (Phase 1.6)
- **Implemented interactions:** pointer dragging for pin/roller supports, point loads, moments and hinges; desktop palette drops; distributed-span movement and endpoint resizing. Fixed supports stay at their beam end.
- **Cancellation:** Escape, pointer cancellation/lost capture, or window blur restore the committed beam. Ctrl+Z during a drag cancels its preview. Mouse, pen and touch share the pointer-event implementation.
- **Verification:** Playwright exercises real-backend live updates, snapping/Alt, one-step undo/redo, palette drops/cancellation, distributed resizing, invalid support collisions, fixed supports and phone touch dragging. Unit tests cover request throttling, stale responses, snapping and bounds. Browser checks run in CI.
- **Snapping:** first to existing points (0, L, supports, load ends) within **8 px**, otherwise to a grid. The grid step is a 1-2-5 number close to L/100, with a minimum of 1 mm. Holding **Alt** disables snapping.
- **Rounding:** every stored position is rounded to whole millimetres with `Math.round(x * 1000) / 1000`. This gives the same double as the typed decimal (0.3, not 0.30000000000000004). Never compute positions as `Math.round(x / 0.1) * 0.1`. The backend still keeps its own tolerance, because typed input and old links skip the snapping code.
- **Live updates:** the beam sketch moves instantly from `draft`. API calls are **throttled** to at most one every 80 ms, and the last call always goes out. Each request carries an increasing sequence number and cancels the previous one with `AbortController`. Any response older than the newest one already shown is ignored.
- **Errors while dragging:** keep the last good diagrams, grey them out, and show the error message. Example: dropping a pin onto a roller.
- **Undo:** a history entry is recorded on commit (drop, form submit, add, delete), never on each drag step.

### Sharing
The beam JSON is compressed with `lz-string` into the URL **hash** (`#beam=...`). A hash is not sent to the server and has no practical length problem. Old links go through `migrate()`.

### Later experiment
Run the Python solver in the browser with Pyodide for offline use. It is heavy (several MB, more with NumPy), so it is not planned before Phase 4.

---

## 11.5 The Intuition & Pedagogical Engine (Learning by Seeing and Feeling)

SFD and BMD are abstract mathematical plots. Most students memorize mechanical rules ("UDL gives a parabola", "Point load gives a triangle", "M is maximum where V = 0") without building physical or geometric intuition for *why* the curves behave that way. This engine bridges textbook formulas, visual calculus, and physical deformation into an interconnected learning experience.

### 11.5.1 The Deformed Shape / Qualitative Elastic Curve & Fiber Stresses [x] (Implemented & Verified)
Even before user input of $E$ and $I$ in Phase 3, determinate beam deformation shapes are geometrically fixed by the BMD and support conditions:
- **Closed-Form Double Integration ($EI y'' = -M(x)$):**
  - Analytical piecewise integration engine (`frontend/src/math/deflection.ts`) integrates the closed-form polynomial bending moment expressions $M(x)$ across all segments.
  - Zero-error enforcement of support boundary conditions:
    - Simply supported & overhang beams: $y(x_1) = 0$ and $y(x_2) = 0$ strictly down to machine precision ($< 10^{-12}$).
    - Cantilever beams: $y(x_{\text{fixed}}) = 0$ and $\theta(x_{\text{fixed}}) = 0$ at the fixed support wall.
- **Exaggerated Real-Time Bent Beam Ribbon (`frontend/src/diagrams/ElasticCurvePanel.tsx`):**
  - Rendered in a dedicated 4th diagram panel stacked directly beneath the BMD in `CanvasStack.tsx`.
  - Shares the global $x$-scale and vertical crosshair coordination.
  - Shows an undeformed reference baseline with authentic pin, roller, and fixed support markers at exact positions.
- **Tension vs. Compression Fibers:**
  - **Sagging ($M > 0$):** The beam smiles ($\smile$). The top face is highlighted in **Red (Compression, `--compression`)** and the bottom face in **Blue (Tension, `--tension`)**. Callout: *"Top: Compression"* and *"Bottom: Tension (Rebar)"*.
  - **Hogging ($M < 0$):** The beam frowns ($\frown$). The top face is highlighted in **Blue (Tension, `--tension`)** and bottom in **Red (Compression, `--compression`)**. Callout: *"Top: Tension (Rebar)"* and *"Bottom: Compression"*.
- **Points of Contraflexure / Inflection ($M = 0$):**
  - Highlighted with clear node markers on the neutral axis where curvature changes sign, vertical alignment ticks, and callout badge `Inflection (M=0)`.
- **Peak Deflection Marker ($\delta_{\max}$):**
  - Displays the point of maximum deflection with dashed dimension line and label `δ_max at x = ... m`.
- **Interactive Cursor & Crosshair Coordination:**
  - On hover or pin, a node on the deflected centerline highlights the point and displays real-time fiber status (`Sagging: Top C | Bot T` or `Hogging: Top T | Bot C`).
- **User-Configurable Toggle in `ViewMenu.tsx`:**
  - "Show deflected shape (elastic curve)" checkbox toggle (defaults to ON).

### 11.5.2 Calculus & Curvature Visualizer ("Slope is Value")
- **Dynamic Tangent Line [x] (Implemented & Verified):**
  - Live tangent line rendered on the Bending Moment Diagram (`frontend/src/diagrams/CalculusTangent.tsx`).
  - Screen geometry derived rigorously from analytical polynomial derivative:
    $$\frac{dY_{\text{px}}}{dX_{\text{px}}} = \frac{S_y \cdot V(x)}{\text{pxPerM}}$$
  - At zero shear points ($V = 0$), tangent line becomes identically horizontal ($\text{slope} = 0$), highlights in vibrant emerald green (`#10b981`), and presents a glowing peak indicator badge.
  - Linked across SFD and BMD: SFD crosshair simultaneously reports `$V = \dots \implies \text{Slope of BMD}$` and green zero-crossing status.
  - Cursor snaps automatically to zero-shear roots within 6 px in `CanvasStack.tsx`.
  - User-configurable toggle in `ViewMenu.tsx` (persisted in Zustand store, defaults to ON).
- **Curvature / Concavity Badges (Phase 2):**
  - Under a downward distributed load ($w < 0$), the badge explains:
    $$\frac{d^2M}{dx^2} = \frac{dV}{dx} = w < 0 \implies \text{Concave Downwards (Frowning Parabola)}$$

### 11.5.3 Area-under-SFD Shading (Visual Integration) [x] (Implemented & Verified)
- Textbooks teach: $\Delta M_{a \to b} = \int_a^b V(x) \, dx$.
- **Click-and-Drag / Span Selection:**
  - Clicking and dragging across any span $[x_a, x_b]$ on the canvas smoothly shades the area under the shear curve.
  - Sub-divides into positive ($V > 0$, cyan with 45° diagonal hatch) and negative ($V < 0$, amber with -45° diagonal hatch) regions.
- **BMD Integration Bracket:**
  - On the BMD directly below, the corresponding moment curve segment highlights with an emerald/green glow.
  - A vertical dimension bracket shows $\Delta M = M(x_b) - M(x_a)$ with rise/fall directional arrows matching the shaded SFD area.
- **Pedagogical Floating HUD Card (`IntegrationCard.tsx`):**
  - Displays the exact closed-form calculus integral:
    $$\text{Shaded SFD Area} = \int_{x_a}^{x_b} V(x)\,dx = +15\text{ kN}\cdot\text{m} \iff \Delta M = M(x_b) - M(x_a) = +15\text{ kN}\cdot\text{m}$$
  - Breakdown of positive area $A_+$, negative area $A_-$, and net area.
  - Automatically identifies applied moment couple jumps inside the interval.
  - Dismissible with `Escape` or a single click.

### 11.5.4 The "Virtual Saw" (Interactive Free Body Cut) [x] (Implemented & Verified)
- Converts the abstract internal force convention into an intuitive physical balancing act:
- **Interactive Triggering:**
  - Pinned crosshair badge: clicking `[🪚 Saw Cut]` at coordinate $x$ slices the beam.
  - View Menu: "Virtual saw (cut beam)" button.
  - Keyboard shortcut: pressing `S` or `C` slices at the hovered or pinned position; `Escape` clears the cut.
- **Visual Slicing on Beam (`BeamView.tsx`):**
  - The beam visually separates at $x$ with an amber jagged saw cut line and section badge `🪚 Cut x = ... m`.
  - The right segment $(x, L]$ dims down (reduced opacity), isolating the left segment $[0, x]$.
- **Mini Free Body Diagram (FBD) Canvas (`VirtualSawCard.tsx`):**
  - Renders an isolated SVG of the left segment with support reactions, point loads, sliced distributed loads (trapezoids), and applied couples.
  - Exposed right cut face clearly displays internal shear vector $V_{\text{cut}}$ (downward positive convention) and internal bending moment arc $M_{\text{cut}}$ (anticlockwise sagging positive convention).
- **First-Principles Equilibrium Proof:**
  - **Vertical Force Balance ($\Sigma F_y = 0$):**
    $$\Sigma F_y = \sum F_{y,\text{reactions}} + \sum F_{y,\text{loads}} - V_{\text{cut}} = 0 \implies V_{\text{cut}} = \dots$$
    Confirmed against the Shear Force Diagram: $V_{\text{cut}} \equiv V(x)$ $\checkmark$.
  - **Moment Equilibrium About Cut Face ($\Sigma M_{\text{cut}} = 0$):**
    $$\Sigma M_{\text{cut}} = \sum (\text{External Moments about cut}) - M_{\text{cut}} = 0 \implies M_{\text{cut}} = \dots$$
    Confirmed against the Bending Moment Diagram: $M_{\text{cut}} \equiv M(x)$ $\checkmark$.
  - **Physical Fiber Insight:** Explains sagging/hogging curvature in terms of internal resisting moments.
- **Analytical Engine (`frontend/src/math/sectionCut.ts`):**
  - Exact closed-form static equilibrium equations across all support types, trapezoid/triangle distributed load slices, point loads, and couples. Tested across 5 fixture test suites in `sectionCut.test.ts`.

### 11.5.5 Symbolic Formula Matcher & First-Principles Proofs [x] (Implemented & Verified)
Textbooks teach standard canonical formulas ($wL^2/8$, $PL/4$, etc.), but students struggle to connect them to computer outputs.

1. **Pattern Matcher:**
   The solver inspects the beam setup against standard canonical benchmark cases:
   - Simply Supported + Midspan Point Load $\implies M_{\max} = \frac{PL}{4}$
   - Simply Supported + Full UDL $\implies M_{\max} = \frac{wL^2}{8}$
   - Simply Supported + Point Load at $(a, b) \implies M_{\max} = \frac{Pab}{L}$
   - Cantilever + End Point Load $\implies M_{\max} = -PL,\ R = P,\ M_{\text{wall}} = PL$
   - Cantilever + Full UDL $\implies M_{\max} = -\frac{wL^2}{2},\ R = wL,\ M_{\text{wall}} = \frac{wL^2}{2}$
   - Simply Supported + Triangular Load ($0 \to w_0$) $\implies M_{\max} = \frac{w_0 L^2}{9\sqrt{3}}$

2. **3-Tier Display in the Working Panel:**
   - **Tier 1 (Symbolic):** $M_{\max} = \frac{wL^2}{8}$
   - **Tier 2 (Substituted):** $M_{\max} = \frac{(2.000\text{ kN/m}) \cdot (6.000\text{ m})^2}{8}$
   - **Tier 3 (Evaluated):** $M_{\max} = 9.000\text{ kN}\cdot\text{m}$

3. **Expandable "Where did this formula come from?" Derivation Card:**
   Provides the symbolic proof for the standard case:
   $$\begin{aligned}
   \text{1. Reactions: } & R_A = R_B = \frac{wL}{2} \\
   \text{2. Moment Equation: } & M(x) = R_A x - w x \left(\frac{x}{2}\right) = \frac{wLx}{2} - \frac{wx^2}{2} \\
   \text{3. Zero Shear Root: } & \frac{dM}{dx} = V(x) = \frac{wL}{2} - wx = 0 \implies x = \frac{L}{2} \\
   \text{4. Peak Moment: } & M(L/2) = \frac{wL}{2}\left(\frac{L}{2}\right) - \frac{w}{2}\left(\frac{L}{2}\right)^2 = \frac{wL^2}{4} - \frac{wL^2}{8} = \mathbf{\frac{wL^2}{8}}
   \end{aligned}$$
   For non-canonical beams (multiple arbitrary loads), the panel smoothly defaults to the General Method of Sections.

### 11.5.6 Student User Journey ("How a Student Sees and Uses It")
1. **Homework Input:** The student inputs a beam from their problem sheet by dragging a pin, roller, and UDL onto the canvas.
2. **Instant Verification:** The diagrams update live, immediately showing the shape of SFD and BMD.
3. **Formula Confirmation:** The student opens the Working panel. A banner states: *"Recognized Case: Simply Supported Beam with Uniformly Distributed Load"*. They see the exact $\frac{wL^2}{8}$ formula from their lecture notes and see their numbers plugged in.
4. **Step-by-Step Assignment Solution:** The student follows the LaTeX steps to verify each equilibrium equation ($\Sigma F_y = 0, \Sigma M_A = 0$) and segment equation for their written homework submission.
5. **Interactive Exploration & Physical Feel:**
   - The student hovers over the peak: the tangent line on the BMD goes horizontal, aligning with $V=0$ on the SFD.
   - The student clicks "Saw the Beam": they see the isolated left chunk with $V$ and $M$ arrows keeping it upright.
   - The student drags the load across the span: the Elastic Curve bends and flexes in real time, developing deep, lasting intuition for exams and structural design.

---

## 12. Later phases: design

### Phase 2 — hinges, horizontal loads, guided support, and AFD
- **Internal Hinges (Gerber Beams):** `Beam.hinges: tuple[float, ...] = ()` [DONE].
  - Mechanics: A hinge releases the bending moment restraint while transmitting vertical shear force ($V$ is continuous across the hinge unless an external load sits there, but $M(x_h) = 0$).
  - Equation assembly in `EquilibriumSystem`: Each hinge adds the row $M(x_h^-) = 0$ to the bending block ($e = 3 + h$ equations).
    - For each unit reaction column $j$: evaluate its moment arm $(x_s - x_h)$ or rotational unit $1.0$ for all unknowns to the left of the hinge.
    - The RHS vector $b$ receives $b_h = -\sum \text{moment about } x_h \text{ of all applied loads left of } x_h$.
  - Validation: $x_h \in (0, L)$, not at a `FIXED` support, no point couple directly at a hinge (`InvalidLoadError`).
  - Classification: Handled automatically by count and rank ($e = 3 + h$). Badly placed hinges (e.g. fixed at 0, roller at 1, hinge at 3) fail the rank test and report "unstable" with clear diagnostics.
  - Worked Steps: LaTeX equations include $\sum M_{x=x_h}^- = 0$ equilibrium slices.
- **Horizontal / Inclined Point Loads & AFD:** [DONE]
  - `PointLoad` has `fx: float = 0.0` (in addition to vertical force).
  - Verified with three shared axial fixtures, exact left/right values, sampled N, randomized right-section and jump checks, API errors, and worked steps.
  - AFD is available in the UI, HTML reports, and CLI plots; tension/compression extremes are returned by the API.
  - Equal and opposite horizontal loads still require compatibility when there are multiple axial restraints.
  - Axial equilibrium $\Sigma F_x = 0$ resolves horizontal reactions.
  - Normal force $N(x) = -\Sigma f_x$ left of $x$ (tension positive).
  - Segment polynomials gain axial representation `axial: tuple[float, ...]`.
  - Diagrams stack: Beam $\to$ AFD $\to$ SFD $\to$ BMD.
  - Indeterminacy: Axially indeterminate beams with non-zero horizontal loads raise `IndeterminateBeamError` until Phase 4 compatibility.
- **Guided (Sliding) Support:**
  - Declared in `RESTRAINTS`: `SupportKind.GUIDED: (Direction.X, Direction.ROTATION)`.
  - Resists horizontal translation and rotation, but allows frictionless vertical translation ($R_y = 0$).
  - Modeled as a collar with vertical rails. Useful for symmetry boundary conditions.

### Phase 3 — deflection, cross-section library, and stresses
- **P3.0 — Contract and benchmarks [DONE]**
  - Fix the unit conversions, centroid based section coordinates, signs, output ownership, and
    compatibility conditions before extending physical analysis.
  - Keep physical properties optional so existing beams and shared links remain valid.
  - Define hand-checkable deflection cases for simply supported beams, cantilevers, overhangs, and
    Gerber beams; define representative geometry and stress cases for every supported shape.
  - Acceptance: documented equations and conventions agree across solver, API, UI, and benchmark
    expectations.
- **P3.1 — Cross-section geometry [DONE]**
  - Support solid and hollow rectangles, solid circles and pipes, I-sections, and T-sections.
  - Calculate area, centroid, second moment of area, signed extreme-fibre distances, section
    moduli, material width at a height, and first moment of area above that height.
  - Validate positive dimensions and feasible wall, flange, and web proportions; reject impossible
    shapes with a clear input error.
  - Acceptance: geometry values match independent calculations, including non-symmetric T-sections
    and hollow sections.
- **P3.2 — Physical properties input [DONE]**
  - Let users enable material and section properties, choose a supported shape, and enter its
    dimensions, Young's modulus, and yield strength.
  - Require material and section data together and validate shape geometry before analysis.
  - Preserve the inputs in shared links and include them in the analysis request.
  - Acceptance: old links still open, new links round-trip physical data, and invalid dimensions
    give an actionable message.
- **P3.3 — Constant-EI deflection solver [DONE]**
  - Integrate each exact bending-moment segment using $EI y''=M$ and retain physical slope and
    displacement in SI units.
  - Solve support and segment conditions together: $y=0$ at pin/roller supports; $y=0$ and
    $\theta=0$ at fixed supports; both quantities continuous at ordinary boundaries; displacement
    continuous but rotation released at internal hinges.
  - Find exact displacement extrema from stationary points and segment ends.
  - Acceptance: signs, slopes, support conditions, hinge conditions, and extrema agree with the
    closed-form cases in the contract.
- **P3.4 — Physical deflection presentation [DONE]**
  - Show the physical displaced shape with an explicit visual exaggeration, and display values in
    millimetres and slope in radians while retaining upward positive as the sign convention.
  - Include the physical maximum in the results view, and include material/section inputs,
    deflection results, a deflection figure, and derivation steps in the downloadable report.
  - Explain the integration and boundary result in the worked steps, including segment slope and
    displacement polynomials.
  - Acceptance: plotted shape, hover values, result summary, worked steps, and report agree with
    the solver values; statics only beams continue to use the qualitative curve.
- **P3.5 — Stepped material and section properties [DONE]**
  - Allow a beam to be divided into contiguous property spans. Each span carries one supported
    material and section definition, with boundaries covering the full beam and no gaps or overlaps.
  - Make every property boundary an analysis boundary. Use the local $EI$ for curvature in that
    span; preserve displacement and rotation across a normal property boundary, and preserve
    displacement while allowing rotation release at an internal hinge.
  - Show span boundaries and their properties in the editor, shared link, result, and report. Keep
    stress and deflection values associated with the correct span at a boundary.
  - Acceptance: constant properties expressed as one span reproduce P3.3 results; stepped beams
    match hand-integrated cases with a change in stiffness and maintain the required continuity.
- **P3.6 — Bending stress [DONE]**
  - Calculate $\sigma(x,y)=-M(x)y/I_x$ using the local section centroid and inertia. Report top and
    bottom fibre stress along the beam and the linear stress profile through the depth at a selected
    cut.
  - Use the correct local section on stepped beams and preserve left/right values at moment jumps
    and property changes.
  - Compare absolute stress with material yield strength; identify the first and greatest yield
    exceedance and show the ratio to yield. Treat this as an elastic stress comparison, not a
    nonlinear post-yield analysis.
  - Acceptance: sagging and hogging put tension/compression on the expected fibres; results match
    $M/Z$ at extreme fibres and the full $-My/I$ profile.
- **P3.7 — Transverse shear stress [DONE]**
  - Calculate $\tau(x,y)=V(x)Q(y)/(I_x b(y))$ from each section's geometry and the local shear
    force. Show the through-depth distribution at a selected cut and report the maximum absolute
    shear stress and its position.
  - Use the actual section width and first moment for solid, hollow, circular, I-, and T-sections;
    handle flange/web changes and section boundaries without invalid divisions at zero-width
    edges.
  - Acceptance: zero shear force gives zero shear stress; rectangular, circular, and web/flange
    profiles agree with independent benchmarks, including maxima and limiting edge values.
- **P3.8 — Phase 3 hardening and release [DONE]**
  - Collect the section, constant-EI, stepped-property, bending-stress, and shear-stress benchmarks
    into shared contract cases where applicable. Add independent checks for equilibrium, boundary
    conditions, continuity, dimensions, and stress sign/units.
  - Exercise the complete user journey in a browser: enter physical properties, inspect deflection
    and stress outputs, change property spans, share/reopen the beam, and download a complete
    report. Confirm old statics-only links and reports remain usable.
  - Review empty, zero-load, jump, hinge, transition, and invalid-geometry cases; make limits clear
    in the UI and documentation.
  - Acceptance: all phase checks pass, API documentation and generated types match, the report
    includes the physical inputs and outputs, and README/contract/plan describe the delivered scope.

### Phase 4 — indeterminate beams
- Solved via unified stiffness/flexibility integration constants and reaction unknowns together in one linear system:
  - Unknowns: reactions + 2 constants per segment.
  - Equations: equilibrium (2) + hinge conditions ($h$) + continuity + boundary conditions at all supports ($y=0$ at every support, $\theta=0$ at fixed).
- Support settlement ($y = -\delta$) and elastic spring supports ($R + k\cdot y = 0$).
- Axial compatibility ($\int \frac{N}{EA} \, dx = 0$) resolving multiple $X$-restraints under horizontal loads.

### One rule across phases
Don't add fields for future phases early. Unused fields are untested code. Growth happens only at these points: more rows in the equation system, supports declaring their unknowns, the shared Load interface, and optional schema fields with defaults.

---

## 13. Build order (milestones, with done criteria)

| # | Milestone | Scope | Done when | Status |
|---|---|---|---|---|
| M0 | Scaffold | Repo layout, tooling, CI, conventions, hand solutions, contract fixtures | CI runs, hand-case fixtures exist | **Done** |
| M1 | Domain | Errors, tolerances, supports, loads, Beam validation | Domain unit tests pass | **Done** |
| M2 | Solvers | `EquilibriumSystem`, `classify()`, reaction solver | Table 6.7 tests pass, reactions match hand cases | **Done** |
| M3 | Analysis | `section_polynomials`, segments, critical points, extremes | Hand cases & hypothesis invariant tests pass | **Done** |
| M4 | I/O & CLI | Schemas, CLI `beam-solver`, matplotlib diagrams | CLI reproduces snapshots & plots look right | **Done** |
| M5 | API | FastAPI app, error envelopes, OpenAPI export, TS types | API tests pass, contract check green | **Done** |
| M6 | Frontend 1.5 | React + Vite UI, stacked SVG graphs, hover, URL sharing, undo | Vitest contract tests pass, manual check green | **Done** |
| M6.5| Worked Steps | Backend LaTeX steps generator, KaTeX Working panel | Steps match hand solutions for all 12 cases | **Done** |
| *Extras*| Packaging | HTML report download, Docker Compose, Vercel deployments | Deployments active, reports download clean | **Done** |
| M7 | Phase 1.6 Drag & Drop | Canvas pointer drag, 8px snapping, 1-2-5 grid, draft state | Playwright drag tests pass (snap, drag, live update) | **Done** |
| M7.5| Intuition Engine 1 | Qualitative Elastic Curve (smile/frown, tension/compression fibers), Calculus Tangent sync ($dM/dx=V$), Textbook Formula Matcher ($wL^2/8, PL/4$) & proofs | Visual verification on all 12 hand cases | **Done** |
| M8 | Phase 2 Backend | Gerber hinges ($M(x_h)=0$), horizontal/inclined loads, AFD, guided supports | Hand cases & fixtures for Phase 2 pass | *Hinges, axial/inclined loads and AFD done; guided supports pending* |
| M8.5| Intuition Engine 2 | "Virtual Saw" interactive free-body cut, Area-under-SFD shading | Visual cut equilibrium checks pass | **Done** |
| M9 | Phase 3 Sections & Deflection | Cross-section library (I-beam, T-beam), $EI$ deflection integration, $\sigma$ and $\tau$ stress envelopes | Cross-section, deflection, and stress benchmarks pass | **Done** |
| M10| Phase 4 Indeterminate | Propped cantilever, fixed-fixed, continuous beams, settlement, spring supports | Classic indeterminate hand cases pass | *Planned* |

---

## 14. What changed from the draft plans

Corrections to `prompt.md`:
1. **Couple sign decided:** anticlockwise positive everywhere, and M(x) = −Σ anticlockwise moments of the loads to the left. A clockwise couple makes the BMD jump up.
2. **Stability and determinacy from restraints:** each support declares the directions it restrains (roller Y; pin X, Y; fixed X, Y, rotation). The full 3 + h equation system is classified first: the textbook count r vs e, then a rank check. This correctly rejects two rollers, which the draft's vertical-only count would have solved. It also catches cases the count misses, such as three rollers. The axial and bending blocks are classified separately, so pin–pin is solved exactly (H = 0) and the result still reports degree 1.
3. **No raw numpy errors:** `LinAlgError` is turned into our own error, and there is a residual check after solving.
4. **Frozen Beam:** the draft added reactions to the Beam's load list. They now go into a new tuple in the analysis layer. The Beam's collections are tuples, not lists.
5. **Trapezoid centroid:** replaced with a rectangle + triangle split (no division). Opposite-sign `w_start`/`w_end` are rejected.
6. **x ± ε** replaced with exact left and right values from the segment polynomials, plus a required `side` argument.
7. **V = 0 search:** no sign-change bisection. Exact polynomial roots are used, and extremes are taken over all candidates (critical points on both sides, plus roots).
8. **Hinge count:** hinges add *equations* (e = 3 + h), not unknowns.
9. **Deflection gap:** Phase 1 now stores V and M as polynomials per segment, so Phase 3 integrates exact polynomials. Phase 4 includes the integration constants as unknowns and a y = 0 condition at every support.
10. **Fixed supports** are only allowed at the beam ends. There is no `FREE` enum member. No two supports may share a position.
11. **Load interface:** `shear_at`/`moment_at` per load were replaced by `section_polynomials` (exact) and `split` (for the independent right-side test route).
12. **Tests:** signs added (cantilever −wL²/2, reaction moment +wL²/2). New cases: triangular load, partial UDL, cantilever fixed on the right, load on a support, couple at a free end, no loads, pin–pin.
13. **Left-vs-right check:** it only means something if the right side is computed independently (hence `split`). Its limit is written down: it cannot catch a helper that is wrong the same way in both routes.
14. **Trapezoid-area check** replaced with exact `M.deriv() == V`. The "fit a polynomial to check the degree" test was dropped in favour of direct degree assertions.
15. **SymPy:** its sign convention is mapped once, then compared.
16. **Tolerances** are defined in one module. Positions are compared with a tolerance, never `==`.
17. **Cleanup:** the chat-UI leftover lines and the stray backtick are gone. This file replaces both drafts.
18. **Scope:** shear deformation, distributed axial loads, distributed couples and thermal loads are now listed as out of scope. Non-SI units are explained as not "edge only".

Corrections to `prompt 2.md`:
1. **Polynomial format:** ascending coefficients in local t = x − x_start.
2. **Segment ends:** polynomials are valid strictly inside a segment. Values at critical points come from `critical_points`.
3. **Stable ids** on supports and loads. Reactions refer to `support_id`.
4. **Four extremes** (max sagging, max hogging, max ±shear) instead of one M_max.
5. **One error envelope** with codes that map one-to-one to the Python exceptions.
6. **Versioning:** a `schema_version` field, additive optional fields, and a frontend `migrate()`.
7. **Throttle, not debounce,** for live dragging, plus request sequence numbers and `AbortController` against stale responses.
8. **Hover snaps** to critical points within 6 px, to show both sides of a jump.
9. **Snapping:** the grid scales with the beam length. Positions are rounded to mm with `Math.round(x * 1000) / 1000`. Alt disables snapping. The backend keeps its own tolerance.
10. **Undo** records commits only, not drag steps. UI-only state is kept out of the beam JSON.
11. **Sharing** uses an lz-string compressed URL hash.
12. **Contract fixtures** are shared by the backend and frontend tests.
13. **"Microseconds"** corrected to "a few milliseconds".
14. **API limits** on length and item counts added.
