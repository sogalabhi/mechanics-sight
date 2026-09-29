# Sign conventions

Used identically in the domain, solver, API and UI.

## Units
SI only: m, kN, kN·m, kN/m.

## Positive directions
| Quantity | Positive |
|---|---|
| Position x | From the left end, 0 ≤ x ≤ L |
| Forces, reactions, distributed intensity w | Upward |
| Horizontal forces and reactions | To the right |
| Applied couples, reaction moments, equilibrium moments | Anticlockwise |
| Internal shear V(x) | Sum of vertical forces left of the cut |
| Internal moment M(x) | Sagging |
| Axial force N(x) (Phase 2) | Tension |
| Deflection y, slope θ (Phase 3) | Upward, anticlockwise |

A downward 10 kN load is stored as −10. A clockwise 12 kN·m couple is stored as −12.

## Section rules
```
From the left:   V(x) = + Σ (forces left of x)
                 M(x) = − Σ (anticlockwise moments about x of loads left of x)

From the right:  V(x) = − Σ (forces right of x)
                 M(x) = + Σ (anticlockwise moments about x of loads right of x)
```

Consequences:
- An upward point load F at a < x adds F·(x − a) to M.
- A clockwise couple makes the BMD jump **up** (left to right); an anticlockwise one makes it drop.
- dV/dx = w, dM/dx = V.
- Just right of x = L, V and M are zero (global equilibrium).

## Tolerances
Defined only in `beam_solver/tolerances.py`. Positions within 1e-6 m are the same point.
