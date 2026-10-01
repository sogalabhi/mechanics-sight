# 17_propped_cantilever_udl — Propped cantilever beam with full UDL

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 6 m. Fixed support at x = 0 (s1), roller support at x = 6 (s2). Full span UDL w = 10 kN/m downward.
Degree of static indeterminacy: D_s = 4 − 3 = 1.

## Solution via Force Method (Consistent Deformations)
1. Primary determinate structure: cantilever fixed at x = 0 by releasing redundant roller support at x = 6.
2. Deflection at x = 6 under external UDL:
   $$\Delta_{B0} = -\frac{w L^4}{8 EI} = -\frac{10 \cdot 6^4}{8 EI} = -\frac{1620}{EI}$$
3. Flexibility coefficient (deflection at x = 6 due to unit upward load at x = 6):
   $$f_{BB} = \frac{L^3}{3 EI} = \frac{6^3}{3 EI} = \frac{72}{EI}$$
4. Compatibility equation:
   $$\Delta_{B0} + R_B \cdot f_{BB} = 0 \implies -\frac{1620}{EI} + R_B \cdot \frac{72}{EI} = 0$$
   $$\mathbf{R_B = \frac{3}{8} w L = \frac{1620}{72} = 22.5\text{ kN}}$$
5. Remaining reactions by equilibrium:
   - $\Sigma Fy = 0: R_A + 22.5 - 60 = 0 \implies \mathbf{R_A = \frac{5}{8} w L = 37.5\text{ kN}}$
   - $\Sigma M_A = 0: M_A + 22.5(6) - 10(6)(3) = 0 \implies M_A = 180 - 135 = \mathbf{45.0\text{ kN}\cdot\text{m}}$
   - Internal moment at fixed end: $M(0) = -\frac{1}{8} w L^2 = -45.0\text{ kN}\cdot\text{m}$ (hogging).

## Shear force V(x)
- $V(x) = 37.5 - 10x$
- $V(0) = +37.5\text{ kN}$, $V(6) = -22.5\text{ kN}$
- Zero shear: $37.5 - 10x = 0 \implies \mathbf{x = 3.75\text{ m}}$

## Bending moment M(x)
- $M(x) = -45 + 37.5x - 5x^2$
- $M(0) = -45.0\text{ kN}\cdot\text{m}$
- At zero shear $x = 3.75\text{ m}$:
  $$M_{\max} = -45 + 37.5(3.75) - 5(3.75)^2 = \frac{9}{128} w L^2 = \mathbf{+25.3125\text{ kN}\cdot\text{m}}\text{ (sagging)}$$
- $M(6) = -45 + 37.5(6) - 5(36) = 0$

## Extremes
- **Max sagging:** M = +25.3125 kN·m at x = 3.75 m
- **Max hogging:** M = −45.0 kN·m at x = 0.0 m

Fixture: `shared/fixtures/17_propped_cantilever_udl.json`
