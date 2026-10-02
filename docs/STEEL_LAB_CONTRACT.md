# Steel Material Lab: S0 specification and response contract

Status: draft for review. Implements plan.md section 18 (S0, S1, S2). Nothing here is built yet. A clickable prototype of the screen exists; its numbers are checked against section 7.

## 1. Where the lab lives

The lab is **a second workspace in the same app**, not a separate site. It shares the shell (top bar, theme, right pane, tokens, status bar) and keeps its own state.

| Question | Decision |
|---|---|
| How do you get there | The lab switcher in the top bar: **Beam / Steel**. |
| URL | `#/lab/steel`. Beam shares keep `#beam=…`, so existing links still work. Lab shares will be `#/lab/steel?h=<compressed history>`. |
| What happens to the beam | Nothing. The beam model, its undo history and its selection stay in memory while the lab is open. |
| Shared state | None. A specimen has no beam position, no selected fibre and no sign-convention link until S5. The lab never reads `pinnedX` or `selectedId`. |
| Code | Frontend in `frontend/src/lab/steel/`, with its own zustand store. Mechanics in `backend/src/beam_solver/material/` (new package, no dependency on beam analysis). |
| Loads | Lazy-loaded route, so the beam page does not pay for the lab. |

## 2. Ownership and units

The backend owns the material response and event definitions. The frontend renders them and never recomputes stress.

| Quantity | Display | API |
|---|---|---|
| Engineering strain ε | % (fraction available) | fraction (dimensionless) |
| Engineering stress σ | MPa | MPa |
| Force F | kN | kN |
| Original diameter d₀, gauge length L₀ | mm | mm |
| Extension ΔL | mm | mm |

Stated once, used everywhere: **engineering** strain ε = ΔL / L₀ and **engineering** stress σ = F / A₀ (original area). Tension positive. The lab is a **tension test only**: stress never goes below zero (see section 5).

## 3. Specimen

One specimen in S1/S2: round bar, **d₀ = 10 mm**, **L₀ = 50 mm**, so A₀ = π·10²/4 = **78.5398 mm²**. Both become editable inputs later; the contract carries them so the response is reproducible.

## 4. Presets

Each preset records source, condition, model, valid range and status. Anything not measured is marked as an idealisation.

| Id | Name | Status |
|---|---|---|
| `steel_textbook` | Mild steel, textbook curve | **Educational idealisation**, not a measured steel |

Parameters (illustrative, not measured): E = 200 GPa; A proportional limit σ_A = 230 MPa; B elastic limit σ_B = 240 MPa; C upper yield σ_C = 265 MPa at ε_C = 0.0014; D lower yield f_y = 250 MPa at ε_D = 0.0016; plateau to ε_sh = 0.015; E peak f_u = 400 MPa at ε_u = 0.15; F fracture ε_f = 0.25, σ_f = 300 MPa; κ = 2×10⁻⁷ per MPa².

The six textbook points, and the loading curve (the "backbone"), engineering stress against engineering strain:

| Point | Region (ε range) | σ(ε) |
|---|---|---|
| 0 to **A** | linear elastic, 0 ≤ ε ≤ ε_A = σ_A/E = 0.00115 | E·ε |
| **A** to **B** | elastic but curving, ε_A < ε ≤ ε_B | ε = σ/E + κ·(σ − σ_A)², fully recoverable |
| **B** to **C** | yielding starts, ε_B < ε ≤ ε_C | straight line from (ε_B, 240) to (ε_C, 265) |
| **C** to **D** | upper to lower yield (the drop), ε_C < ε ≤ ε_D | straight line from (ε_C, 265) to (ε_D, 250) |
| **D** plateau | ε_D < ε ≤ ε_sh | f_y = 250 |
| to **E** | strain hardening, ε_sh < ε ≤ ε_u | f_u − (f_u − f_y)·((ε_u − ε)/(ε_u − ε_sh))² |
| **E** to **F** | necking, ε_u < ε ≤ ε_f | f_u − (f_u − σ_f)·((ε − ε_u)/(ε_f − ε_u))² |
| **F** | ε = ε_f | fracture, test ends |

- ε_B = σ_B/E + κ·(σ_B − σ_A)² = 0.0012 + 0.00002 = **0.00122**. The 0.00002 (0.002 %) is the permanent-strain threshold that defines the elastic limit in this idealisation: up to B the bar recovers fully, just past B the first permanent strain appears.
- The curve is continuous. It has zero slope at the peak E (both E–F and hardening formulas give f_u there) and an upper-yield peak at C.
- It is a textbook shape with illustrative numbers, not a fit to data. A, B and C lie within about 35 MPa of each other and are hard to tell apart in real steel; real grades differ, and many have no upper yield at all.
- After E the **engineering** stress falls because force is divided by the original area. The UI says so. No true-stress view in this version.
- Valid range: 0 to ε_f. Anything outside it (negative, above ε_f, NaN or infinite) is `strain_out_of_range`, not an extrapolation. Moving the strain *back* is not an error: it stops at zero stress (L20).
- Later presets (measured data, other grades, no upper yield, cold-worked) are added only with a stated source and model (plan 18.5).

