# 12_pin_pin — Pin–pin beam (axially indeterminate)

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at 0, pin B at 6. P = 10 kN downward at x = 3.

## Reactions
Two pins give 4 restraints against 3 equations: indeterminate to degree 1, but only **axially**.
There are no horizontal loads, so the horizontal reactions H_A and H_B are both 0.
The vertical problem is the same as case 01: **R_A = R_B = 5 kN**

## Shear force V(x)
- 0 < x < 3: V = 5
- 3 < x < 6: V = −5

## Bending moment M(x)
- 0 < x < 3: M = 5x → M(3) = 15
- 3 < x < 6: M = 30 − 5x

## Extremes
**M max = 15 kN·m at x = 3**. The solver reports the axial degree in `classification` and adds a note.

Fixture: `shared/fixtures/12_pin_pin.json` — its `checks` are the numbers above.
