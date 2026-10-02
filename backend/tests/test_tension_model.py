"""Tension-test model: curve against an exact oracle, continuity, random-history invariants."""

import math
from itertools import pairwise

import pytest
import sympy as sp
from hypothesis import given, settings
from hypothesis import strategies as st

from beam_solver.errors import (
    InvalidSpecimenError,
    SpecimenBrokenError,
    StrainOutOfRangeError,
    UnknownPresetError,
)
from beam_solver.material import (
    STEEL_TEXTBOOK,
    Operation,
    Reset,
    Specimen,
    StrainTo,
    TensionResult,
    UnloadToZeroStress,
    get_preset,
    run_tension,
)

P = STEEL_TEXTBOOK
E = P.young_modulus_mpa
SPEC = Specimen(diameter_mm=10.0, gauge_length_mm=50.0)
EPS = 1e-9
REGIONS = {
    "elastic",
    "elastic_curving",
    "yield_onset",
    "yield_drop",
    "yield_plateau",
    "strain_hardening",
    "necking",
    "unloading",
    "reloading",
    "fractured",
}


def run(*ops: Operation, specimen: Specimen = SPEC) -> TensionResult:
    return run_tension(P, specimen, list(ops))


# ---- the curve against an exact symbolic oracle (independent of presets.py) -------------------
R = sp.Rational


def oracle_stress(e: sp.Rational) -> sp.Expr:
    """Backbone written out from the contract table with exact rationals and sympy's solver."""
    ea, eb = R(230, 200000), R(240, 200000) + R(2, 10**7) * 10**2
    ec, ed, esh, eu, ef = R(14, 10000), R(16, 10000), R(15, 1000), R(15, 100), R(25, 100)
    if e <= ea:
        return 200000 * e
    if e <= eb:
        s = sp.symbols("s", positive=True)
        root = sp.solve(sp.Eq(R(2, 10**7) * s**2 + s / 200000, e - ea), s)
        return 230 + next(r for r in root if r.is_positive)
    if e <= ec:
        return 240 + 25 * (e - eb) / (ec - eb)
    if e <= ed:
        return 265 - 15 * (e - ec) / (ed - ec)
    if e <= esh:
        return sp.Integer(250)
    if e <= eu:
        return 400 - 150 * ((eu - e) / (eu - esh)) ** 2
    return 400 - 100 * ((e - eu) / (ef - eu)) ** 2


@pytest.mark.parametrize(
    "strain",
    [R(k, 100000) for k in (0, 50, 115, 117, 119, 122, 125, 130, 140, 150, 160)]
    + [R(k, 1000) for k in (2, 8, 15, 16, 40, 100)]
    + [R(k, 100) for k in (15, 17, 20, 24, 25)],
)
def test_backbone_matches_the_exact_oracle(strain: sp.Rational) -> None:
    assert P.stress(float(strain)) == pytest.approx(float(oracle_stress(strain)), abs=1e-6)


# ---- the curve is continuous and has the intended landmark values -----------------------------
@pytest.mark.parametrize("name", ["a", "b", "upper_yield", "lower_yield", "hardening", "peak"])
def test_curve_is_continuous_at_every_breakpoint(name: str) -> None:
    point = {
        "a": P.strain_a,
        "b": P.strain_b,
        "upper_yield": P.strain_upper_yield,
        "lower_yield": P.strain_lower_yield,
        "hardening": P.strain_hardening,
        "peak": P.strain_peak,
    }[name]
    left, right = P.stress(point - 1e-10), P.stress(point + 1e-10)
    assert abs(left - right) < 1e-4  # slopes are at most E, so 1e-10 strain moves < 2e-5 MPa