## 5. Behaviour contract (model `steel_textbook`)

State is (ε, ε_max), where ε_max is the largest strain reached on the backbone (the point from which any unloading started).

- **Loading beyond anything seen** (ε ≥ ε_max): σ = backbone(ε), and ε_max = ε.
- **Reversible zone (up to B):** while ε_max ≤ ε_B the material is elastic. Unloading and reloading retrace the same curve and ε_p = 0.
- **Plastic strain** left by unloading from the backbone at ε_max > ε_B: ε_p = ε_max − σ_b(ε_max)/E.
- **Unloading and reloading beyond B** (ε < ε_max, ε_max > ε_B): σ = E·(ε − ε_p), a straight line of slope E. Reloading follows the same line back to the backbone at ε_max, then the original curve continues. Nothing is rewound along the original path.
- **Tension only:** ε cannot go below ε_p. Moving the strain back stops at zero stress. Imposing zero total strain after plastic stretch (which would need compression) is not offered here; it belongs to a later compression/cyclic model.
- **Unload** means "to zero stress": ε becomes ε_p. The recovered strain is σ_b(ε_max)/E.
- **Fracture:** reaching ε = ε_f ends the test. σ = 0 after the break, controls are disabled, and only Reset applies. The final curve point is (ε_f, σ_f), then a drop along the elastic line to (ε_f − σ_f/E, 0).
- **Reset** creates a fresh specimen. It is not unloading.
- **Replay** re-evaluates a stored history and gives the same numbers. It never edits the history.
- Region labels: `elastic`, `elastic_curving`, `yield_onset`, `yield_drop`, `yield_plateau`, `strain_hardening`, `necking`, `unloading`, `reloading`, `fractured`. A landmark is reported when ε equals its strain exactly: `A` proportional limit, `B` elastic limit, `C` upper yield, `D` lower yield, `E` ultimate tensile strength, `F` fracture.

## 6. API (additive, stateless)

The server is stateless. The client sends the whole loading history, so any state is reproducible from its inputs.

```
POST /api/v1/lab/tension
{
  "schema_version": 1,
  "preset": "steel_textbook",
  "specimen": { "diameter_mm": 10, "gauge_length_mm": 50 },
  "history": [
    { "op": "strain", "to": 0.05 },
    { "op": "unload_to_zero_stress" }
  ]
}
```

Ops: `strain` (move total strain to `to`), `unload_to_zero_stress`, `reset` (discard everything before it and start a fresh specimen, so a recorded session that included a reset replays exactly). Response:

```
{
  "state": {
    "strain": 0.04841152, "stress_mpa": 0.0, "force_kn": 0.0, "extension_mm": 2.420576,
    "plastic_strain": 0.04841152, "elastic_strain": 0.0, "max_strain": 0.05, "region": "unloading"
  },
  "trace": [ { "strain": 0.0, "stress_mpa": 0.0 }, ... ],
  "landmarks": [ { "id": "A", "name": "proportional_limit", "strain": 0.00115, "stress_mpa": 230.0, "reached": true }, ... ],   // all six, A to F
  "model": { "preset": "steel_textbook", "E_gpa": 200, "kind": "idealisation" },
  "warnings": []
}
```

- `trace` samples the **analytic** backbone densely (never more than 0.004 strain apart) and always includes the landmark points and the exact corner points of elastic lines. It does not interpolate between measured source points, so it cannot invent a peak or plateau.
- `elastic_strain` is `strain − plastic_strain`. After fracture it is 0: the recoverable part is lost when the bar separates, and `strain` stays the strain at the break (`plastic_strain` is the strain left, 0.2485).
- Errors use the existing error envelope: `strain_out_of_range`, `unsupported_op`, `invalid_specimen`, `test_finished` (an op after fracture).

## 7. Reference cases (hand solved, written before any solver code)

Specimen d₀ = 10 mm, L₀ = 50 mm, A₀ = 78.5398 mm². Preset `steel_textbook`. These are `shared/fixtures/lab/*.json` (format in its README); the expected values there are exact rational arithmetic on the formulas above, not solver output. F = σ·A₀. ΔL = ε·L₀.

