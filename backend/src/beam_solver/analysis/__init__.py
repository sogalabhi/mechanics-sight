"""Internal forces: segments, critical points, extremes."""

from beam_solver.analysis.analyze import analyze
from beam_solver.analysis.canonical import detect_canonical
from beam_solver.analysis.results import (
    AnalysisResult,
    CanonicalCase,
    CriticalPoint,
    DeflectionResult,
    DeflectionSegment,
    Extreme,
    SampledDiagram,
    Segment,
    Side,
)
from beam_solver.analysis.steps import Step, build_steps

__all__ = [
    "AnalysisResult",
    "CanonicalCase",
    "CriticalPoint",
    "DeflectionResult",
    "DeflectionSegment",
    "Extreme",
    "SampledDiagram",
    "Segment",
    "Side",
    "Step",
    "analyze",
    "build_steps",
    "detect_canonical",
]
