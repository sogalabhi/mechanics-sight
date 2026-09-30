"""Worked steps: how the reactions and the V(x), M(x) polynomials were obtained (plan.md M6.5).

Every number comes from the same objects the solver used (the equilibrium system, the loads'
section polynomials, the result segments), so the steps cannot disagree with the diagrams.
Math is emitted as LaTeX strings; titles and notes are plain text.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.polynomial import Polynomial

from beam_solver.analysis.analyze import reaction_loads
from beam_solver.analysis.results import AnalysisResult, Segment, Side
from beam_solver.domain import Beam, DistributedLoad, Load, PointLoad, PointMoment
from beam_solver.solvers import EquilibriumSystem

_ZERO_TOL = 5e-4  # below this a value prints as 0 (3 decimals)
MAX_STEP_SEGMENTS = 60  # beyond this the per-segment working is left out
MAX_TERMS = 12  # beyond this many contributions on one segment, they are summed


@dataclass(frozen=True)
class Step:
    kind: str
    group: str  # "reactions" | "diagrams" | "extremes"
    title: str
    symbolic: str | None = None
    substituted: str | None = None
    result: str | None = None
    notes: tuple[str, ...] = ()
    x_start: float | None = None
    x_end: float | None = None
    at: float | None = None


# --- formatting -----------------------------------------------------------------------------


def _num(v: float) -> str:
    r = round(v, 3)
    if r == 0:
        return "0"
    return f"{r:.3f}".rstrip("0").rstrip(".")


def _coef(c: float) -> str:
    """Coefficient magnitude: 3 decimals, or 4 significant figures when below 1."""
    a = abs(c)
    return f"{a:.4g}" if a < 1 else _num(a)


def _paren(s: str) -> str:
    return f"({s})" if s.startswith("-") or " + " in s or " - " in s else s


def _poly(coef: list[float], var: str = "x") -> str:
    """LaTeX for a polynomial with ascending coefficients, highest power first."""
    parts: list[tuple[str, str]] = []
    for k in range(len(coef) - 1, -1, -1):
        c = coef[k]
        if abs(c) < _ZERO_TOL:
            continue
        mag = _coef(c)
        if k == 0:
            body = mag
        else:
            power = var if k == 1 else f"{var}^{{{k}}}"
            body = power if mag == "1" else f"{mag}\\,{power}"
        parts.append(("-" if c < 0 else "+", body))
    if not parts:
        return "0"
    out = ("-" if parts[0][0] == "-" else "") + parts[0][1]
    for sign, body in parts[1:]:
        out += f" {sign} {body}"
    return out


def _to_x(coef_t: tuple[float, ...] | list[float], x_start: float) -> list[float]:
    """Re-express a polynomial in t = x - x_start as a polynomial in x."""
    shift = Polynomial([-x_start, 1.0])
    acc = Polynomial([0.0])
    for c in reversed(list(coef_t)):  # Horner, composing with x - x_start
        acc = acc * shift + float(c)
    return [float(c) for c in acc.coef]


def _kn(v: float) -> str:
    return f"{_num(v)}\\ \\text{{kN}}"


# --- labels ----------------------------------------------------------------------------------


@dataclass(frozen=True)
class _Labels:
    supports: dict[str, str]  # support id -> "A"
    loads: dict[str, str]  # load id -> "P_{1}"

    def of(self, load: Load, kind: str = "shear") -> str:
        if load.id.startswith("reaction-moment:"):
            return f"M_{{{self.supports[load.id.split(':', 1)[1]]}}}"
        if load.id.startswith("reaction:"):
            sup = self.supports[load.id.split(":", 1)[1]]
            return f"R_{{{sup}\\!x}}" if kind == "axial" else f"R_{{{sup}}}"
        return self.loads[load.id]


def _make_labels(beam: Beam) -> _Labels:
    ordered = sorted(beam.supports, key=lambda s: s.position)
    supports = {s.id: chr(ord("A") + i) for i, s in enumerate(ordered)}
    counters = {"P": 0, "C": 0, "W": 0}
    loads: dict[str, str] = {}
    for load in sorted(beam.loads, key=lambda ld: ld.breakpoints()[0]):
        letter = (
            "P" if isinstance(load, PointLoad) else "C" if isinstance(load, PointMoment) else "W"
        )
        counters[letter] += 1
        loads[load.id] = f"{letter}_{{{counters[letter]}}}"
    return _Labels(supports, loads)


def _plain(label: str) -> str:
    return label.replace("_{", "").replace("}", "")


# --- reactions -------------------------------------------------------------------------------


def _setup_steps(beam: Beam, labels: _Labels) -> list[Step]:
    supports_notes = [
        f"{labels.supports[s.id]}: {s.kind.value} support at x = {_num(s.position)} m"
        for s in sorted(beam.supports, key=lambda s: s.position)
    ]
    if beam.hinges:
        supports_notes.extend(
            f"H_{i + 1}: internal hinge at x = {_num(h)} m (bending moment released: M = 0)"
            for i, h in enumerate(beam.hinges)
        )
    steps = [
        Step(
            "supports",
            "reactions",
            "Supports and hinges" if beam.hinges else "Supports",
            notes=tuple(supports_notes),
        )
    ]
    notes: list[str] = []
    for load in sorted(beam.loads, key=lambda ld: ld.breakpoints()[0]):
        name = _plain(labels.loads[load.id])
        if isinstance(load, PointLoad):
            parts = []
            if abs(load.magnitude) > 1e-9:
                way = "up" if load.magnitude > 0 else "down"
                parts.append(f"{_num(abs(load.magnitude))} kN {way}")
            if abs(load.fx) > 1e-9:
                h_way = "right" if load.fx > 0 else "left"
                parts.append(f"{_num(abs(load.fx))} kN {h_way}")
            desc = " and ".join(parts) if parts else "0 kN"
            notes.append(f"{name}: {desc} at x = {_num(load.position)} m")
        elif isinstance(load, PointMoment):
            way = "anticlockwise" if load.magnitude > 0 else "clockwise"
            amount = _num(abs(load.magnitude))
            notes.append(f"{name}: couple {amount} kN·m {way} at x = {_num(load.position)} m")
        elif isinstance(load, DistributedLoad):
            way = "up" if (load.w_start or load.w_end) > 0 else "down"
            w = (
                f"{_num(abs(load.w_start))}"
                if load.w_start == load.w_end
                else f"{_num(abs(load.w_start))} to {_num(abs(load.w_end))}"
            )
            notes.append(
                f"{name}: {w} kN/m {way} from x = {_num(load.start)} m to {_num(load.end)} m"
            )
    if notes:
        steps.append(Step("loads", "reactions", "Applied loads", notes=tuple(notes)))
    return steps


def _resultant_steps(beam: Beam, labels: _Labels) -> list[Step]:
    steps: list[Step] = []
    for load in sorted(
        beam.loads, key=lambda ld: ld.start if isinstance(ld, DistributedLoad) else 0
    ):
        if not isinstance(load, DistributedLoad) or abs(load.resultant()) < 1e-9:
            continue
        w = load.resultant()
        xbar = load.moment_about(0.0) / w
        span = load.length
        w1, w2 = load.w_start, load.w_end
        name = labels.loads[load.id]
        steps.append(
            Step(
                "resultant",
                "reactions",
                f"Replace {_plain(name)} by its resultant",
                symbolic=(
                    r"W = \frac{w_1 + w_2}{2}\,(x_e - x_s),\quad "
                    r"\bar{x} = x_s + \frac{(x_e - x_s)(w_1 + 2 w_2)}{3\,(w_1 + w_2)}"
                ),
                substituted=(
                    f"W = \\frac{{{_paren(_num(w1))} + {_paren(_num(w2))}}}{{2}}"
                    f"\\,({_num(load.end)} - {_num(load.start)}),\\quad "
                    f"\\bar{{x}} = {_num(load.start)} + \\frac{{{_num(span)}"
                    f"\\,({_paren(_num(w1))} + 2\\,{_paren(_num(w2))})}}"
                    f"{{3\\,({_paren(_num(w1))} + {_paren(_num(w2))})}}"
                ),
                result=f"{name} = {_kn(w)},\\quad \\bar{{x}} = {_num(xbar)}\\ \\text{{m}}",
            )
        )
    return steps


def _row_latex(row: np.ndarray, names: list[str], rhs: float) -> str:
    terms: list[str] = []
    for c, n in zip(row, names, strict=True):
        if abs(c) < 1e-9:
            continue
        mag = _num(abs(c))
        body = n if mag == "1" else f"{mag}\\,{n}"
        terms.append(("- " if c < 0 else "+ ") + body)
    lhs = " ".join(terms) or "0"
    lhs = lhs[2:] if lhs.startswith("+ ") else ("-" + lhs[2:] if lhs.startswith("- ") else lhs)
    return f"{lhs} = {_num(rhs)}"


def _reaction_steps(beam: Beam, result: AnalysisResult, labels: _Labels) -> list[Step]:
    system = EquilibriumSystem.from_beam(beam)
    cols = system.bending_columns()
    if not cols:
        return []
    unknowns = [system.unknowns[i] for i in cols]
    names = [
        f"M_{{{labels.supports[u.support_id]}}}"
        if u.direction.name == "ROTATION"
        else f"R_{{{labels.supports[u.support_id]}}}"
        for u in unknowns
    ]
    fy_row, m_row = system.a[1, cols], system.a[2, cols]
    fy_rhs, m_rhs = float(system.b[1]), float(system.b[2])

    forces = [ld for ld in beam.loads if abs(ld.resultant()) > 1e-12]
    couples = [ld for ld in beam.loads if isinstance(ld, PointMoment)]

    def force_term(ld: Load) -> str:
        return _paren(_num(ld.resultant()))

    def moment_term(ld: Load) -> str:
        if isinstance(ld, PointMoment):
            return _paren(_num(ld.magnitude))
        w = ld.resultant()
        return f"{_paren(_num(w))}\\,({_num(ld.moment_about(0.0) / w)})"

    unk_f = " + ".join(n for n, c in zip(names, fy_row, strict=True) if abs(c) > 1e-9)
    unk_m = " + ".join(
        f"{n}" if u.direction.name == "ROTATION" else f"{n}\\,({_num(c)})"
        for n, c, u in zip(names, m_row, unknowns, strict=True)
    )
    load_f_sym = r"\sum F"
    load_m_sym = r"\sum F\,\bar{x} + \sum C"
    sub_f = " + ".join(
        [
            *(
                f"R_{{{labels.supports[u.support_id]}}}"
                for u, c in zip(unknowns, fy_row, strict=True)
                if abs(c) > 1e-9
            ),
            *(force_term(ld) for ld in forces),
        ]
    )
    sub_m = " + ".join(
        [
            *(
                f"R_{{{labels.supports[u.support_id]}}}\\,({_num(u.position)})"
                if u.direction.name == "Y"
                else f"M_{{{labels.supports[u.support_id]}}}"
                for u in unknowns
                if u.direction.name in ("Y", "ROTATION")
            ),
            *(moment_term(ld) for ld in beam.loads if ld in forces or ld in couples),
        ]
    )
    out: list[Step] = []

    axial_cols = system.axial_columns()
    has_axial_loads = any(abs(ld.horizontal_resultant()) > 1e-12 for ld in beam.loads)
    if axial_cols and (has_axial_loads or any(abs(r.fx) > 1e-12 for r in result.reactions)):
        ax_unknowns = [system.unknowns[i] for i in axial_cols]
        ax_names = [f"R_{{{labels.supports[u.support_id]}\\!x}}" for u in ax_unknowns]
        ax_loads = [ld for ld in beam.loads if abs(ld.horizontal_resultant()) > 1e-12]
        unk_ax = " + ".join(ax_names)
        sub_ax = " + ".join(
            [*ax_names, *(_paren(_num(ld.horizontal_resultant())) for ld in ax_loads)]
        )
        out.append(
            Step(
                "force_balance",
                "reactions",
                "Horizontal equilibrium",
                symbolic=f"\\sum F_x = 0:\\quad {unk_ax} + \\sum F_x = 0",
                substituted=f"{sub_ax} = 0",
                result=f"{unk_ax} = {_num(float(system.b[0]))}"
                if len(ax_names) == 1
                else _row_latex(system.a[0, axial_cols], ax_names, float(system.b[0])),
            )
        )

    out.extend(
        [
            Step(
                "force_balance",
                "reactions",
                "Vertical equilibrium",
                symbolic=f"\\sum F_y = 0:\\quad {unk_f} + {load_f_sym} = 0",
                substituted=f"{sub_f} = 0",
                result=_row_latex(fy_row, names, fy_rhs),
            ),
            Step(
                "moment_balance",
                "reactions",
                "Moments about x = 0 (anticlockwise positive)",
                symbolic=f"\\sum M_0 = 0:\\quad {unk_m} + {load_m_sym} = 0",
                substituted=f"{sub_m} = 0",
                result=_row_latex(m_row, names, m_rhs),
            ),
        ]
    )
    for k, h_pos in enumerate(beam.hinges):
        h_row = system.a[3 + k, cols]
        h_rhs = float(system.b[3 + k])
        unk_terms = []
        for n, c, u in zip(names, h_row, unknowns, strict=True):
            if abs(c) > 1e-9:
                if u.direction.name == "ROTATION":
                    unk_terms.append(f"{n}")
                else:
                    unk_terms.append(f"{n}\\,({_num(c)})")
        load_terms = []
        for ld in beam.loads:
            left, _ = ld.split(h_pos)
            if left is not None and abs(left.resultant()) > 1e-12:
                w = left.resultant()
                arm = left.moment_about(h_pos) / w
                load_terms.append(f"{_paren(_num(w))}\\,({_num(arm)})")
            elif left is not None and isinstance(left, PointMoment):
                load_terms.append(_paren(_num(left.magnitude)))
        sub_h = " + ".join(unk_terms + load_terms) or "0"
        out.append(
            Step(
                "moment_balance",
                "reactions",
                f"Internal hinge condition at x = {_num(h_pos)} m (left segment)",
                symbolic=f"\\sum M_{{x={_num(h_pos)}}}^{{-}} = 0",
                substituted=f"{sub_h} = 0",
                result=_row_latex(h_row, names, h_rhs),
                at=h_pos,
            )
        )
    by_name = (
        {(r.support_id, "fy"): r.fy for r in result.reactions}
        | {(r.support_id, "m"): r.moment for r in result.reactions}
        | {(r.support_id, "fx"): r.fx for r in result.reactions}
    )
    all_solved = []
    if axial_cols and (has_axial_loads or any(abs(r.fx) > 1e-12 for r in result.reactions)):
        for u in ax_unknowns:
            all_solved.append(
                f"R_{{{labels.supports[u.support_id]}\\!x}} = "
                f"{_num(by_name[(u.support_id, 'fx')])}\\ \\text{{kN}}"
            )
    for n, u in zip(names, unknowns, strict=True):
        val = by_name[(u.support_id, "m" if u.direction.name == "ROTATION" else "fy")]
        unit = "kN·m" if u.direction.name == "ROTATION" else "kN"
        all_solved.append(f"{n} = {_num(val)}\\ \\text{{{unit}}}")
    solved = ",\\quad ".join(all_solved)
    out.append(Step("reactions", "reactions", "Solve for the reactions", result=solved))
    return out


# --- V(x), M(x) ------------------------------------------------------------------------------


def _sum_of(name: str, terms: list[str]) -> str:
    if not terms:
        return f"{name}(x) = 0"
    if len(terms) > MAX_TERMS:
        return f"{name}(x) = \\text{{sum of the {len(terms)} load contributions to the left}}"
    return f"{name}(x) = " + " + ".join(terms)


def _segment_steps(
    beam: Beam, all_loads: tuple[Load, ...], result: AnalysisResult, labels: _Labels
) -> list[Step]:
    if len(result.segments) > MAX_STEP_SEGMENTS:
        return [
            Step(
                "notice",
                "diagrams",
                "Working for each segment is left out",
                notes=(
                    f"This beam has {len(result.segments)} segments (more than "
                    f"{MAX_STEP_SEGMENTS}), so the V(x) and M(x) working per segment is not "
                    "shown. The exact polynomials are still in the diagrams and the values table.",
                ),
            )
        ]
    steps: list[Step] = []
    has_axial = any(abs(ld.horizontal_resultant()) > 1e-12 for ld in all_loads)
    for seg in result.segments:
        span = f"{_num(seg.x_start)} < x < {_num(seg.x_end)}"
        diagram_kinds = (
            [
                ("axial", "N", r"N(x) = -\sum F_{x,\text{left of the section}}", "axial"),
                ("shear", "V", r"V(x) = \sum F_{\text{left of the section}}", 0),
                ("moment", "M", r"M(x) = -\sum M_{\text{anticlockwise, left of the section}}", 1),
            ]
            if has_axial
            else [
                ("shear", "V", r"V(x) = \sum F_{\text{left of the section}}", 0),
                ("moment", "M", r"M(x) = -\sum M_{\text{anticlockwise, left of the section}}", 1),
            ]
        )
        for kind, name, sym, idx in diagram_kinds:
            terms: list[str] = []
            if kind == "axial":
                for load in all_loads:
                    poly = load.axial_polynomial(seg.x_start)
                    if all(abs(float(c)) < _ZERO_TOL for c in poly.coef):
                        continue
                    coef = _to_x(list(poly.coef), seg.x_start)
                    terms.append(
                        f"\\underbrace{{{_paren(_poly(coef))}}}_{{{labels.of(load, kind='axial')}}}"
                    )
                final = _to_x(seg.axial, seg.x_start)
                title = f"Axial normal force for {span}"
            else:
                for load in all_loads:
                    poly = load.section_polynomials(seg.x_start)[0 if kind == "shear" else 1]
                    if all(abs(float(c)) < _ZERO_TOL for c in poly.coef):
                        continue
                    coef = _to_x(list(poly.coef), seg.x_start)
                    terms.append(f"\\underbrace{{{_paren(_poly(coef))}}}_{{{labels.of(load)}}}")
                final = _to_x(seg.shear if idx == 0 else seg.moment, seg.x_start)
                title = f"{'Shear force' if idx == 0 else 'Bending moment'} for {span}"
            steps.append(
                Step(
                    kind,
                    "diagrams",
                    title,
                    symbolic=sym,
                    substituted=_sum_of(name, terms),
                    result=f"{name}(x) = {_poly(final)}",
                    x_start=seg.x_start,
                    x_end=seg.x_end,
                )
            )
    return steps


def _segment_at(result: AnalysisResult, x: float) -> Segment | None:
    return next((s for s in result.segments if s.x_start - 1e-6 <= x <= s.x_end + 1e-6), None)


def _extreme_steps(result: AnalysisResult) -> list[Step]:
    steps: list[Step] = []
    for z in result.zero_shear_points:
        cp = next((p for p in result.critical_points if abs(p.x - z) <= 1e-6), None)
        if cp is not None and abs(cp.shear_left - cp.shear_right) > 1e-9:
            steps.append(
                Step(
                    "zero_shear",
                    "extremes",
                    f"The shear changes sign at x = {_num(z)} m",
                    substituted=(
                        f"V({_num(z)}^-) = {_num(cp.shear_left)}\\ \\text{{kN}},\\quad "
                        f"V({_num(z)}^+) = {_num(cp.shear_right)}\\ \\text{{kN}}"
                    ),
                    result=f"x = {_num(z)}\\ \\text{{m}}",
                    at=z,
                )
            )
            seg = _segment_at(result, z + 1e-6) or _segment_at(result, z)
        else:
            seg = _segment_at(result, z)
            if seg is None:
                continue
            v = _to_x(seg.shear, seg.x_start)
            steps.append(
                Step(
                    "zero_shear",
                    "extremes",
                    "Where the shear is zero",
                    symbolic=r"V(x) = 0",
                    substituted=f"{_poly(v)} = 0",
                    result=f"x = {_num(z)}\\ \\text{{m}}",
                    at=z,
                )
            )
        if seg is None:
            continue
        m = _to_x(seg.moment, seg.x_start)
        at = f"\\left({_num(z)}\\right)"
        value = result.moment_at(z, side=Side.RIGHT)
        steps.append(
            Step(
                "moment_at",
                "extremes",
                f"Moment at x = {_num(z)} m",
                symbolic=r"M(x)",
                substituted=f"M({_num(z)}) = {_poly(m, at)}",
                result=f"M({_num(z)}) = {_num(value)}\\ \\text{{kN·m}}",
                at=z,
            )
        )
    for title, e, sym, unit in (
        ("Maximum sagging moment", result.max_sagging, "M_{\\max}", "kN·m"),
        ("Maximum hogging moment", result.max_hogging, "M_{\\min}", "kN·m"),
        ("Maximum positive shear", result.max_positive_shear, "V_{\\max}", "kN"),
        ("Maximum negative shear", result.max_negative_shear, "V_{\\min}", "kN"),
    ):
        if e is not None:
            steps.append(
                Step(
                    "extreme",
                    "extremes",
                    title,
                    result=(
                        f"{sym} = {_num(e.value)}\\ \\text{{{unit}}}\\ \\text{{ at }}\\ "
                        f"x = {_num(e.x)}\\ \\text{{m}}"
                    ),
                    at=e.x,
                )
            )
    return steps


def build_steps(beam: Beam, result: AnalysisResult) -> tuple[Step, ...]:
    """Worked steps for an already-analysed beam."""
    labels = _make_labels(beam)
    all_loads = beam.loads + reaction_loads(result.reactions, beam)
    return tuple(
        _setup_steps(beam, labels)
        + _resultant_steps(beam, labels)
        + _reaction_steps(beam, result, labels)
        + _segment_steps(beam, all_loads, result, labels)
        + _extreme_steps(result)
    )
