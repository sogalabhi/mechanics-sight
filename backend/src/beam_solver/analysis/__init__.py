"""Internal forces: segments, critical points, extremes."""

from beam_solver.analysis.analyze import analyze
from beam_solver.analysis.results import (
    AnalysisResult,
    CriticalPoint,
    Extreme,
    SampledDiagram,
    Segment,
    Side,
)

__all__ = [
    "AnalysisResult",
    "CriticalPoint",
    "Extreme",
    "SampledDiagram",
    "Segment",
    "Side",
    "analyze",
]
