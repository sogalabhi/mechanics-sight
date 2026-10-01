# 13_gerber_beam — Gerber beam with internal moment hinge

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 10 m. Fixed support at x = 0 (s1), internal hinge at x = 6, roller support at x = 10 (s2). Point load P = 10 kN downward at x = 8.

## Reactions
1. Free body of right span [6, 10] (pinned at hinge x = 6, roller at x = 10):
   - Length = 4 m, load at midspan x = 8 m.
   - ΣM_hinge = 0: R_s2·4 − 10·2 = 0 → **R_s2 = 5 kN**
   - ΣFy = 0: V_hinge + R_s2 − 10 = 0 → **V_hinge = 5 kN** (upward on right span, downward on left cantilever).
2. Free body of left span [0, 6] (cantilever with downward load 5 kN at tip x = 6):
   - ΣFy = 0: R_s1 − 5 = 0 → **R_s1 = 5 kN**
   - ΣM_s1 = 0: M_s1 − 5·6 = 0 → **M_s1 = 30 kN·m** (reaction moment anticlockwise +).
   - Internal moment at fixed support: M(0) = −30 kN·m (hogging).

## Shear force V(x)
- 0 < x < 8: V = +5 kN
- 8 < x < 10: V = 5 − 10 = −5 kN

## Bending moment M(x)
- 0 < x < 6: M(x) = 5x − 30 → M(0) = −30 kN·m, M(6) = 0 (hinge condition verified)
- 6 < x < 8: M(x) = 5(x − 6) = 5x − 30 → M(8) = 10 kN·m
- 8 < x < 10: M(x) = 5(x − 6) − 10(x − 8) = 50 − 5x → M(10) = 0

## Extremes
- **Max sagging:** M = +10.0 kN·m at x = 8.0 m
- **Max hogging:** M = −30.0 kN·m at x = 0.0 m

Fixture: `shared/fixtures/13_gerber_beam.json`
