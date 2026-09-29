"""Map every failure to the single error envelope (plan.md Section 10)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from beam_solver.errors import BeamError, SolverConsistencyError
from beam_solver.io import error_to_schema
from beam_solver.io.schemas import ErrorBody, ErrorOut

logger = logging.getLogger(__name__)


def _response(status: int, body: ErrorOut) -> JSONResponse:
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"))


async def _beam_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, BeamError)
    if isinstance(exc, SolverConsistencyError):
        logger.error("solver consistency error: %s", exc)
        return _response(500, error_to_schema(exc))
    return _response(422, error_to_schema(exc))


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [{"loc": list(e.get("loc", ())), "msg": str(e.get("msg", ""))} for e in exc.errors()]
    body = ErrorOut(
        error=ErrorBody(
            code="invalid_input", message="The request body is invalid.", details={"errors": errors}
        )
    )
    return _response(422, body)


async def _unexpected_error(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unexpected error", exc_info=exc)
    body = ErrorOut(error=ErrorBody(code="internal_error", message="Internal server error."))
    return _response(500, body)


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(BeamError, _beam_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(Exception, _unexpected_error)
