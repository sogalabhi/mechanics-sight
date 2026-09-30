"""Conversion between JSON schemas and domain/result objects."""

from typing import Any

from beam_solver.analysis import AnalysisResult, CanonicalCase, Extreme, Step
from beam_solver.domain import (
    Beam,
    CircularSection,
    DistributedLoad,
    ISection,
    Load,
    Material,
    PointLoad,
    PointMoment,
    PropertySpan,
    RectangularSection,
    Section,
    Support,
    SupportKind,
    TSection,
)
from beam_solver.errors import BeamError, ClassifiedBeamError
from beam_solver.io.schemas import (
    AnalysisOut,
    BeamIn,
    BendingStressOut,
    BendingStressSegmentOut,
    CanonicalOut,
    CircularSectionIn,
    ClassificationOut,
    CriticalPointOut,
    DeflectionOut,
    DeflectionSegmentOut,
    ErrorBody,
    ErrorOut,
    ExtremeOut,
    ExtremesOut,
    ISectionIn,
    PointLoadIn,
    PointMomentIn,
    PropertySpanIn,
    ReactionOut,
    RectangularSectionIn,
    SectionIn,
    SegmentOut,
    ShearStressOut,
    StepOut,
    TSectionIn,
)
from beam_solver.solvers import Classification


def _section_from_schema(data: SectionIn | None) -> Section | None:
    if data is None:
        return None
    if isinstance(data, RectangularSectionIn):
        return RectangularSection(data.width, data.height, data.wall_thickness)
    elif isinstance(data, CircularSectionIn):
        return CircularSection(data.diameter, data.wall_thickness)
    elif isinstance(data, ISectionIn):
        return ISection(data.height, data.flange_width, data.flange_thickness, data.web_thickness)
    elif isinstance(data, TSectionIn):
        return TSection(data.flange_width, data.flange_thickness, data.web_depth, data.web_thickness)
    return None


def beam_from_schema(data: BeamIn) -> Beam:
    supports = tuple(Support(s.id, SupportKind(s.type), s.position) for s in data.supports)
    loads: list[Load] = []
    for ld in data.loads:
        if isinstance(ld, PointLoadIn):
            loads.append(PointLoad(ld.id, ld.position, ld.magnitude, fx=ld.fx))
        elif isinstance(ld, PointMomentIn):
            loads.append(PointMoment(ld.id, ld.position, ld.magnitude))
        else:
            loads.append(DistributedLoad(ld.id, ld.start, ld.end, ld.w_start, ld.w_end))
    material = (
        None
        if data.material is None
        else Material(data.material.young_modulus_gpa, data.material.yield_strength_mpa)
    )
    section = _section_from_schema(data.section)
    spans_domain: tuple[PropertySpan, ...] = ()
    if data.spans:
        spans_domain = tuple(
            PropertySpan(
                sp.x_start, sp.x_end,
                Material(sp.material.young_modulus_gpa, sp.material.yield_strength_mpa),
                _section_from_schema(sp.section),  # type: ignore[arg-type]
            )
            for sp in data.spans
        )
    return Beam(data.length, supports, tuple(loads), tuple(data.hinges), material, section, spans_domain)


def beam_from_json(data: dict[str, Any]) -> Beam:
    """Validate a JSON-like dict and build a Beam."""
    return beam_from_schema(BeamIn.model_validate(data))


def classification_to_schema(c: Classification) -> ClassificationOut:
    return ClassificationOut(
        status=c.status.value,
        restraints=c.restraints,
        equations=c.equations,
        degree=c.degree,
        axial_degree=c.axial_degree,
        bending_degree=c.bending_degree,
        reason=c.reason,
    )


def _extreme(e: Extreme | None) -> ExtremeOut | None:
    return None if e is None else ExtremeOut(x=e.x, value=e.value)


def canonical_to_schema(c: CanonicalCase | None) -> CanonicalOut | None:
    if c is None:
        return None
    return CanonicalOut(
        case_id=c.case_id,
        name=c.name,
        symbolic_formula=c.symbolic_formula,
        symbolic_reactions=c.symbolic_reactions,
        substituted_formula=c.substituted_formula,
        result_text=c.result_text,
        location_text=c.location_text,
        derivation=list(c.derivation),
    )