def test_landmarks_sit_on_the_curve_and_have_the_textbook_values() -> None:
    marks = {lm.id: lm for lm in P.landmarks()}
    assert [lm for lm in marks] == list("ABCDEF")
    for lm in marks.values():
        assert P.stress(lm.strain) == pytest.approx(lm.stress_mpa, abs=1e-6)
    assert marks["C"].stress_mpa > marks["D"].stress_mpa  # the upper yield peak and the drop
    assert max(P.stress(e / 10000) for e in range(0, 2500)) == pytest.approx(400.0, abs=1e-6)


def test_the_peak_has_zero_slope_and_the_curve_rises_to_it() -> None:
    h = 1e-7
    assert abs(P.stress(P.strain_peak + h) - P.stress(P.strain_peak - h)) < 1e-6
    rising = [
        P.stress(P.strain_hardening + (P.strain_peak - P.strain_hardening) * i / 50)
        for i in range(51)
    ]
    assert all(b >= a for a, b in pairwise(rising))
    falling = [
        P.stress(P.strain_peak + (P.strain_fracture - P.strain_peak) * i / 50) for i in range(51)
    ]
    assert all(b <= a for a, b in pairwise(falling))


# ---- behaviour --------------------------------------------------------------------------------
def test_unloading_follows_a_line_of_slope_e_and_reloading_returns_to_the_old_maximum() -> None:
    result = run(StrainTo(0.05), UnloadToZeroStress())
    a, b = result.trace[-2], result.trace[-1]
    assert (a.stress_mpa - b.stress_mpa) / (a.strain - b.strain) == pytest.approx(E, rel=1e-9)
    again = run(StrainTo(0.05), UnloadToZeroStress(), StrainTo(0.05))
    assert again.state.stress_mpa == pytest.approx(P.stress(0.05), abs=1e-6)
    assert again.state.region == "strain_hardening"


def test_reloading_below_the_old_maximum_never_exceeds_the_backbone() -> None:
    for to in (0.04842, 0.0490, 0.0498, 0.0500):
        s = run(StrainTo(0.05), UnloadToZeroStress(), StrainTo(to)).state
        assert 0.0 <= s.stress_mpa <= P.stress(0.05) + 1e-6


def test_zero_total_strain_is_not_reachable_after_plastic_stretch() -> None:
    state = run(StrainTo(0.05), StrainTo(0.0)).state
    assert state.stress_mpa == 0.0
    assert state.strain == pytest.approx(state.plastic_strain, abs=1e-12)
    assert state.strain > 0.04


def test_fracture_is_terminal_and_reset_starts_over() -> None:
    result = run(StrainTo(0.25))
    assert result.state.region == "fractured"
    assert result.state.force_kn == 0.0
    with pytest.raises(SpecimenBrokenError):
        run(StrainTo(0.25), StrainTo(0.1))
    with pytest.raises(SpecimenBrokenError):
        run(StrainTo(0.25), UnloadToZeroStress())
    fresh = run(StrainTo(0.25), Reset(), StrainTo(0.001))
    assert fresh.state == run(StrainTo(0.001)).state


def test_landmarks_are_marked_reached_in_order() -> None:
    reached = [lm.reached for lm in run(StrainTo(P.strain_upper_yield)).landmarks]
    assert reached == [True, True, True, False, False, False]
    assert all(lm.reached for lm in run(StrainTo(0.25)).landmarks)
    assert not any(lm.reached for lm in run().landmarks)


def test_repeating_the_same_strain_changes_nothing() -> None:
    once = run(StrainTo(0.05))
    twice = run(StrainTo(0.05), StrainTo(0.05))
    assert once.state == twice.state
    assert once.trace == twice.trace


# ---- the trace --------------------------------------------------------------------------------
def test_loading_trace_is_dense_monotone_and_contains_every_landmark() -> None:
    trace = run(StrainTo(0.25)).trace[:-1]  # without the final elastic drop after the break
    strains = [t.strain for t in trace]
    assert strains == sorted(strains)
    assert max(b - a for a, b in pairwise(strains)) <= 0.004 + 1e-12
    for lm in P.landmarks():
        assert any(
            abs(t.strain - lm.strain) < 1e-12 and abs(t.stress_mpa - lm.stress_mpa) < 1e-6
            for t in trace
        )
    assert all(t.stress_mpa >= 0.0 for t in trace)


