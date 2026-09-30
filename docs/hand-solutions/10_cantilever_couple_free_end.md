# 10_cantilever_couple_free_end — Cantilever with a couple at the free end

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 4 m. Fixed support A at x = 0. Anticlockwise couple of 8 kN·m at x = 4 (the free end).

## Reactions
ΣFy = 0: **R_A = 0**
ΣM about x = 0: M_A + 8 = 0 → **M_A = −8 kN·m** (clockwise)

## Shear force V(x)
- 0 < x < 4: V = 0

## Bending moment M(x)
- 0 < x < 4: M = −(−8) = +8 (constant, sagging)
- At x = 4 the anticlockwise couple makes M drop by 8 to 0.

## Extremes
**M max sagging = 8 kN·m**, from x = 0 to x = 4 (first point reported: x = 0).

Fixture: `shared/fixtures/10_cantilever_couple_free_end.json` — its `checks` are the numbers above.
