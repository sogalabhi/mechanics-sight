# 18_fixed_fixed_udl — Fixed–fixed beam with full UDL

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Fixed support at x = 0 (s1), fixed support at x = 6 (s2). Full span UDL w = 10 kN/m downward.
Degree of static indeterminacy: D_s = 6 − 3 = 3 (axial degree 1, bending degree 2).

## Solution via Slope-Deflection Method
1. Fixed-end moments:
   $$M^F_{AB} = -\frac{w L^2}{12} = -\frac{10 \cdot 36}{12} = -30.0\text{ kN}\cdot\text{m}$$
   $$M^F_{BA} = +\frac{w L^2}{12} = +30.0\text{ kN}\cdot\text{m}$$
2. Kinematic boundary conditions:
   $\theta_A = 0$ (fixed), $\theta_B = 0$ (fixed), $\psi = 0$ (no settlement).
3. Final member end moments:
   $$M_{AB} = M^F_{AB} + \frac{2EI}{L}(2\theta_A + \theta_B) = -30.0\text{ kN}\cdot\text{m}$$
   $$M_{BA} = M^F_{BA} + \frac{2EI}{L}(2\theta_B + \theta_A) = +30.0\text{ kN}\cdot\text{m}$$
   Internal bending moment at ends: $M(0) = -30.0\text{ kN}\cdot\text{m}$ (hogging), $M(6) = -30.0\text{ kN}\cdot\text{m}$ (hogging).
4. Vertical reactions by symmetry:
   $$\mathbf{R_A = R_B = \frac{w L}{2} = 30.0\text{ kN}}$$
   Reaction moments at supports:
   - Fixed support A (x = 0): $M_A = +30.0\text{ kN}\cdot\text{m}$
   - Fixed support B (x = 6): $M_B = -30.0\text{ kN}\cdot\text{m}$

## Shear force V(x)
- $V(x) = 30 - 10x$
- $V(0) = +30.0\text{ kN}$, $V(6) = -30.0\text{ kN}$
- Zero shear: $30 - 10x = 0 \implies \mathbf{x = 3.0\text{ m}}$

## Bending moment M(x)
- $M(x) = -30 + 30x - 5x^2$
- $M(0) = -30.0\text{ kN}\cdot\text{m}$
- At midspan $x = 3.0\text{ m}$:
  $$M_{\text{mid}} = -30 + 30(3) - 5(9) = -30 + 90 - 45 = \frac{w L^2}{24} = \mathbf{+15.0\text{ kN}\cdot\text{m}}\text{ (sagging)}$$
- $M(6) = -30 + 30(6) - 5(36) = -30.0\text{ kN}\cdot\text{m}$

## Extremes
- **Max sagging:** M = +15.0 kN·m at x = 3.0 m
- **Max hogging:** M = −30.0 kN·m at x = 0.0 m (and x = 6.0 m)

Fixture: `shared/fixtures/18_fixed_fixed_udl.json`