def step_to_schema(step: Step) -> StepOut:
    return StepOut(
        kind=step.kind,  # type: ignore[arg-type]
        group=step.group,  # type: ignore[arg-type]
        title=step.title,
        symbolic=step.symbolic,
        substituted=step.substituted,
        result=step.result,
        notes=list(step.notes),
        x_start=step.x_start,
        x_end=step.x_end,
        at=step.at,
    )


def result_to_schema(result: AnalysisResult) -> AnalysisOut:
    return AnalysisOut(
        classification=classification_to_schema(result.classification),
        reactions=[
            ReactionOut(support_id=r.support_id, fx=r.fx, fy=r.fy, moment=r.moment)
            for r in result.reactions
        ],
        segments=[
            SegmentOut(
                x_start=s.x_start,
                x_end=s.x_end,
                shear=list(s.shear),
                moment=list(s.moment),
                axial=list(s.axial),
            )
            for s in result.segments
        ],
        critical_points=[
            CriticalPointOut(
                x=p.x,
                shear_left=p.shear_left,
                shear_right=p.shear_right,
                moment_left=p.moment_left,
                moment_right=p.moment_right,
                axial_left=p.axial_left,
                axial_right=p.axial_right,
            )
            for p in result.critical_points
        ],
        zero_shear_points=list(result.zero_shear_points),
        extremes=ExtremesOut(
            max_sagging=_extreme(result.max_sagging),
            max_hogging=_extreme(result.max_hogging),
            max_positive_shear=_extreme(result.max_positive_shear),
            max_negative_shear=_extreme(result.max_negative_shear),
            max_tension=_extreme(result.max_tension),
            max_compression=_extreme(result.max_compression),
        ),
        warnings=list(result.warnings),
        canonical=canonical_to_schema(result.canonical),
        deflection=(
            None
            if result.deflection is None
            else DeflectionOut(
                segments=[
                    DeflectionSegmentOut(
                        x_start=s.x_start,
                        x_end=s.x_end,
                        slope=list(s.slope),
                        deflection=list(s.deflection),
                    )
                    for s in result.deflection.segments
                ],
                max_upward=_extreme(result.deflection.max_upward),
                max_downward=_extreme(result.deflection.max_downward),
                max_absolute=ExtremeOut(
                    x=result.deflection.max_absolute.x,
                    value=result.deflection.max_absolute.value,
                ),
            )
        ),
        bending_stress=(
            None
            if result.bending_stress is None
            else BendingStressOut(
                segments=[
                    BendingStressSegmentOut(
                        x_start=s.x_start,
                        x_end=s.x_end,
                        sigma_top=list(s.sigma_top),
                        sigma_bottom=list(s.sigma_bottom),
                    )
                    for s in result.bending_stress.segments
                ],
                max_tension=_extreme(result.bending_stress.max_tension),
                max_compression=_extreme(result.bending_stress.max_compression),
                yield_ratio=result.bending_stress.yield_ratio,
                yield_exceeded=result.bending_stress.yield_exceeded,
                yield_location=_extreme(result.bending_stress.yield_location),
            )
        ),
        shear_stress=(
            None
            if result.shear_stress is None
            else ShearStressOut(
                max_shear_stress=_extreme(result.shear_stress.max_shear_stress),
            )
        ),
    )


def result_to_json(result: AnalysisResult) -> dict[str, Any]:
    out = result_to_schema(result)
    exclude = set() if out.steps is not None else {"steps"}
    if out.deflection is None:
        exclude.add("deflection")
    if out.bending_stress is None:
        exclude.add("bending_stress")
    if out.shear_stress is None:
        exclude.add("shear_stress")
    return out.model_dump(mode="json", exclude=exclude)


def error_to_schema(error: BeamError) -> ErrorOut:
    details: dict[str, object] = {}
    if isinstance(error, ClassifiedBeamError):
        details["classification"] = classification_to_schema(error.classification).model_dump()
    return ErrorOut(error=ErrorBody(code=error.code, message=str(error), details=details))
