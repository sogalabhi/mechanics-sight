"""All numerical tolerances. Nothing else in the package defines its own."""

POSITION_TOL = 1e-6
"""Two positions (m) closer than this are the same point."""

RELATIVE_VALUE_TOL = 1e-9
"""Value tolerance relative to the load scale (see plan.md, Section 3)."""


def same_position(a: float, b: float) -> bool:
    """Return True if two positions (m) are the same point."""
    return abs(a - b) <= POSITION_TOL


def load_scale(sum_abs_forces: float, sum_abs_moments: float, length: float) -> float:
    """Characteristic force scale (kN) of a beam's loads."""
    return max(1.0, sum_abs_forces + sum_abs_moments / length)


def force_tol(scale: float) -> float:
    """Tolerance for forces (kN)."""
    return RELATIVE_VALUE_TOL * scale


def moment_tol(scale: float, length: float) -> float:
    """Tolerance for moments (kN·m)."""
    return RELATIVE_VALUE_TOL * scale * length


STRAIN_TOL = 1e-12
"""Two engineering strains (dimensionless) closer than this are the same state (material lab)."""
