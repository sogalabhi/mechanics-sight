# 08_ss_partial_udl — Simply supported beam, partial UDL

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 8 m. Pin A at 0, roller B at 8. w = 4 kN/m downward from x = 2 to x = 6.

## Reactions
W = 4·4 = 16 kN at x = 4 (centre of the loaded part).
By symmetry (ΣM about A: R_B·8 = 16·4): **R_A = R_B = 8 kN**

## Shear force V(x)
- 0 < x < 2: V = 8
- 2 < x < 6: V = 8 − 4(x − 2) = 16 − 4x
- 6 < x < 8: V = 8 − 16 = −8

## Bending moment M(x)
- 0 < x < 2: M = 8x → M(2) = 16
- 2 < x < 6: M = 8x − 2(x − 2)² → M(4) = 24, M(6) = 16
- 6 < x < 8: M = 64 − 8x → M(8) = 0

## Extremes
V = 0 at x = 4. **M max = 24 kN·m at x = 4**.

Fixture: `shared/fixtures/08_ss_partial_udl.json` — its `checks` are the numbers above.
