"""Entry point: analyze(beam) -> AnalysisResult."""

from beam_solver.analysis.critical_points import build_critical_points
from beam_solver.analysis.extremes import find_extremes
from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.segments import build_segments, critical_positions
from beam_solver.domain import Beam, Load, PointLoad, PointMoment
from beam_solver.solvers import Reaction, solve_reactions
from beam_solver.tolerances import force_tol, load_scale, moment_tol


def reaction_loads(reactions: tuple[Reaction, ...], beam: Beam) -> tuple[Load, ...]:
    """Reactions as ordinary loads, so V and M treat them like any other load."""
    positions = {s.id: s.position for s in beam.supports}
    loads: list[Load] = []
    for r in reactions:
        x = positions[r.support_id]
        loads.append(PointLoad(f"reaction:{r.support_id}", x, r.fy))
        if r.moment != 0.0:
            loads.append(PointMoment(f"reaction-moment:{r.support_id}", x, r.moment))
    return tuple(loads)


def analyze(beam: Beam) -> AnalysisResult:
    """Classify, solve the reactions, then build exact SFD/BMD data."""
    solution = solve_reactions(beam)
    all_loads = beam.loads + reaction_loads(solution.reactions, beam)

    scale = load_scale(
        sum(abs(load.resultant()) for load in all_loads),
        sum(abs(load.moment_about(0.0)) for load in all_loads),
        beam.length,
    )
    f_tol, m_tol = force_tol(scale), moment_tol(scale, beam.length)

    positions = critical_positions(beam, all_loads)
    segments = build_segments(positions, all_loads, f_tol, m_tol)
    points = build_critical_points(segments, all_loads, beam.length, f_tol, m_tol)
    extremes = find_extremes(segments, points, f_tol, m_tol)

    return AnalysisResult(
        classification=solution.classification,
        reactions=solution.reactions,
        segments=segments,
        critical_points=points,
        zero_shear_points=extremes.zero_shear_points,
        max_sagging=extremes.max_sagging,
        max_hogging=extremes.max_hogging,
        max_positive_shear=extremes.max_positive_shear,
        max_negative_shear=extremes.max_negative_shear,
        warnings=solution.warnings,
    )
