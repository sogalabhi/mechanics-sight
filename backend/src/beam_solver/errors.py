"""Exception hierarchy. Each error has a ``code`` used by the API error envelope."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from beam_solver.solvers.classification import Classification


class BeamError(Exception):
    """Base class for all beam solver errors."""

    code = "beam_error"


class InvalidBeamError(BeamError):
    """The beam input is invalid."""

    code = "invalid_beam"


class InvalidPositionError(InvalidBeamError):
    """A position lies outside the beam or is otherwise invalid."""

    code = "invalid_position"


class InvalidLoadError(InvalidBeamError):
    """A load is invalid."""

    code = "invalid_load"


class InvalidSupportError(InvalidBeamError):
    """A support is invalid."""

    code = "invalid_support"


class InvalidSectionError(InvalidBeamError):
    """A material or cross-section definition is invalid."""

    code = "invalid_section"


class ClassifiedBeamError(BeamError):
    """An error that carries the beam's classification (unstable or indeterminate)."""

    def __init__(self, message: str, classification: "Classification") -> None:
        super().__init__(message)
        self.classification = classification


class UnstableBeamError(ClassifiedBeamError):
    """The supports cannot hold the beam in equilibrium for every load."""

    code = "unstable"


class IndeterminateBeamError(ClassifiedBeamError):
    """The beam cannot be solved by statics alone (not supported yet)."""

    code = "indeterminate"


class LabError(BeamError):
    """Base class for material-lab (tension test) errors."""

    code = "lab_error"


class UnknownPresetError(LabError):
    """The requested material preset does not exist."""

    code = "unknown_preset"


class InvalidSpecimenError(LabError):
    """A specimen dimension is invalid."""

    code = "invalid_specimen"


class StrainOutOfRangeError(LabError):
    """A requested strain lies outside the preset's valid range (0 to fracture strain)."""

    code = "strain_out_of_range"


class UnsupportedOperationError(LabError):
    """A loading-history operation is not known."""

    code = "unsupported_op"


class SpecimenBrokenError(LabError):
    """An operation was requested after the specimen fractured. Only a reset applies."""

    code = "test_finished"


class SolverConsistencyError(BeamError):
    """An internal consistency check failed. This is a bug, never a user error."""

    code = "internal_error"
