# Phase 3 physical-analysis contract

This contract fixes the conventions and data boundaries before physical deflection and stress
outputs are added. Existing beams without physical properties remain valid and continue to use
the qualitative elastic-curve view.

## Ownership and units

The Python backend owns section geometry, material conversion, physical deflection, slope and
stress calculations. The frontend renders backend results and may exaggerate displacement only
for drawing.

| Quantity | Input/display unit | Domain and API calculation unit |
|---|---:|---:|
| Section dimensions | m | m |
| Young's modulus E | GPa | kN/m² (`GPa × 1,000,000`) |
| Yield strength | MPa | kN/m² (`MPa × 1,000`) |
| Deflection y | mm | m |
| Slope θ | rad | rad |
| Normal/shear stress | MPa | kN/m² |

The section-local y-axis passes through the centroid and is positive upward. `y_top` is positive;
`y_bottom` is negative. `width_at(y)` returns total material width at a horizontal cut. `Q(y)` is
the first moment, about the centroidal axis, of material above that cut.

The existing structural sign convention remains authoritative: deflection is upward positive and
slope is anticlockwise positive. Therefore Euler–Bernoulli curvature is `EI y'' = M` under the
project's sagging-positive convention. Any exaggerated SVG displacement is a display transform,
not an analysis sign convention.

## Additive API evolution

Physical properties will be optional v1 fields. Omitting them preserves current analysis output
and shared links. When supplied, the response will add local ascending-coefficient polynomials in
`t = x - x_start` for slope and deflection, plus exact physical extrema. No existing N/V/M field
changes meaning.

The first physical slice supports one material and one section over the complete beam. Stepped
property spans are a later additive slice and introduce their boundaries as analysis breakpoints.

## Boundary conditions

- Deflection is zero at pin and roller supports.
- Deflection and slope are zero at a fixed support.
- Deflection and slope are continuous at ordinary segment and property boundaries.
- At an internal hinge, deflection is continuous and moment is zero; left and right slopes are
  independent.
- Bending-indeterminate beams remain rejected until Phase 4.

## Benchmarks

Physical deflection is checked against these closed-form cases:

| Case | Expected result magnitude |
|---|---:|
| Simply supported, central point load | `PL³ / (48EI)` at midspan |
| Simply supported, full UDL | `5wL⁴ / (384EI)` at midspan |
| Cantilever, free-end point load | `PL³ / (3EI)` and `θ = PL² / (2EI)` at the free end |
| Cantilever, full UDL | `wL⁴ / (8EI)` at the free end |
| Overhang | independent hand solution, including an off-support displacement extreme |
| Gerber beam | continuous hinge displacement, zero hinge moment, independent side slopes |

Section and stress benchmarks include a solid rectangle, hollow box, solid circle, pipe,
symmetric I-section and T-section. Bending uses `σ = -My/I`; transverse shear uses
`τ = VQ/(Ib)`. Stress output covers bending and transverse shear in Phase 3; combined axial
stress and buckling are outside this milestone.
