# Steel Material Lab fixtures

Hand-solved reference cases for `POST /api/v1/lab/tension`, written **before** the solver exists. They implement cases L1 to L23 of `docs/STEEL_LAB_CONTRACT.md` section 7. They live in a subfolder so the beam fixture loaders (which glob `shared/fixtures/*.json`) and the Examples menu never see them.

## File format

```json
{
  "case": "L10",                      // id in the contract
  "name": "L10_hardening_0p05",       // file name without .json
  "milestone": "S1" | "S2",           // which milestone must pass it
  "description": "...",
  "input": { ... },                   // the exact request body for POST /api/v1/lab/tension
  "tolerance": { "strain": 1e-12, "stress_mpa": 1e-6, "force_kn": 1e-6, "extension_mm": 1e-9,
                 "plastic_strain": 1e-12, "elastic_strain": 1e-12 },
  "expected": { "strain", "stress_mpa", "force_kn", "extension_mm", "plastic_strain",
                "elastic_strain", "max_strain", "region", "landmark" },   // the response `state`
  "expected_error": "strain_out_of_range",   // instead of `expected` for the error cases
  "trace_ends_with": [[eps, sigma], ...],    // optional: the last points of `trace`
  "derivation": "the hand arithmetic"
}
```

- Specimen is always d₀ = 10 mm, L₀ = 50 mm (A₀ = 78.5398 mm²), preset `steel_textbook`.
- `landmark` is `"A"` to `"F"` only when the strain equals that point exactly, otherwise `null`.
- `elastic_strain` is `strain − plastic_strain`, except after fracture where it is 0 (the recoverable part is lost when the bar separates; `strain` stays the strain at the break).
- History ops: `strain` (move to `to`), `unload_to_zero_stress`, `reset`.

## How the numbers were made

The expected values are exact rational arithmetic on the formulas in the contract (not output from any solver), converted to floats. They were asserted against the rounded figures quoted in the contract table (for example 317.70 MPa and 24.952 kN for L10). Each file's `derivation` shows the arithmetic by hand so it can be checked without running anything.
