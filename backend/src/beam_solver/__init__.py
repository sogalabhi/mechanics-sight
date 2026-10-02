"""Beam solver: exact SFD/BMD for statically determinate beams."""

from beam_solver.errors import (
    BeamError,
    IndeterminateBeamError,
    InvalidBeamError,
    InvalidLoadError,
    InvalidPositionError,
    InvalidSectionError,
    InvalidSpecimenError,
    InvalidSupportError,
    LabError,
    SolverConsistencyError,
    SpecimenBrokenError,
    StrainOutOfRangeError,
    UnknownPresetError,
    UnstableBeamError,
    UnsupportedOperationError,
)

__all__ = [
    "BeamError",
    "IndeterminateBeamError",
    "InvalidBeamError",
    "InvalidLoadError",
    "InvalidPositionError",
    "InvalidSectionError",
    "InvalidSpecimenError",
    "InvalidSupportError",
    "LabError",
    "SolverConsistencyError",
    "SpecimenBrokenError",
    "StrainOutOfRangeError",
    "UnknownPresetError",
    "UnstableBeamError",
    "UnsupportedOperationError",
]
