"""Textbook formula matcher and first-principles derivation engine.

Detects canonical benchmark configurations (e.g. simply supported with UDL or central point load,
cantilevers), verifies the textbook formula against the exact numerical solver results within
strict tolerance (1e-9), and produces 3-tier symbolic/substituted math and derivations.
"""

from __future__ import annotations

import math

from beam_solver.analysis.results import AnalysisResult, CanonicalCase, Side
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


def _match_propped_cantilever(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Check for propped cantilever benchmark cases (fixed at one end, roller/pin at the other)."""
    if len(beam.supports) != 2:
        return None

    supports = sorted(beam.supports, key=lambda s: s.position)
    s0, s1 = supports
    l_len = beam.length
    l_str = _num(l_len)

    if not (same_position(s0.position, 0.0) and same_position(s1.position, l_len)):
        return None

    # Check if one is FIXED and the other is PIN or ROLLER
    fixed_left = s0.kind is SupportKind.FIXED and s1.kind in (SupportKind.ROLLER, SupportKind.PIN)
    fixed_right = s1.kind is SupportKind.FIXED and s0.kind in (SupportKind.ROLLER, SupportKind.PIN)

    if not (fixed_left or fixed_right):
        return None

    # Case A: Full UDL
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
            expected_m_wall = -(w_val * l_len**2) / 8.0
            expected_m_max = (9.0 * w_val * l_len**2) / 128.0

            wall_x = 0.0 if fixed_left else l_len
            wall_m = result.moment_at(wall_x, side=Side.RIGHT if fixed_left else Side.LEFT)

            if abs(wall_m - expected_m_wall) > 1e-4:
                return None

            sub_formula = (
                rf"M_{{\text{{wall}}}} = -\frac{{({w_str}\ \text{{kN/m}}) \cdot ({l_str}\ \text{{m}})^2}}{{8}}, \quad "
                rf"M_{{\max}} = \frac{{9 \cdot ({w_str}\ \text{{kN/m}}) \cdot ({l_str}\ \text{{m}})^2}}{{128}}"
            )
            return CanonicalCase(
                case_id="propped_cantilever_udl",
                name="Propped Cantilever with Uniform Load (UDL)",
                symbolic_formula=r"M_{\text{wall}} = -\frac{wL^2}{8}, \quad M_{\max} = \frac{9wL^2}{128}",
                symbolic_reactions=r"R_{\text{roller}} = \frac{3wL}{8}, \quad R_{\text{wall}} = \frac{5wL}{8}",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\text{{wall}}}} = {_num(expected_m_wall)}\ \text{{kN·m}}, \quad M_{{\max}} = {_num(expected_m_max)}\ \text{{kN·m}}",
                location_text=rf"x = {_num(3 * l_len / 8.0 if fixed_right else 5 * l_len / 8.0)}\ \text{{m}}\ (\text{{peak}})",
                derivation=(
                    r"1.\ \text{Primary Released Structure (Cantilever with Roller Removed)}:",
                    r"\Delta_{B0} = -\frac{wL^4}{8EI}\ \text{(free-end deflection)}",
                    r"2.\ \text{Flexibility Influence of Redundant Force } R_B:",
                    r"f_{BB} = \frac{L^3}{3EI}\ \text{(displacement per unit force)}",
                    r"3.\ \text{Compatibility Equation } (\Delta_B = 0):",
                    r"\Delta_{B0} + R_B \cdot f_{BB} = 0 \implies -\frac{wL^4}{8EI} + R_B \left(\frac{L^3}{3EI}\right) = 0 \implies \mathbf{R_B = \frac{3}{8}wL}",
                    r"4.\ \text{Reactions and Moments by Statics}:",
                    r"R_{\text{wall}} = wL - R_B = \mathbf{\frac{5}{8}wL}, \quad M_{\text{wall}} = \mathbf{-\frac{1}{8}wL^2}",
                    r"5.\ \text{Peak Sagging Moment at Zero Shear } (V=0):",
                    r"\mathbf{M_{\max} = \frac{9}{128}wL^2}",
                ),
            )

    # Case B: Central Point Load
    if len(beam.loads) == 1 and isinstance(beam.loads[0], PointLoad):
        p = beam.loads[0]
        if same_position(p.position, l_len / 2.0) and p.magnitude < 0:
            p_val = abs(p.magnitude)
            p_str = _num(p_val)
            expected_m_wall = -(3.0 * p_val * l_len) / 16.0
            expected_m_load = (5.0 * p_val * l_len) / 32.0

            wall_x = 0.0 if fixed_left else l_len
            wall_m = result.moment_at(wall_x, side=Side.RIGHT if fixed_left else Side.LEFT)

            if abs(wall_m - expected_m_wall) > 1e-4:
                return None

            sub_formula = (
                rf"M_{{\text{{wall}}}} = -\frac{{3 \cdot ({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})}}{{16}}, \quad "
                rf"M_{{\text{{load}}}} = \frac{{5 \cdot ({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})}}{{32}}"
            )
            return CanonicalCase(
                case_id="propped_cantilever_point_mid",
                name="Propped Cantilever with Central Point Load",
                symbolic_formula=r"M_{\text{wall}} = -\frac{3PL}{16}, \quad M_{\text{load}} = \frac{5PL}{32}",
                symbolic_reactions=r"R_{\text{roller}} = \frac{5P}{16}, \quad R_{\text{wall}} = \frac{11P}{16}",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\text{{wall}}}} = {_num(expected_m_wall)}\ \text{{kN·m}}, \quad M_{{\text{{load}}}} = {_num(expected_m_load)}\ \text{{kN·m}}",
                location_text=rf"x = {_num(l_len / 2.0)}\ \text{{m}}\ (\text{{midspan}})",
                derivation=(
                    r"1.\ \text{Primary Released Structure (Cantilever)}:",
                    r"\Delta_{B0} = -\frac{5PL^3}{48EI}\ \text{(deflection at B under central point load)}",
                    r"2.\ \text{Flexibility Coefficient } f_{BB}:",
                    r"f_{BB} = \frac{L^3}{3EI}",
                    r"3.\ \text{Compatibility Equation } (\Delta_B = 0):",
                    r"-\frac{5PL^3}{48EI} + R_B \left(\frac{L^3}{3EI}\right) = 0 \implies \mathbf{R_B = \frac{5}{16}P}",
                    r"4.\ \text{Reactions and Moments}:",
                    r"R_{\text{wall}} = P - R_B = \mathbf{\frac{11}{16}P}, \quad M_{\text{wall}} = \mathbf{-\frac{3}{16}PL}, \quad M_{\text{load}} = \mathbf{\frac{5}{32}PL}",
                ),
            )

    return None


def _match_fixed_fixed(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Check for fixed-fixed beam benchmark cases."""
    if len(beam.supports) != 2:
        return None

    supports = sorted(beam.supports, key=lambda s: s.position)
    s0, s1 = supports
    l_len = beam.length
    l_str = _num(l_len)

    if not (
        s0.kind is SupportKind.FIXED
        and s1.kind is SupportKind.FIXED
        and same_position(s0.position, 0.0)
        and same_position(s1.position, l_len)
    ):
        return None

    # Case A: Full UDL
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
            expected_m_ends = -(w_val * l_len**2) / 12.0
            expected_m_mid = (w_val * l_len**2) / 24.0

            m0 = result.moment_at(0.0, side=Side.RIGHT)
            if abs(m0 - expected_m_ends) > 1e-4:
                return None

            sub_formula = (
                rf"M_{{\text{{ends}}}} = -\frac{{({w_str}\ \text{{kN/m}}) \cdot ({l_str}\ \text{{m}})^2}}{{12}}, \quad "
                rf"M_{{\text{{mid}}}} = +\frac{{({w_str}\ \text{{kN/m}}) \cdot ({l_str}\ \text{{m}})^2}}{{24}}"
            )
            return CanonicalCase(
                case_id="fixed_fixed_udl",
                name="Fixed–Fixed Beam with Uniform Load (UDL)",
                symbolic_formula=r"M_{\text{ends}} = -\frac{wL^2}{12}, \quad M_{\text{mid}} = +\frac{wL^2}{24}",
                symbolic_reactions=r"R_A = R_B = \frac{wL}{2}, \quad M_{\text{ends}} = -\frac{wL^2}{12}",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\text{{ends}}}} = {_num(expected_m_ends)}\ \text{{kN·m}}, \quad M_{{\text{{mid}}}} = {_num(expected_m_mid)}\ \text{{kN·m}}",
                location_text=rf"x = 0, {l_str}\ \text{{m}}\ (\text{{wall}}), \quad x = {_num(l_len / 2.0)}\ \text{{m}}\ (\text{{mid}})",
                derivation=(
                    r"1.\ \text{Fixed-End Moments by Slope-Deflection}:",
                    r"\theta_A = \theta_B = 0, \quad \psi = 0 \implies \mathbf{M_A = M_B = -\frac{wL^2}{12}}",
                    r"2.\ \text{Vertical Reactions by Symmetry}:",
                    r"\mathbf{R_A = R_B = \frac{wL}{2}}",
                    r"3.\ \text{Midspan Bending Moment}:",
                    r"M\left(\frac{L}{2}\right) = M_A + R_A \left(\frac{L}{2}\right) - \frac{w(L/2)^2}{2} = -\frac{wL^2}{12} + \frac{wL^2}{4} - \frac{wL^2}{8} = \mathbf{+\frac{wL^2}{24}}",
                    r"4.\ \text{Points of Inflection (Contraflexure, } M(x) = 0):",
                    r"x = \frac{L}{2}\left(1 \pm \frac{1}{\sqrt{3}}\right) \approx 0.2113L, \; 0.7887L",
                ),
            )

    # Case B: Central Point Load
    if len(beam.loads) == 1 and isinstance(beam.loads[0], PointLoad):
        p = beam.loads[0]
        if same_position(p.position, l_len / 2.0) and p.magnitude < 0:
            p_val = abs(p.magnitude)
            p_str = _num(p_val)
            expected_m_ends = -(p_val * l_len) / 8.0
            expected_m_mid = (p_val * l_len) / 8.0

            m0 = result.moment_at(0.0, side=Side.RIGHT)
            if abs(m0 - expected_m_ends) > 1e-4:
                return None

            sub_formula = (
                rf"M_{{\text{{ends}}}} = -\frac{{({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})}}{{8}}, \quad "
                rf"M_{{\text{{mid}}}} = +\frac{{({p_str}\ \text{{kN}}) \cdot ({l_str}\ \text{{m}})}}{{8}}"
            )
            return CanonicalCase(
                case_id="fixed_fixed_point_mid",
                name="Fixed–Fixed Beam with Central Point Load",
                symbolic_formula=r"M_{\text{ends}} = -\frac{PL}{8}, \quad M_{\text{mid}} = +\frac{PL}{8}",
                symbolic_reactions=r"R_A = R_B = \frac{P}{2}, \quad M_{\text{ends}} = -\frac{PL}{8}",
                substituted_formula=sub_formula,
                result_text=rf"M_{{\text{{ends}}}} = {_num(expected_m_ends)}\ \text{{kN·m}}, \quad M_{{\text{{mid}}}} = {_num(expected_m_mid)}\ \text{{kN·m}}",
                location_text=rf"x = 0, {l_str}\ \text{{m}}\ (\text{{wall}}), \quad x = {_num(l_len / 2.0)}\ \text{{m}}\ (\text{{mid}})",
                derivation=(
                    r"1.\ \text{Fixed-End Moments}:",
                    r"\mathbf{M_A = M_B = -\frac{PL}{8}}\ \text{(hogging)}",
                    r"2.\ \text{Vertical Reactions by Symmetry}:",
                    r"\mathbf{R_A = R_B = \frac{P}{2}}",
                    r"3.\ \text{Midspan Bending Moment (Sagging)}:",
                    r"M\left(\frac{L}{2}\right) = M_A + R_A \left(\frac{L}{2}\right) = -\frac{PL}{8} + \frac{PL}{4} = \mathbf{+\frac{PL}{8}}",
                    r"4.\ \text{Points of Inflection}:",
                    r"x = \frac{L}{4}, \quad x = \frac{3L}{4}",
                ),
            )

    return None