def test_stepping_back_inside_the_reversible_zone_retraces_the_curve_not_a_straight_line() -> None:
    result = run(StrainTo(P.strain_b), StrainTo(0.0009))
    back = [t for t in result.trace if t.strain <= P.strain_b + 1e-12]
    down = result.trace[len(result.trace) - 6 :]
    assert len(back) >= 10
    assert [t.strain for t in down] == sorted((t.strain for t in down), reverse=True)
    assert all(t.stress_mpa == pytest.approx(P.stress(t.strain), abs=1e-9) for t in result.trace)
    assert result.state.plastic_strain == 0.0
    assert result.state.region == "elastic"


@pytest.mark.parametrize("to", [0.04845, 0.0487, 0.0492, 0.0498])
def test_reloading_stress_is_e_times_the_elastic_strain(to: float) -> None:
    s = run(StrainTo(0.05), UnloadToZeroStress(), StrainTo(to)).state
    assert s.stress_mpa == pytest.approx(E * (to - s.plastic_strain), abs=1e-6)
    assert s.elastic_strain == pytest.approx(to - s.plastic_strain, abs=1e-12)


# ---- offset proof strength --------------------------------------------------------------------
@pytest.mark.parametrize("offset", [0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.1])
def test_proof_point_is_on_the_curve_and_on_the_offset_line(offset: float) -> None:
    strain, stress = P.proof_point(offset)
    assert stress == pytest.approx(P.stress(strain), abs=1e-9)
    assert stress == pytest.approx(E * (strain - offset), abs=1e-6)


@pytest.mark.parametrize("offset", [0.0005, 0.001, 0.002, 0.005, 0.01, 0.1])
def test_unloading_from_the_proof_point_leaves_exactly_the_offset(offset: float) -> None:
    """Definition: an offset proof strength leaves `offset` of permanent strain."""
    strain, _ = P.proof_point(offset)
    result = run(StrainTo(strain), UnloadToZeroStress())
    assert result.state.plastic_strain == pytest.approx(offset, abs=1e-9)
    assert result.state.strain == pytest.approx(offset, abs=1e-9)
    assert result.state.stress_mpa == pytest.approx(0.0, abs=1e-6)


def test_the_proof_strength_of_this_steel_is_its_lower_yield_on_the_plateau() -> None:
    strain, stress = P.proof_point(0.002)
    assert stress == pytest.approx(250.0, abs=1e-9)
    assert strain == pytest.approx(0.00325, abs=1e-12)
    assert P.strain_lower_yield < strain < P.strain_hardening
    assert run().proof.stress_mpa == pytest.approx(stress)


def test_the_proof_point_matches_an_exact_symbolic_solution() -> None:
    e = sp.symbols("e")
    exact = sp.solve(sp.Eq(250, 200000 * (e - R(2, 1000))), e)[0]  # on the plateau
    assert P.proof_point(0.002)[0] == pytest.approx(float(exact), abs=1e-12)


@pytest.mark.parametrize("offset", [0.0, -0.001, 0.25, 0.3])
def test_a_proof_offset_outside_the_curve_is_rejected(offset: float) -> None:
    with pytest.raises(ValueError, match="proof offset"):
        P.proof_point(offset)


# ---- specimen scaling and errors --------------------------------------------------------------
def test_force_scales_with_area_and_extension_with_gauge_length() -> None:
    big = Specimen(diameter_mm=20.0, gauge_length_mm=100.0)
    a, b = run(StrainTo(0.05)).state, run(StrainTo(0.05), specimen=big).state
    assert b.stress_mpa == a.stress_mpa
    assert b.strain == a.strain
    assert b.force_kn == pytest.approx(4.0 * a.force_kn)
    assert b.extension_mm == pytest.approx(2.0 * a.extension_mm)
    assert SPEC.area_mm2 == pytest.approx(78.53981633974483)


