# 09_load_on_support — Point load directly on a support

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at 0, roller B at 6. P = 10 kN downward at x = 0, on the pin.

## Reactions
ΣM about A: R_B·6 − 10·0 = 0 → **R_B = 0**
ΣFy = 0: **R_A = 10 kN**

## Shear force V(x)
- The load is carried straight into the pin: V = 0 for 0 < x < 6

## Bending moment M(x)
- M = 0 everywhere

## Extremes
Nothing is bent: no sagging or hogging extreme.

Fixture: `shared/fixtures/09_load_on_support.json` — its `checks` are the numbers above.