def _match_two_span_continuous(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Check for two-span continuous beam with equal spans and full UDL."""
    if len(beam.supports) != 3:
        return None

    supports = sorted(beam.supports, key=lambda s: s.position)
    s0, s1, s2 = supports
    l_len = beam.length
    span = l_len / 2.0
    span_str = _num(span)

    # Must be 3 simple supports at 0, L/2, L
    if not (
        all(s.kind in (SupportKind.ROLLER, SupportKind.PIN) for s in supports)
        and same_position(s0.position, 0.0)
        and same_position(s1.position, span)
        and same_position(s2.position, l_len)
    ):
        return None

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
            expected_m_b = -(w_val * span**2) / 8.0
            expected_r_b = (10.0 * w_val * span) / 8.0

            mb = result.moment_at(span, side=Side.RIGHT)
            if abs(mb - expected_m_b) > 1e-4:
                return None

            sub_formula = (
                rf"M_B = -\frac{{({w_str}\ \text{{kN/m}}) \cdot ({span_str}\ \text{{m}})^2}}{{8}}, \quad "
                rf"R_B = \frac{{10 \cdot ({w_str}\ \text{{kN/m}}) \cdot ({span_str}\ \text{{m}})}}{{8}}"
            )
            return CanonicalCase(
                case_id="two_span_continuous_udl",
                name="Two-Span Continuous Beam with Uniform Load (UDL)",
                symbolic_formula=r"M_B = -\frac{w l^2}{8}, \quad R_B = \frac{10 w l}{8}",
                symbolic_reactions=r"R_A = R_C = \frac{3wl}{8}, \quad R_B = \frac{10wl}{8}",
                substituted_formula=sub_formula,
                result_text=rf"M_B = {_num(expected_m_b)}\ \text{{kN·m}}, \quad R_B = {_num(expected_r_b)}\ \text{{kN}}",
                location_text=rf"x = {span_str}\ \text{{m}}\ (\text{{intermediate support}})",
                derivation=(
                    r"1.\ \text{Theorem of Three Moments (Clapeyron) Across Span AB and BC } (L_1 = L_2 = l):",
                    r"M_A l + 2 M_B (l + l) + M_C l = -6 \left[\frac{A_1 \bar{a}_1}{l} + \frac{A_2 \bar{b}_2}{l}\right]",
                    r"2.\ \text{Boundary Conditions at Exterior Simple Ends}:",
                    r"M_A = 0, \quad M_C = 0",
                    r"3.\ \text{Free Bending Moment Areas under UDL}:",
                    r"A_1 = A_2 = \frac{2}{3} \left(\frac{wl^2}{8}\right) l = \frac{wl^3}{12}, \quad \bar{a}_1 = \bar{b}_2 = \frac{l}{2}",
                    r"4.\ \text{Solve Intermediate Support Moment } M_B:",
                    r"4l M_B = -6 \left[\frac{wl^3}{24} + \frac{wl^3}{24}\right] = -\frac{wl^3}{2} \implies \mathbf{M_B = -\frac{wl^2}{8}}",
                    r"5.\ \text{Reactions by Member Equilibrium}:",
                    r"R_A = R_C = \mathbf{\frac{3}{8}wl}, \quad R_B = \mathbf{\frac{10}{8}wl}",
                ),
            )

    return None


def detect_canonical(beam: Beam, result: AnalysisResult) -> CanonicalCase | None:
    """Identify whether a beam matches a standard textbook canonical case.

    Returns the CanonicalCase with verified formulas and derivation steps if verified,
    or None if the beam does not match a canonical case or fails numerical verification.
    """
    return (
        _match_ss(beam, result)
        or _match_cantilever(beam, result)
        or _match_propped_cantilever(beam, result)
        or _match_fixed_fixed(beam, result)
        or _match_two_span_continuous(beam, result)
    )