@pytest.mark.parametrize("to", [-0.001, 0.2500001, 0.3, math.nan, math.inf])
def test_out_of_range_strain_is_rejected(to: float) -> None:
    with pytest.raises(StrainOutOfRangeError):
        run(StrainTo(to))


@pytest.mark.parametrize(
    ("diameter", "gauge"), [(0.0, 50.0), (10.0, -1.0), (math.nan, 50.0), (10.0, math.inf)]
)
def test_invalid_specimen_is_rejected(diameter: float, gauge: float) -> None:
    with pytest.raises(InvalidSpecimenError):
        Specimen(diameter_mm=diameter, gauge_length_mm=gauge)


def test_unknown_preset_is_rejected() -> None:
    with pytest.raises(UnknownPresetError):
        get_preset("aluminium")
    assert get_preset("steel_textbook") is STEEL_TEXTBOOK


def test_a_broken_preset_is_caught() -> None:
    from dataclasses import replace

    with pytest.raises(ValueError, match="not a valid curve"):
        replace(STEEL_TEXTBOOK, upper_yield_mpa=200.0).validate()


# ---- invariants over random histories ---------------------------------------------------------
strains = st.floats(min_value=0.0, max_value=0.25, allow_nan=False)
ops = st.one_of(
    strains.map(StrainTo),
    st.just(UnloadToZeroStress()),
)
histories = st.lists(ops, max_size=12)


def safe_run(history: list[Operation]) -> TensionResult | None:
    try:
        return run_tension(P, SPEC, history)
    except SpecimenBrokenError:
        return None


@settings(max_examples=300, deadline=None)
@given(histories)
def test_state_invariants_hold_for_any_history(history: list[Operation]) -> None:
    result = safe_run(history)
    if result is None:
        return
    s = result.state
    assert 0.0 <= s.strain <= P.strain_fracture + 1e-12
    assert -1e-9 <= s.stress_mpa <= P.peak_mpa + 1e-9
    assert s.force_kn == pytest.approx(s.stress_mpa * SPEC.area_mm2 / 1000.0)
    assert s.extension_mm == pytest.approx(s.strain * SPEC.gauge_length_mm)
    assert -1e-12 <= s.plastic_strain <= s.strain + 1e-9
    assert s.elastic_strain >= -1e-9
    assert s.max_strain >= s.strain - 1e-12
    if s.max_strain <= P.strain_b + 1e-12:
        assert s.plastic_strain == 0.0  # up to the elastic limit nothing is permanent
    assert all(t.stress_mpa >= -1e-9 for t in result.trace)
    assert all(-1e-12 <= t.plastic_strain <= t.strain + 1e-9 for t in result.trace)
    assert {t.region for t in result.trace} <= REGIONS
    assert [lm.reached for lm in result.landmarks] == [
        s.max_strain >= lm.strain - 1e-12 for lm in P.landmarks()
    ]


@settings(max_examples=200, deadline=None)
@given(histories)
def test_the_maximum_strain_only_grows_and_replay_is_deterministic(
    history: list[Operation],
) -> None:
    previous = 0.0
    for n in range(len(history) + 1):
        result = safe_run(history[:n])
        if result is None:
            return
        assert result.state.max_strain >= previous - 1e-12
        previous = result.state.max_strain
    assert safe_run(history) == safe_run(list(history))


@settings(max_examples=200, deadline=None)
@given(histories, strains)
def test_after_any_history_unloading_gives_zero_stress_and_the_permanent_strain(
    history: list[Operation], last: float
) -> None:
    result = safe_run([*history, StrainTo(last), UnloadToZeroStress()])
    if result is None:
        return
    s = result.state
    assert s.stress_mpa == pytest.approx(0.0, abs=1e-6)
    assert s.strain == pytest.approx(s.plastic_strain, abs=1e-9)
