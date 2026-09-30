# 02_ss_full_udl — Simply supported beam, full-span UDL

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at 0, roller B at 6. w = 2 kN/m downward over the whole span.

## Reactions
Resultant W = 2·6 = 12 kN at x = 3.
By symmetry (or ΣM about A: R_B·6 = 12·3): **R_A = R_B = 6 kN**

## Shear force V(x)
- 0 < x < 6: V = 6 − 2x

## Bending moment M(x)
- 0 < x < 6: M = 6x − x²

## Extremes
V = 0 at x = 3. **M max = 18 − 9 = 9 kN·m at x = 3**.

Fixture: `shared/fixtures/02_ss_full_udl.json` — its `checks` are the numbers above.
