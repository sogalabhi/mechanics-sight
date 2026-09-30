"""Entry point: analyze(beam) -> AnalysisResult."""

from beam_solver.analysis.canonical import detect_canonical
from beam_solver.analysis.critical_points import build_critical_points
from beam_solver.analysis.extremes import find_extremes
from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.segments import build_segments, critical_positions
from beam_solver.domain import Beam, Load, PointLoad, PointMoment
from beam_solver.solvers import Reaction, solve_reactions
from beam_solver.tolerances import force_tol, load_scale, moment_tol


def reaction_loads(reactions: tuple[Reaction, ...], beam: Beam) -> tuple[Load, ...]:
    """Reactions as ordinary loads, so N, V and M treat them like any other load."""
    positions = {s.id: s.position for s in beam.supports}
    loads: list[Load] = []
    for r in reactions:
        x = positions[r.support_id]
        loads.append(PointLoad(f"reaction:{r.support_id}", x, r.fy, fx=r.fx))
        if r.moment != 0.0:
            loads.append(PointMoment(f"reaction-moment:{r.support_id}", x, r.moment))
    return tuple(loads)


def analyze(beam: Beam) -> AnalysisResult:
    """Classify, solve the reactions, then build exact SFD/BMD data."""
    solution = solve_reactions(beam)
    all_loads = beam.loads + reaction_loads(solution.reactions, beam)

    scale = load_scale(
        sum(abs(load.resultant()) + abs(load.horizontal_resultant()) for load in all_loads),
        sum(abs(load.moment_about(0.0)) for load in all_loads),
        beam.length,
    )
    f_tol, m_tol = force_tol(scale), moment_tol(scale, beam.length)

    positions = critical_positions(beam, all_loads)
    segments = build_segments(positions, all_loads, f_tol, m_tol)
    points = build_critical_points(segments, all_loads, beam.length, f_tol, m_tol)
    extremes = find_extremes(segments, points, f_tol, m_tol)

    initial_result = AnalysisResult(
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
        max_tension=extremes.max_tension,
        max_compression=extremes.max_compression,
    )
    canonical = detect_canonical(beam, initial_result)
    if canonical is None:
        return initial_result

    return AnalysisResult(
        classification=initial_result.classification,
        reactions=initial_result.reactions,
        segments=initial_result.segments,
        critical_points=initial_result.critical_points,
        zero_shear_points=initial_result.zero_shear_points,
        max_sagging=initial_result.max_sagging,
        max_hogging=initial_result.max_hogging,
        max_positive_shear=initial_result.max_positive_shear,
        max_negative_shear=initial_result.max_negative_shear,
        warnings=initial_result.warnings,
        canonical=canonical,
        max_tension=initial_result.max_tension,
        max_compression=initial_result.max_compression,
    )