| # | History | Expected |
|---|---|---|
| L1 | ε = 0 | σ = 0, F = 0, ΔL = 0, region `elastic`. |
| L2 | ε = 0.001 | σ = 200 MPa, F = 15.708 kN, ΔL = 0.0500 mm, ε_p = 0, `elastic`. |
| L3 | ε = ε_A = 0.00115 (point A) | σ = **230 MPa**, F = 18.064 kN, ΔL = 0.05750 mm, ε_p = 0. Landmark `A`. |
| L4 | ε = ε_B = 0.00122 (point B) | σ = **240 MPa**, F = 18.850 kN, ΔL = 0.0610 mm, ε_p = 0 (reversible). Landmark `B`. |
| L5 | ε = 0.00125 | σ = 240 + 25·(0.00003/0.00018) = **244.17 MPa**, F = 19.176 kN, `yield_onset`. |
| L6 | ε = ε_C = 0.0014 (point C) | σ = **265 MPa**, F = 20.813 kN, ΔL = 0.0700 mm, ε_p = 0.0014 − 265/200000 = **0.000075**. Landmark `C`. |
| L7 | ε = ε_D = 0.0016 (point D) | σ = **250 MPa**, F = 19.635 kN, ε_p = 0.0016 − 0.00125 = **0.00035**. Landmark `D`. The load fell from C to D. |
| L8 | ε = 0.01 | σ = 250, F = 19.635 kN, ΔL = 0.500 mm, ε_p = 0.00875, `yield_plateau`. |
| L9 | ε = 0.015 | σ = 250, F = 19.635 kN, ε_p = 0.01375. End of plateau. |
| L10 | ε = 0.05 | σ = 400 − 150·(0.10/0.135)² = **317.70 MPa**, F = 24.952 kN, ΔL = 2.500 mm, ε_p = 0.05 − 317.70/200000 = **0.048412**, `strain_hardening`. |
| L11 | ε = 0.15 (point E) | σ = **400 MPa** (UTS), F = 31.416 kN, ΔL = 7.500 mm, ε_p = 0.148. Landmark `E`. |
| L12 | ε = 0.20 | σ = 400 − 100·(0.05/0.10)² = **375 MPa**, F = 29.452 kN, `necking`. |
| L13 | ε = 0.25 (point F) | σ = 300 MPa at the break, F = 23.562 kN. State then `fractured`, σ = 0, ε_p = 0.25 − 300/200000 = 0.2485. Landmark `F`. |
| L14 | ε = 0.05, then unload to zero stress | σ = 0, F = 0, ε = ε_p = 0.048412, recovered strain 0.001588, ΔL = 2.4206 mm, `unloading`. |
| L15 | L14, then ε = 0.048412 + 0.001 | σ = 200 MPa, ε_p unchanged, `reloading`. |
| L16 | L14, then ε = 0.06 | back on the backbone: σ = 400 − 150·(0.09/0.135)² = **333.33 MPa**, `strain_hardening`. |
| L17 | ε = 0.001, then unload to zero stress | σ = 0, ε = 0, ε_p = 0 (reversible, retraces the curve). |
| L18 | ε = ε_B, then unload to zero stress | σ = 0, ε = 0, ε_p = 0 (the elastic limit: full recovery). |
| L19 | ε = ε_C, then unload to zero stress | σ = 0, ε = ε_p = 0.000075, ΔL = 0.00375 mm (first permanent strain). |
| L20 | ε = 0.05, then ε = 0.01 | clamped at zero stress: ε = 0.048412, σ = 0 (tension only, no compression). |
| L21 | ε = 0.30 | error `strain_out_of_range`. |
| L22 | ε = 0.25, then ε = 0.1 | error `test_finished`. |
| L23 | Any history, then a `reset` op | fresh specimen equal to L1. |

Arithmetic checks: (0.10/0.135)² = 0.548697, so L10 σ = 400 − 82.30 = 317.70. (0.09/0.135)² = 0.444444, so L16 σ = 400 − 66.67 = 333.33. L13: F = 300 × 78.5398 / 1000 = 23.562 kN. ε_B: σ_B/E = 0.0012, κ·(240 − 230)² = 2×10⁻⁷ × 100 = 0.00002, so ε_B = 0.00122. The A to B curve at ε_B gives s = 10 MPa (check: s/E + κ·s² = 0.00005 + 0.00002 = 0.00007 = ε_B − ε_A).

## 8. Wording the UI must keep

- "Engineering stress/strain" is stated beside the graph and in the Explain tab.
- Exaggerated elastic stretch is labelled with its scale factor, separately from the real ΔL readout.
- The neck shape is drawn as schematic.
- Playback speed changes the presentation only. It is not a strain rate, and the UI says so.
- The model is called an idealisation wherever the preset is named.

## 9. Layout (see the prototype)

Desktop: the specimen and the stress–strain curve are both visible. Under them: strain slider (finer at small strain) with numeric entry, "Go to" buttons A to F, a Full curve / Zoom elastic switch, Play, Unload and Reset. Readouts show stress, strain, force, extension, plastic strain and elastic strain, with one short explanation and Why? / Show maths. The right pane has Preset, Explain and Maths tabs. The faint dotted line is the full material curve, so the learner sees where the test can go. Phone: one view at a time (specimen or curve) with a bottom sheet, and the current point is preserved when switching.

## 10. Not in scope

Offset proof strength, grades with no upper yield, cold-worked (pre-strained) curves, true stress, a reverse (compression) branch, cyclic loading, temperature and strain rate, measured presets, shear and compression tests. Each needs a stated model or dataset first (plan 18.2 to 18.5).

## 11. Milestone split

- **S1:** elastic range only: points A and B and the reversible zone (0 to ε_B). Strain beyond B is held at ε_B with a note that plasticity arrives in S2. Cases L1 to L4, L17, L18, L23.
- **S2:** the whole backbone C to F, the yield drop, unloading and reloading, fracture. Cases L5 to L16, L19 to L22.
