"""Textbook formula matcher and first-principles derivation engine.

Detects canonical benchmark configurations (e.g. simply supported with UDL or central point load,
cantilevers), verifies the textbook formula against the exact numerical solver results within
strict tolerance (1e-9), and produces 3-tier symbolic/substituted math and derivations.
"""

from __future__ import annotations

import math

from beam_solver.analysis.results import AnalysisResult, CanonicalCase
from beam_solver.domain import Beam, DistributedLoad, PointLoad, SupportKind
from beam_solver.tolerances import POSITION_TOL, same_position


def _num(v: float) -> str:
    """Format a number cleanly for LaTeX (up to 3 decimals, no trailing zeros)."""
    r = round(v, 3)
    if r == 0:
        return "0"
    return f"{r:.3f}".rstrip("0").rstrip(".")


def _match_ss_udl(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    l_len = beam.length
    l_str = _num(l_len)

    if not (len(beam.loads) == 1 and isinstance(beam.loads[0], DistributedLoad)):
        return None

    d = beam.loads[0]
    if not (same_position(d.start, 0.0) and same_position(d.end, l_len)):
        return None

    # Case 1: Uniform Distributed Load (UDL)
    if same_position(d.w_start, d.w_end):
        w = d.w_start
        if w >= 0:
            return None
        w_val = abs(w)
        w_str = _num(w_val)
        expected_m = (w_val * l_len**2) / 8.0

        if result.max_sagging is None or abs(result.max_sagging.value - expected_m) > 1e-9:
            return None

        sub_formula = (
            rf"M_{{\max}} = \frac{{({w_str}\ \text{{kN/m}}) \cdot ({l_str}\ \text{{m}})^2}}{{8}}"
        )
        return CanonicalCase(
            case_id="ss_full_udl",
            name="Simply Supported Beam with Uniform Load (UDL)",
            symbolic_formula=r"M_{\max} = \frac{wL^2}{8}",
            symbolic_reactions=r"R_A = R_B = \frac{wL}{2}",
            substituted_formula=sub_formula,
            result_text=rf"M_{{\max}} = {_num(expected_m)}\ \text{{kN·m}}",
            location_text=rf"x = {_num(l_len / 2.0)}\ \text{{m}}\ (\text{{midspan}})",
            derivation=(
                r"1.\ \text{Support Reactions by Equilibrium}:",
                (
                    r"\Sigma M_A = 0 \implies R_B \cdot L - (wL)\left(\frac{L}{2}\right) = 0"
                    r" \implies R_B = \frac{wL}{2}, \quad R_A = \frac{wL}{2}"
                ),
                r"2.\ \text{Bending Moment Function } M(x) \text{ for a cut at } x:",
                r"M(x) = R_A x - w x \left(\frac{x}{2}\right) = \frac{wLx}{2} - \frac{wx^2}{2}",
                (
                    r"3.\ \text{Find Location of Maximum Moment } "
                    r"\left(\frac{dM}{dx} = V(x) = 0\right):"
                ),
                r"\frac{dM}{dx} = V(x) = \frac{wL}{2} - wx = 0 \implies x = \frac{L}{2}",
                r"4.\ \text{Substitute } x = \frac{L}{2} \text{ into } M(x):",
                (
                    r"M\left(\frac{L}{2}\right) = \frac{wL}{2}\left(\frac{L}{2}\right) "
                    r"- \frac{w}{2}\left(\frac{L}{2}\right)^2 = \mathbf{\frac{wL^2}{8}}"
                ),
            ),
        )

    # Case 2: Triangular Load from 0 to w0
    if same_position(d.w_start, 0.0) and d.w_end < 0:
        w0 = abs(d.w_end)
        w0_str = _num(w0)
        expected_m = (w0 * l_len**2) / (9.0 * math.sqrt(3))
        expected_x = l_len / math.sqrt(3)

        if result.max_sagging is None or abs(result.max_sagging.value - expected_m) > 1e-6:
            return None

        sub_formula = (
            rf"M_{{\max}} = \frac{{({w0_str}\ \text{{kN/m}}) \cdot ({l_str}\ \text{{m}})^2}}"
            r"{9\sqrt{3}}"
        )
        return CanonicalCase(
            case_id="ss_triangular",
            name="Simply Supported Beam with Triangular Load",
            symbolic_formula=r"M_{\max} = \frac{w_0 L^2}{9\sqrt{3}} \approx 0.06415\, w_0 L^2",
            symbolic_reactions=r"R_A = \frac{w_0 L}{6}, \quad R_B = \frac{w_0 L}{3}",
            substituted_formula=sub_formula,
            result_text=rf"M_{{\max}} = {_num(expected_m)}\ \text{{kN·m}}",
            location_text=rf"x = \frac{{L}}{{\sqrt{{3}}}} \approx {_num(expected_x)}\ \text{{m}}",
            derivation=(
                r"1.\ \text{Total Load Resultant and Line of Action}:",
                r"W = \frac{1}{2} w_0 L \quad \text{acting at } \bar{x} = \frac{2}{3}L",
                r"2.\ \text{Support Reactions by Equilibrium}:",
                (
                    r"\Sigma M_A = 0 \implies R_B \cdot L - \left(\frac{1}{2}w_0 L\right)"
                    r"\left(\frac{2}{3}L\right) = 0 \implies R_B = \frac{w_0 L}{3}, \quad "
                    r"R_A = \frac{w_0 L}{6}"
                ),
                r"3.\ \text{Shear Function and Zero-Shear Root}:",
                (
                    r"V(x) = R_A - \frac{w_0}{2L}x^2 = \frac{w_0 L}{6} - \frac{w_0}{2L}x^2 = 0"
                    r" \implies x = \frac{L}{\sqrt{3}}"
                ),
                r"4.\ \text{Evaluate Moment at Zero Shear } \left(x = \frac{L}{\sqrt{3}}\right):",
                (
                    r"M\left(\frac{L}{\sqrt{3}}\right) = \left(\frac{w_0 L}{6}\right)"
                    r"\left(\frac{L}{\sqrt{3}}\right) - \frac{w_0}{6L}"
                    r"\left(\frac{L}{\sqrt{3}}\right)^3 = \mathbf{\frac{w_0 L^2}{9\sqrt{3}}}"
                ),
            ),
        )

    return None


def _match_ss_point(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    l_len = beam.length
    l_str = _num(l_len)

    if not (len(beam.loads) == 1 and isinstance(beam.loads[0], PointLoad)):
        return None

    p = beam.loads[0]
    if p.magnitude >= 0:
        return None
    p_val = abs(p.magnitude)
    p_str = _num(p_val)
    a_pos = p.position

    # Midspan Point Load
    if same_position(a_pos, l_len / 2.0):
        expected_m = (p_val * l_len) / 4.0
        if result.max_sagging is None or abs(result.max_sagging.value - expected_m) > 1e-9:
            return None

        sub_formula = (
            rf"M_{{\max}} = \frac{{({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})}}{{4}}"
        )
        return CanonicalCase(
            case_id="ss_midspan_point",
            name="Simply Supported Beam with Midspan Point Load",
            symbolic_formula=r"M_{\max} = \frac{PL}{4}",
            symbolic_reactions=r"R_A = R_B = \frac{P}{2}",
            substituted_formula=sub_formula,
            result_text=rf"M_{{\max}} = {_num(expected_m)}\ \text{{kN·m}}",
            location_text=rf"x = {_num(l_len / 2.0)}\ \text{{m}}\ (\text{{midspan}})",
            derivation=(
                r"1.\ \text{Support Reactions by Symmetry}:",
                r"R_A = R_B = \frac{P}{2}",
                r"2.\ \text{Moment Equation for Left Half } \left(0 \le x \le \frac{L}{2}\right):",
                r"M(x) = R_A x = \frac{P}{2}x",
                (
                    r"3.\ \text{Maximum Moment at the Midspan Load } "
                    r"\left(x = \frac{L}{2}\right):"
                ),
                (
                    r"M\left(\frac{L}{2}\right) = \frac{P}{2}\left(\frac{L}{2}\right) "
                    r"= \mathbf{\frac{PL}{4}}"
                ),
            ),
        )

    # General Point Load at distance a, b
    if POSITION_TOL < a_pos < l_len - POSITION_TOL:
        b_dist = l_len - a_pos
        a_str, b_str = _num(a_pos), _num(b_dist)
        expected_m = (p_val * a_pos * b_dist) / l_len
        if result.max_sagging is None or abs(result.max_sagging.value - expected_m) > 1e-9:
            return None

        sub_formula = (
            rf"M_{{\max}} = \frac{{({p_str}\ \text{{kN}}) \cdot ({a_str}\ \text{{m}}) \cdot "
            rf"({b_str}\ \text{{m}})}}{{{l_str}\ \text{{m}}}}"
        )
        return CanonicalCase(
            case_id="ss_point_ab",
            name="Simply Supported Beam with Point Load",
            symbolic_formula=r"M_{\max} = \frac{Pab}{L}",
            symbolic_reactions=r"R_A = \frac{Pb}{L}, \quad R_B = \frac{Pa}{L}",
            substituted_formula=sub_formula,
            result_text=rf"M_{{\max}} = {_num(expected_m)}\ \text{{kN·m}}",
            location_text=rf"x = {a_str}\ \text{{m}}",
            derivation=(
                r"1.\ \text{Support Reactions by Moment Equilibrium}:",
                (
                    r"\Sigma M_A = 0 \implies R_B \cdot L - P a = 0 \implies "
                    r"R_B = \frac{Pa}{L}, \quad R_A = \frac{Pb}{L}"
                ),
                r"2.\ \text{Bending Moment Function to the Left of the Load } (x \le a):",
                r"M(x) = R_A x = \left(\frac{Pb}{L}\right)x",
                r"3.\ \text{Maximum Moment at the Applied Load } (x = a):",
                r"M(a) = \left(\frac{Pb}{L}\right)a = \mathbf{\frac{Pab}{L}}",
            ),
        )

    return None


def _match_ss(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Check for simply supported beam benchmark cases."""
    if len(beam.supports) != 2:
        return None

    s1, s2 = beam.supports
    if s1.kind is SupportKind.FIXED or s2.kind is SupportKind.FIXED:
        return None

    at_ends = (same_position(s1.position, 0.0) and same_position(s2.position, beam.length)) or (
        same_position(s2.position, 0.0) and same_position(s1.position, beam.length)
    )
    if not at_ends:
        return None

    return _match_ss_udl(beam, result) or _match_ss_point(beam, result)


def _match_cantilever_left(
    beam: Beam, result: AnalysisResult, l_len: float, l_str: str
) -> CanonicalCase | None:
    # Full UDL over [0, L]
    if len(beam.loads) == 1 and isinstance(beam.loads[0], DistributedLoad):
        d = beam.loads[0]
        if (
            same_position(d.start, 0.0)
            and same_position(d.end, l_len)
            and same_position(d.w_start, d.w_end)
            and d.w_start < 0
        ):
            w_val = abs(d.w_start)
            w_str = _num(w_val)
            expected_m = -(w_val * l_len**2) / 2.0
            if result.max_hogging is None or abs(result.max_hogging.value - expected_m) > 1e-9:
                return None

            sub_formula = (
                rf"M_{{\min}} = -\frac{{({w_str}\ \text{{kN/m}}) \cdot "
                rf"({l_str}\ \text{{m}})^2}}{{2}}"
            )
            return CanonicalCase(
                case_id="cantilever_full_udl",
                name="Cantilever Beam with Uniform Load (UDL)",
                symbolic_formula=(
                    r"M_{\min} = -\frac{wL^2}{2}\ \text{(hogging)},\quad "
                    r"M_{\text{wall}} = +\frac{wL^2}{2}"
                ),
                symbolic_reactions=r"R_y = wL, \quad M_{\text{wall}} = \frac{wL^2}{2}",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\min}} = {_num(expected_m)}\ \text{{kN·m}}",
                location_text=r"x = 0\ \text{m}\ (\text{at fixed wall})",
                derivation=(
                    r"1.\ \text{Reactions at the Clamped Support } (x = 0):",
                    r"\Sigma F_y = 0 \implies R_y = wL",
                    (
                        r"\Sigma M_{\text{wall}} = 0 \implies M_{\text{wall}} - "
                        r"(wL)\left(\frac{L}{2}\right) = 0 \implies "
                        r"M_{\text{wall}} = +\frac{wL^2}{2}\ \text{(anticlockwise)}"
                    ),
                    r"2.\ \text{Internal Bending Moment at the Fixed End } (x = 0^+):",
                    r"M(0^+) = -M_{\text{wall}} = \mathbf{-\frac{wL^2}{2}}\ \text{(hogging)}",
                ),
            )

    # Concentrated point load at free end (x = L)
    if len(beam.loads) == 1 and isinstance(beam.loads[0], PointLoad):
        p = beam.loads[0]
        if same_position(p.position, l_len) and p.magnitude < 0:
            p_val = abs(p.magnitude)
            p_str = _num(p_val)
            expected_m = -p_val * l_len
            if result.max_hogging is None or abs(result.max_hogging.value - expected_m) > 1e-9:
                return None

            sub_formula = rf"M_{{\min}} = -({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})"
            return CanonicalCase(
                case_id="cantilever_end_point",
                name="Cantilever Beam with End Point Load",
                symbolic_formula=r"M_{\min} = -PL\ \text{(hogging)},\quad M_{\text{wall}} = +PL",
                symbolic_reactions=r"R_y = P, \quad M_{\text{wall}} = PL",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\min}} = {_num(expected_m)}\ \text{{kN·m}}",
                location_text=r"x = 0\ \text{m}\ (\text{at fixed wall})",
                derivation=(
                    r"1.\ \text{Reactions at the Clamped Support } (x = 0):",
                    r"\Sigma F_y = 0 \implies R_y = P",
                    (
                        r"\Sigma M_{\text{wall}} = 0 \implies M_{\text{wall}} - P \cdot L = 0 "
                        r"\implies M_{\text{wall}} = +PL\ \text{(anticlockwise)}"
                    ),
                    r"2.\ \text{Internal Moment at the Fixed End } (x = 0^+):",
                    r"M(0^+) = -M_{\text{wall}} = \mathbf{-PL}\ \text{(hogging)}",
                ),
            )

    return None


def _match_cantilever(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Check for cantilever beam benchmark cases."""
    if len(beam.supports) != 1:
        return None

    sup = beam.supports[0]
    if sup.kind is not SupportKind.FIXED:
        return None

    l_len = beam.length
    l_str = _num(l_len)

    if same_position(sup.position, 0.0):
        return _match_cantilever_left(beam, result, l_len, l_str)

    if (
        same_position(sup.position, l_len)
        and len(beam.loads) == 1
        and isinstance(beam.loads[0], PointLoad)
    ):
        p = beam.loads[0]
        if same_position(p.position, 0.0) and p.magnitude < 0:
            p_val = abs(p.magnitude)
            p_str = _num(p_val)
            expected_m = -p_val * l_len
            if result.max_hogging is None or abs(result.max_hogging.value - expected_m) > 1e-9:
                return None

            sub_formula = rf"M_{{\min}} = -({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})"
            return CanonicalCase(
                case_id="cantilever_end_point",
                name="Cantilever Beam with End Point Load",
                symbolic_formula=r"M_{\min} = -PL\ \text{(hogging)}",
                symbolic_reactions=r"R_y = P, \quad M_{\text{wall}} = -PL",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\min}} = {_num(expected_m)}\ \text{{kN·m}}",
                location_text=rf"x = {l_str}\ \text{{m}}\ (\text{{at fixed wall}})",
                derivation=(
                    r"1.\ \text{Reactions at the Clamped Support } (x = L):",
                    r"\Sigma F_y = 0 \implies R_y = P",
                    (
                        r"\Sigma M_{\text{wall}} = 0 \implies M_{\text{wall}} + P \cdot L = 0 "
                        r"\implies M_{\text{wall}} = -PL"
                    ),
                    r"2.\ \text{Internal Moment at Fixed End } (x = L^-):",
                    r"M(L^-) = \mathbf{-PL}\ \text{(hogging)}",
                ),
            )

    return None


def detect_canonical(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Identify whether a beam matches a standard textbook canonical case.

    Returns the CanonicalCase with verified formulas and derivation steps if verified,
    or None if the beam does not match a canonical case or fails numerical verification.
    """
    return _match_ss(beam, result) or _match_cantilever(beam, result)
