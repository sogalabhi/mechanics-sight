# 11_no_loads — Simply supported beam, no loads

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 5 m. Pin A at 0, roller B at 5. No loads.

## Reactions
ΣFy = 0 and ΣM = 0 with no loads: **R_A = R_B = 0**

## Shear force V(x)
- V = 0 everywhere

## Bending moment M(x)
- M = 0 everywhere

## Extremes
No extremes.

Fixture: `shared/fixtures/11_no_loads.json` — its `checks` are the numbers above.
