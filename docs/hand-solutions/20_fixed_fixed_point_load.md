# 20_fixed_fixed_point_load — Fixed–fixed beam with central point load

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Fixed support at x = 0 (s1), fixed support at x = 6 (s2). Concentrated downward point load P = 12 kN at midspan x = 3.
Degree of static indeterminacy: D_s = 6 − 3 = 3 (axial degree 1, bending degree 2).

## Solution via Slope-Deflection Method
1. Fixed-end moments under central point load P = 12 kN:
   $$M^F_{AB} = -\frac{P L}{8} = -\frac{12 \cdot 6}{8} = -9.0\text{ kN}\cdot\text{m}$$
   $$M^F_{BA} = +\frac{P L}{8} = +9.0\text{ kN}\cdot\text{m}$$
2. Kinematic boundary conditions:
   $\theta_A = 0$ (fixed), $\theta_B = 0$ (fixed).
3. Final end moments:
   $$M_{AB} = -9.0\text{ kN}\cdot\text{m},\quad M_{BA} = +9.0\text{ kN}\cdot\text{m}$$
   Internal moments at fixed ends: $M(0) = -9.0\text{ kN}\cdot\text{m}$ (hogging), $M(6) = -9.0\text{ kN}\cdot\text{m}$ (hogging).
4. Vertical reactions by symmetry:
   $$\mathbf{R_A = R_B = \frac{P}{2} = 6.0\text{ kN}}$$
   Reaction moments at supports:
   - Fixed support A (x = 0): $M_A = +9.0\text{ kN}\cdot\text{m}$
   - Fixed support B (x = 6): $M_B = -9.0\text{ kN}\cdot\text{m}$

## Shear force V(x)
- 0 < x < 3: V = +6.0 kN
- 3 < x < 6: V = 6 − 12 = −6.0 kN

## Bending moment M(x)
- 0 < x < 3: $M(x) = -9 + 6x$
- At midspan $x = 3.0\text{ m}$:
  $$M(3) = -9 + 6(3) = \frac{P L}{8} = \mathbf{+9.0\text{ kN}\cdot\text{m}}\text{ (sagging)}$$
- 3 < x < 6: $M(x) = -9 + 6x - 12(x - 3) = 27 - 6x \implies M(6) = -9.0\text{ kN}\cdot\text{m}$

## Extremes
- **Max sagging:** M = +9.0 kN·m at x = 3.0 m
- **Max hogging:** M = −9.0 kN·m at x = 0.0 m (and x = 6.0 m)

Fixture: `shared/fixtures/20_fixed_fixed_point_load.json`
