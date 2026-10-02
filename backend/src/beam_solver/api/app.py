"""FastAPI app: POST /api/v1/analyze (plan.md Section 10). Stateless."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from beam_solver.analysis import analyze, build_steps
from beam_solver.api.errors import install_error_handlers
from beam_solver.io import beam_from_schema, result_to_schema, step_to_schema
from beam_solver.io.lab import TensionIn, TensionOut, run_tension_request
from beam_solver.io.schemas import AnalysisOut, BeamIn, ErrorOut

DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]  # Vite dev server


def create_app(allowed_origins: list[str] | None = None) -> FastAPI:
    app = FastAPI(
        title="Mechanics Sight API",
        version="1.0.0",
        description=(
            "Exact SFD/BMD for beams. SI units (m, kN, kN·m, kN/m). Forces upward positive, "
            "moments anticlockwise positive, internal moment sagging positive. Segment "
            "polynomials use ascending coefficients in t = x - x_start and are valid strictly "
            "inside the segment; use critical_points for values at critical points."
        ),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins if allowed_origins is not None else DEV_ORIGINS,
        allow_methods=["POST", "GET"],
        allow_headers=["Content-Type"],
    )
    install_error_handlers(app)

    @app.post(
        "/api/v1/analyze",
        response_model=AnalysisOut,
        responses={422: {"model": ErrorOut}, 500: {"model": ErrorOut}},
    )
    def analyze_beam(
        beam: BeamIn, steps: bool = False, method: str | None = None
    ) -> Response:
        """Classify the beam, solve its reactions, and return exact SFD/BMD data.

        With ``?steps=true`` the response also carries the worked steps (LaTeX).
        ``?method=...`` selects the classical solution method for indeterminate beams.
        """
        domain_beam = beam_from_schema(beam)
        result = analyze(domain_beam)
        out = result_to_schema(result, beam=domain_beam, selected_method=method)
        if steps:
            worked = [
                step_to_schema(s) for s in build_steps(domain_beam, result, method=method)
            ]
            out = out.model_copy(update={"steps": worked})
        exclude = set() if steps else {"steps"}
        if out.deflection is None:
            exclude.add("deflection")
        if out.bending_stress is None:
            exclude.add("bending_stress")
        if out.shear_stress is None:
            exclude.add("shear_stress")
        if not out.available_methods:
            exclude.add("available_methods")
            exclude.add("selected_method")
        return JSONResponse(out.model_dump(mode="json", exclude=exclude))

    @app.post(
        "/api/v1/lab/tension",
        response_model=TensionOut,
        responses={422: {"model": ErrorOut}, 500: {"model": ErrorOut}},
    )
    def lab_tension(request: TensionIn) -> TensionOut:
        """Replay a loading history on a fresh round tension specimen (steel material lab).

        Stateless: the whole history is sent each time, so any state is reproducible. Strain is
        commanded and the preset's material law decides the stress. Engineering stress (MPa) is
        force over the original area; strain is engineering strain (fraction); tension positive.
        """
        return run_tension_request(request)

    @app.get("/api/v1/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
