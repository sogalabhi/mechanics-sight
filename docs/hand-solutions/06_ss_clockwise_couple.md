# 06_ss_clockwise_couple — Simply supported beam, clockwise couple

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Pin A at 0, roller B at 6. Clockwise couple of 12 kN·m at x = 2 (stored as −12).

## Reactions
ΣM about A (anticlockwise +): R_B·6 + (−12) = 0 → **R_B = 2 kN**
ΣFy = 0: R_A + R_B = 0 → **R_A = −2 kN**

## Shear force V(x)
- 0 < x < 6: V = −2

## Bending moment M(x)
- 0 < x < 2: M = −2x → M(2⁻) = −4
- A clockwise couple makes the BMD jump **up** by 12: M(2⁺) = 8
- 2 < x < 6: M = −2x + 12 → M(6) = 0

## Extremes
**M max sagging = 8 kN·m and M max hogging = −4 kN·m, both at x = 2** (either side of the couple).

Fixture: `shared/fixtures/06_ss_clockwise_couple.json` — its `checks` are the numbers above.
