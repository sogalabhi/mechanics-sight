"""The error hierarchy and codes (plan.md Section 5)."""

import pytest

from beam_solver import errors


@pytest.mark.parametrize(
    ("cls", "code"),
    [
        (errors.InvalidBeamError, "invalid_beam"),
        (errors.InvalidPositionError, "invalid_position"),
        (errors.InvalidLoadError, "invalid_load"),
        (errors.InvalidSupportError, "invalid_support"),
        (errors.UnstableBeamError, "unstable"),
        (errors.IndeterminateBeamError, "indeterminate"),
        (errors.SolverConsistencyError, "internal_error"),
    ],
)
def test_codes(cls: type[errors.BeamError], code: str) -> None:
    assert cls.code == code
    assert issubclass(cls, errors.BeamError)


def test_core_does_not_import_web_or_plotting() -> None:
    import subprocess
    import sys

    code = (
        "import sys, beam_solver.domain, beam_solver.solvers, beam_solver.analysis;"
        "bad = {'fastapi', 'matplotlib'} & set(sys.modules); assert not bad, bad"
    )
    subprocess.run([sys.executable, "-c", code], check=True)
