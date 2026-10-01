# 19_continuous_two_span — Continuous beam over two spans with full UDL

Sign convention: see `docs/SIGN_CONVENTIONS.md` (forces up +, anticlockwise +, sagging +).

## Given
L = 8 m (two equal spans L_1 = 4 m, L_2 = 4 m). Pin support A at x = 0, roller support B at x = 4, roller support C at x = 8.
Full span UDL w = 10 kN/m downward.
Degree of static indeterminacy: D_s = 4 − 3 = 1 (bending degree 1).

## Solution via Theorem of Three Moments (Clapeyron)
1. Intermediate support: B (x = 4 m).
2. Free bending moment diagram for each span (simply supported UDL):
   $$A_1 = A_2 = \frac{2}{3} \cdot L_i \cdot \frac{w L_i^2}{8} = \frac{w L_i^3}{12} = \frac{10 \cdot 4^3}{12} = \frac{160}{3}\text{ kN}\cdot\text{m}^2$$
   Centroids: $\bar{a}_1 = \bar{b}_2 = L_i / 2 = 2.0\text{ m}$.
3. Clapeyron equation:
   $$M_A L_1 + 2 M_B (L_1 + L_2) + M_C L_2 = -\frac{6 A_1 \bar{a}_1}{L_1} - \frac{6 A_2 \bar{b}_2}{L_2}$$
   Since A and C are simple end supports, $M_A = M_C = 0$:
   $$0 + 2 M_B (4 + 4) + 0 = - \frac{6 (160/3)(2)}{4} - \frac{6 (160/3)(2)}{4} = -160 - 160 = -320$$
   $$16 M_B = -320 \implies \mathbf{M_B = -\frac{1}{8} w L_i^2 = -20.0\text{ kN}\cdot\text{m}}\text{ (hogging)}$$
4. Support reactions from span equilibrium:
   - Span AB: $R_A = \frac{w L_1}{2} + \frac{M_B}{L_1} = 20 - \frac{20}{4} = \mathbf{15.0\text{ kN}}$
   - Span BC: $R_C = \frac{w L_2}{2} + \frac{M_B}{L_2} = 20 - \frac{20}{4} = \mathbf{15.0\text{ kN}}$
   - Middle support B: $R_B = w(L_1 + L_2) - R_A - R_C = 80 - 15 - 15 = \mathbf{50.0\text{ kN}}$

## Shear force V(x)
- Span 1 [0, 4]: $V(x) = 15 - 10x \implies V(0) = +15\text{ kN}$, $V(4^-) = -25\text{ kN}$
  Zero shear at $x = 1.5\text{ m}$.
- Span 2 [4, 8]: $V(x) = 25 - 10(x - 4) \implies V(4^+) = +25\text{ kN}$, $V(8) = -15\text{ kN}$
  Zero shear at $x = 6.5\text{ m}$.

## Bending moment M(x)
- Span 1: $M(x) = 15x - 5x^2$
  Peak sagging: at $x = 1.5\text{ m}$, $M_{\max} = 15(1.5) - 5(2.25) = \mathbf{+11.25\text{ kN}\cdot\text{m}}$
- Over support B: $M(4) = \mathbf{-20.0\text{ kN}\cdot\text{m}}$
- Span 2: peak sagging at $x = 6.5\text{ m}$, $M_{\max} = \mathbf{+11.25\text{ kN}\cdot\text{m}}$

## Extremes
- **Max sagging:** M = +11.25 kN·m at x = 1.5 m (and x = 6.5 m)
- **Max hogging:** M = −20.0 kN·m at x = 4.0 m
- **Max positive shear:** V = +25.0 kN at x = 4.0 m (right of support B)
- **Max negative shear:** V = −25.0 kN at x = 4.0 m (left of support B)

Fixture: `shared/fixtures/19_continuous_two_span.json`
