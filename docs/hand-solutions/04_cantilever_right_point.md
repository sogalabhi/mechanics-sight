# 04_cantilever_right_point — Cantilever fixed at the right, tip load

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 4 m. Fixed support A at x = 4, free end at x = 0. P = 5 kN downward at x = 0.

## Reactions
ΣFy = 0: **R_A = 5 kN** (up)
ΣM about x = 0: R_A·4 + M_A + (−5)(0) = 0 → **M_A = −20 kN·m** (clockwise)

## Shear force V(x)
- 0 < x < 4: V = −5

## Bending moment M(x)
- 0 < x < 4: M = −5x → M(4) = −20

## Extremes
**M max hogging = −20 kN·m at x = 4** (at the support). No sagging.

Fixture: `shared/fixtures/04_cantilever_right_point.json` — its `checks` are the numbers above.
