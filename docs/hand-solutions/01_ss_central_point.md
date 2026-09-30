# 01_ss_central_point — Simply supported beam, central point load

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at x = 0, roller B at x = 6. P = 10 kN downward at x = 3.

## Reactions
ΣM about A = 0 (anticlockwise +): R_B·6 − 10·3 = 0 → **R_B = 5 kN**
ΣFy = 0: R_A + R_B − 10 = 0 → **R_A = 5 kN**

## Shear force V(x)
- 0 < x < 3: V = 5
- 3 < x < 6: V = 5 − 10 = −5

## Bending moment M(x)
- 0 < x < 3: M = 5x → M(3) = 15
- 3 < x < 6: M = 5x − 10(x − 3) = 30 − 5x → M(6) = 0

## Extremes
V changes sign at x = 3, so **M max = 15 kN·m at x = 3** (sagging). No hogging.

Fixture: `shared/fixtures/01_ss_central_point.json` — its `checks` are the numbers above.
