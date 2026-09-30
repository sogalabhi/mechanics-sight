"""Command line interface: ``beam-solver analyze beam.json [--json out] [--plot out.png]``."""

import argparse
import json
import sys
from pathlib import Path

from pydantic import ValidationError

from beam_solver.analysis import analyze, build_steps
from beam_solver.errors import BeamError
from beam_solver.io import (
    beam_from_schema,
    error_to_schema,
    result_to_json,
    result_to_schema,
    step_to_schema,
)
from beam_solver.io.schemas import BeamIn, ErrorBody, ErrorOut


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="beam-solver")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("analyze", help="analyze a beam JSON file")
    run.add_argument("input", type=Path)
    run.add_argument("--json", type=Path, help="write the result JSON here ('-' for stdout)")
    run.add_argument("--steps", action="store_true", help="include the worked steps in the JSON")
    run.add_argument("--plot", type=Path, help="write a PNG/SVG/PDF diagram here")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        data = BeamIn.model_validate_json(args.input.read_text())
        beam = beam_from_schema(data)
        result = analyze(beam)
    except ValidationError as exc:
        err = ErrorOut(error=ErrorBody(code="invalid_input", message=str(exc)))
        print(err.model_dump_json(indent=2), file=sys.stderr)
        return 2
    except BeamError as exc:
        print(error_to_schema(exc).model_dump_json(indent=2), file=sys.stderr)
        return 1

    payload = result_to_json(result)
    if args.steps:
        out = result_to_schema(result).model_copy(
            update={"steps": [step_to_schema(s) for s in build_steps(beam, result)]}
        )
        payload = out.model_dump(mode="json")
    output = json.dumps(payload, indent=2)
    if args.json is None or str(args.json) == "-":
        print(output)
    else:
        args.json.write_text(output + "\n")
    if args.plot is not None:
        from beam_solver.plotting.diagrams import plot_diagrams

        plot_diagrams(beam, result).savefig(args.plot, dpi=120)
    return 0


def run() -> None:
    """Console-script entry point."""
    raise SystemExit(main())


if __name__ == "__main__":
    run()
