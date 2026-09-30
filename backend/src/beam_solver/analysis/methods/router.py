"""Method Router for Classical Indeterminate Analysis Steps (Milestones 4.2 & 4.3)."""

from beam_solver.analysis.methods.direct_stiffness import generate_direct_stiffness_steps
from beam_solver.analysis.methods.force_method import generate_force_method_steps
from beam_solver.analysis.methods.moment_distribution import generate_moment_distribution_steps
from beam_solver.analysis.methods.slope_deflection import generate_slope_deflection_steps
from beam_solver.analysis.methods.three_moment import generate_three_moment_steps
from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.steps import Step
from beam_solver.domain import Beam, SupportKind
from beam_solver.solvers import Determinacy

AVAILABLE_METHODS: tuple[str, ...] = (
    "force_method",
    "slope_deflection",
    "moment_distribution",
    "three_moment",
    "direct_stiffness",
)


def available_methods(beam: Beam, result: AnalysisResult) -> tuple[str, ...]:
    """Return available classical solution methods for this beam."""
    if result.classification.bending_degree <= 0:
        return ()

    methods: list[str] = ["direct_stiffness", "force_method"]
    num_supports = len(beam.supports)
    has_hinges = len(beam.hinges) > 0

    if not has_hinges:
        methods.append("slope_deflection")
        methods.append("moment_distribution")

    if num_supports >= 3 and not has_hinges:
        methods.append("three_moment")

    return tuple(methods)


def default_method_for(beam: Beam, result: AnalysisResult) -> str:
    """Recommend the most canonical pedagogical method for this beam."""
    num_supports = len(beam.supports)
    has_fixed = any(s.kind is SupportKind.FIXED for s in beam.supports)
    has_hinges = len(beam.hinges) > 0

    if num_supports >= 3 and not has_fixed and not has_hinges:
        return "three_moment"
    if has_fixed and not has_hinges and num_supports == 2:
        fixed_count = sum(1 for s in beam.supports if s.kind is SupportKind.FIXED)
        if fixed_count == 2:
            return "slope_deflection"
        return "force_method"
    return "force_method"


def build_indeterminate_steps(
    beam: Beam, result: AnalysisResult, method: str | None = None
) -> list[Step]:
    """Generate worked reaction derivation steps using the specified (or default) classical method."""
    if result.classification.status is not Determinacy.INDETERMINATE:
        return []

    chosen = method or default_method_for(beam, result)

    if chosen == "force_method":
        return generate_force_method_steps(beam, result)
    elif chosen == "slope_deflection":
        return generate_slope_deflection_steps(beam, result)
    elif chosen == "moment_distribution":
        return generate_moment_distribution_steps(beam, result)
    elif chosen == "three_moment":
        return generate_three_moment_steps(beam, result)
    elif chosen == "direct_stiffness":
        return generate_direct_stiffness_steps(beam, result)

    # Fallback to force method
    return generate_force_method_steps(beam, result)
