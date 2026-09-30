# 03_cantilever_left_udl — Cantilever fixed at the left, UDL

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 4 m. Fixed support A at x = 0, free end at x = 4. w = 3 kN/m downward over the whole length.

## Reactions
W = 3·4 = 12 kN at x = 2.
ΣFy = 0: **R_A = 12 kN** (up)
ΣM about x = 0: M_A + (−12)(2) = 0 → **M_A = +24 kN·m** (anticlockwise)

## Shear force V(x)
- 0 < x < 4: V = 12 − 3x (V(4) = 0)

## Bending moment M(x)
- 0 < x < 4: M = 12x − 1.5x² − 24 → M(0) = −24, M(4) = 0

## Extremes
**M max hogging = −24 kN·m at x = 0** (at the support). No sagging.

Fixture: `shared/fixtures/03_cantilever_left_udl.json` — its `checks` are the numbers above.
