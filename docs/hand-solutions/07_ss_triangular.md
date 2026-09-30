# 07_ss_triangular — Simply supported beam, triangular load

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at 0, roller B at 6. Load rises from 0 at x = 0 to 3 kN/m downward at x = 6.

## Reactions
W = ½·3·6 = 9 kN, acting 2/3 of the way to the large end: x̄ = 4 m.
ΣM about A: R_B·6 − 9·4 = 0 → **R_B = 6 kN**; **R_A = 3 kN**

## Shear force V(x)
w(x) = 0.5x downward, so
- 0 < x < 6: V = 3 − ¼x²

## Bending moment M(x)
- 0 < x < 6: M = 3x − x³/12

## Extremes
V = 0 at x² = 12, x = 2√3 = 3.464. **M max = 3(3.464) − 3.464³/12 = 6.928 kN·m at x = 3.464**.

Fixture: `shared/fixtures/07_ss_triangular.json` — its `checks` are the numbers above.
