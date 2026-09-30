# 05_overhang_point — Overhanging beam, load on the overhang

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at x = 0, roller B at x = 4. P = 10 kN downward at x = 6 (free end).

## Reactions
ΣM about A: R_B·4 − 10·6 = 0 → **R_B = 15 kN**
ΣFy = 0: R_A + 15 − 10 = 0 → **R_A = −5 kN** (downward)

## Shear force V(x)
- 0 < x < 4: V = −5
- 4 < x < 6: V = −5 + 15 = 10

## Bending moment M(x)
- 0 < x < 4: M = −5x → M(4) = −20
- 4 < x < 6: M = −5x + 15(x − 4) = 10x − 60 → M(6) = 0

## Extremes
**M max hogging = −20 kN·m at x = 4** (over roller B). No sagging.

Fixture: `shared/fixtures/05_overhang_point.json` — its `checks` are the numbers above.
