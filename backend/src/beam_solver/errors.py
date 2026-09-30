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


class SolverConsistencyError(BeamError):
    """An internal consistency check failed. This is a bug, never a user error."""

    code = "internal_error"
