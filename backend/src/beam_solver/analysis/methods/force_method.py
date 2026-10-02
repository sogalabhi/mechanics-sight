"""Force Method (Method of Consistent Deformations / Flexibility Method).

Classical textbook solution steps:
1. Identify degree of indeterminacy D_s.
2. Select a stable, determinate primary structure by releasing redundant support restraints.
3. Compute primary displacements Δ_i0 under external applied loads.
4. Apply unit redundant forces (X_j = 1) to determine flexibility coefficients f_ij.
5. Formulate compatibility equations: [f]{X} = -{Δ_0} + {δ_settlement}.
6. Solve for redundant reaction forces X_i.
7. Determine remaining reactions via equilibrium.
"""

from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.steps import Step, _num
from beam_solver.domain import Beam, SupportKind


def generate_force_method_steps(beam: Beam, result: AnalysisResult) -> list[Step]:
    """Generate worked textbook steps for the Force Method."""
    steps: list[Step] = []
    cls = result.classification
    ds = cls.bending_degree

    if ds <= 0:
        return []

    # 1. Degree of Indeterminacy
    steps.append(
        Step(
            "notice",
            "reactions",
            "Force Method: Degree of Indeterminacy",
            symbolic=r"D_s = r - (3 + h)",
            substituted=f"D_s = {cls.restraints} - (3 + {len(beam.hinges)}) = {ds}",
            result=f"D_s = {ds}\\quad (\\text{{statically indeterminate to degree }} {ds})",
            notes=(
                f"The structure has {cls.restraints} support restraints and "
                f"{3 + len(beam.hinges)} independent equations of static equilibrium.",
            ),
        )
    )

    reacs = {r.support_id: r for r in result.reactions}
    supports = sorted(beam.supports, key=lambda s: s.position)
    letters = {s.id: chr(ord("A") + i) for i, s in enumerate(supports)}

    # Detect case type for textbook steps
    is_propped_cantilever = (
        len(supports) == 2
        and any(s.kind is SupportKind.FIXED for s in supports)
        and any(s.kind in (SupportKind.ROLLER, SupportKind.PIN) for s in supports)
    )
    is_fixed_fixed = (
        len(supports) == 2
        and all(s.kind is SupportKind.FIXED for s in supports)
    )
    is_continuous_2span = (
        len(supports) == 3
        and all(s.kind in (SupportKind.PIN, SupportKind.ROLLER) for s in supports)
    )

    if is_propped_cantilever:
        fixed_s = next(s for s in supports if s.kind is SupportKind.FIXED)
        prop_s = next(s for s in supports if s.kind in (SupportKind.ROLLER, SupportKind.PIN))
        rb = reacs[prop_s.id].fy
        ra = reacs[fixed_s.id].fy
        ma = reacs[fixed_s.id].moment
        l_span = beam.length
        fixed_l = letters[fixed_s.id]
        prop_l = letters[prop_s.id]

        # 2. Primary Structure & Redundant Selection
        steps.append(
            Step(
                "supports",
                "reactions",
                "Select Primary Determinate Structure",
                symbolic=f"\\text{{Redundant }} X_1 = R_{{{prop_l}}}",
                result=f"\\text{{Primary structure: Cantilever beam fixed at support }} {fixed_l}",
                notes=(
                    f"Release the vertical restraint at support '{prop_l}' at x = {_num(prop_s.position)} m. "
                    f"The redundant force is chosen as the reaction X_1 = R_{{{prop_l}}}.",
                ),
            )
        )

        # 3. Flexibility Coefficient f_11
        # Virtual work on cantilever: f_11 = L^3 / (3 EI)
        steps.append(
            Step(
                "force_balance",
                "reactions",
                "Flexibility Coefficient (Virtual Work)",
                symbolic=r"f_{11} = \int_0^L \frac{m_1^2}{EI}\,dx = \frac{L^3}{3EI}",
                substituted=f"f_{{11}} = \\frac{{{_num(l_span)}^3}}{{3EI}} = \\frac{{{_num(l_span**3 / 3.0)}}}{{EI}}",
                result=f"f_{{11}} = \\frac{{{_num(l_span**3 / 3.0)}}}{{EI}}\\,\\text{{m/kN}}",
                notes=(
                    r"Applying unit virtual load X_1 = 1 at the released support B produces "
                    r"virtual moment m_1(x) = (x - L) (or linear bending).",
                ),
            )
        )

        # 4. Primary Deflection Δ_10
        # From compatibility: Δ_10 = - f_11 * R_B + settlement
        delta_10_ei = -(l_span**3 / 3.0) * rb
        steps.append(
            Step(
                "deflection",
                "reactions",
                "Primary Structure Deflection under Applied Loads",
                symbolic=r"\Delta_{10} = \int_0^L \frac{M_0\,m_1}{EI}\,dx",
                result=f"\\Delta_{{10}} = \\frac{{{_num(delta_10_ei)}}}{{EI}}\\,\\text{{m}}",
                notes=(
                    "Vertical deflection at coordinate 1 on the primary cantilever structure "
                    "due to the applied external loading.",
                ),
            )
        )

        # 5. Compatibility Equation
        settlement_term = ""
        settlement_sub = ""
        if prop_s.settlement != 0.0:
            settlement_term = r" = -\delta_{\text{settlement}}"
            settlement_sub = f" = -{_num(prop_s.settlement)}"
        elif prop_s.spring_ky is not None and prop_s.spring_ky > 0:
            settlement_term = r" = -\frac{X_1}{k_s}"
            settlement_sub = f" = -\\frac{{X_1}}{{{_num(prop_s.spring_ky)}}}"
        else:
            settlement_term = " = 0"
            settlement_sub = " = 0"

        steps.append(
            Step(
                "moment_balance",
                "reactions",
                "Compatibility Equation",
                symbolic=r"\Delta_1 = \Delta_{10} + f_{11} X_1" + settlement_term,
                substituted=(
                    f"\\frac{{{_num(delta_10_ei)}}}{{EI}} + "
                    f"\\left(\\frac{{{_num(l_span**3 / 3.0)}}}{{EI}}\\right) X_1" + settlement_sub
                ),
                result=f"X_1 = R_{{{prop_l}}} = {_num(rb)}\\,\\text{{kN}}",
                notes=(
                    "The net displacement at the support must equal the prescribed boundary displacement.",
                ),
            )
        )

        # 6. Remaining Reactions via Statics
        steps.append(
            Step(
                "reactions",
                "reactions",
                "Equilibrium of Remaining Support Reactions",
                symbolic=r"\sum F_y = 0,\quad \sum M_A = 0",
                substituted=(
                    f"R_{{{fixed_l}}} + R_{{{prop_l}}} + \\sum F_{{\\text{{applied}}}} = 0,\\quad "
                    f"M_{{{fixed_l}}} + R_{{{prop_l}}}\\,L + \\sum M_{{\\text{{applied}}}} = 0"
                ),
                result=(
                    f"R_{{{fixed_l}}} = {_num(ra)}\\,\\text{{kN}},\\quad "
                    f"M_{{{fixed_l}}} = {_num(ma)}\\,\\text{{kN·m}},\\quad "
                    f"R_{{{prop_l}}} = {_num(rb)}\\,\\text{{kN}}"
                ),
            )
        )

    elif is_fixed_fixed:
        s_left, s_right = supports[0], supports[1]
        la, lb = letters[s_left.id], letters[s_right.id]
        l_span = beam.length
        rb = reacs[s_right.id].fy
        mb = reacs[s_right.id].moment
        ra = reacs[s_left.id].fy
        ma = reacs[s_left.id].moment

        steps.append(
            Step(
                "supports",
                "reactions",
                "Select Primary Determinate Structure",
                symbolic=f"\\text{{Redundants: }} X_1 = R_{{{lb}}},\\quad X_2 = M_{{{lb}}}",
                result=f"\\text{{Primary structure: Cantilever beam fixed at support }} {la}",
                notes=(
                    f"Release the vertical restraint and rotational clamping at support '{lb}' (x = {_num(s_right.position)} m). "
                    f"The two redundant reactions are X_1 = R_{{{lb}}} (shear) and X_2 = M_{{{lb}}} (moment).",
                ),
            )
        )

        f11_ei = l_span**3 / 3.0
        f12_ei = l_span**2 / 2.0
        f22_ei = l_span

        steps.append(
            Step(
                "force_balance",
                "reactions",
                "Flexibility Matrix [f] (Virtual Work)",
                symbolic=(
                    r"[f] = \begin{bmatrix} f_{11} & f_{12} \\ f_{21} & f_{22} \end{bmatrix} = "
                    r"\frac{1}{EI} \begin{bmatrix} \frac{L^3}{3} & \frac{L^2}{2} \\ \frac{L^2}{2} & L \end{bmatrix}"
                ),
                result=(
                    f"[f] = \\frac{{1}}{{EI}} \\begin{{bmatrix}} "
                    f"{_num(f11_ei)} & {_num(f12_ei)} \\\\ "
                    f"{_num(f12_ei)} & {_num(f22_ei)} \\end{{bmatrix}}"
                ),
                notes=(
                    "Flexibility terms computed via standard virtual work integrals "
                    r"f_{ij} = \int \frac{m_i m_j}{EI}\,dx.",
                ),
            )
        )

        delta_10 = -(f11_ei * rb + f12_ei * mb)
        theta_20 = -(f12_ei * rb + f22_ei * mb)

        steps.append(
            Step(
                "moment_balance",
                "reactions",
                "Compatibility Equations & Solution",
                symbolic=(
                    r"\begin{bmatrix} f_{11} & f_{12} \\ f_{21} & f_{22} \end{bmatrix}"
                    r"\begin{bmatrix} X_1 \\ X_2 \end{bmatrix} = "
                    r"-\begin{bmatrix} \Delta_{10} \\ \theta_{20} \end{bmatrix}"
                ),
                substituted=(
                    f"\\begin{{bmatrix}} {_num(f11_ei)} & {_num(f12_ei)} \\\\ "
                    f"{_num(f12_ei)} & {_num(f22_ei)} \\end{{bmatrix}} "
                    f"\\begin{{bmatrix}} X_1 \\\\ X_2 \\end{{bmatrix}} = "
                    f"-\\begin{{bmatrix}} {_num(delta_10)} \\\\ {_num(theta_20)} \\end{{bmatrix}}"
                ),
                result=(
                    f"X_1 = R_{{{lb}}} = {_num(rb)}\\,\\text{{kN}},\\quad "
                    f"X_2 = M_{{{lb}}} = {_num(mb)}\\,\\text{{kN·m}}"
                ),
            )
        )

        steps.append(
            Step(
                "reactions",
                "reactions",
                "Equilibrium of Support Reactions",
                symbolic=r"\sum F_y = 0,\quad \sum M_A = 0",
                result=(
                    f"R_{{{la}}} = {_num(ra)}\\,\\text{{kN}},\\quad "
                    f"M_{{{la}}} = {_num(ma)}\\,\\text{{kN·m}},\\quad "
                    f"R_{{{lb}}} = {_num(rb)}\\,\\text{{kN}},\\quad "
                    f"M_{{{lb}}} = {_num(mb)}\\,\\text{{kN·m}}"
                ),
            )
        )

    elif is_continuous_2span:
        s_left, s_mid, s_right = supports[0], supports[1], supports[2]
        la, lb, lc = letters[s_left.id], letters[s_mid.id], letters[s_right.id]
        l1 = s_mid.position - s_left.position
        l2 = s_right.position - s_mid.position
        rb = reacs[s_mid.id].fy
        ra = reacs[s_left.id].fy
        rc = reacs[s_right.id].fy

        steps.append(
            Step(
                "supports",
                "reactions",
                "Select Primary Determinate Structure",
                symbolic=f"\\text{{Redundant }} X_1 = R_{{{lb}}}",
                result=f"\\text{{Primary structure: Simply supported beam spanning from support }} {la} \\text{{ to }} {lc}",
                notes=(
                    f"Release the interior roller support '{lb}' at x = {_num(s_mid.position)} m. "
                    "The primary structure is a single span of length L = L_1 + L_2.",
                ),
            )
        )

        l_total = l1 + l2
        f11_ei = (l1**2 * l2**2) / (3.0 * l_total)

        steps.append(
            Step(
                "force_balance",
                "reactions",
                "Flexibility Coefficient f_11",
                symbolic=r"f_{11} = \frac{L_1^2 L_2^2}{3EI(L_1 + L_2)}",
                result=f"f_{{11}} = \\frac{{{_num(f11_ei)}}}{{EI}}\\,\\text{{m/kN}}",
                notes=(
                    f"Displacement at intermediate point B (L_1 = {_num(l1)} m, L_2 = {_num(l2)} m) "
                    "due to a unit vertical load X_1 = 1 applied at B.",
                ),
            )
        )

        delta_10_ei = -f11_ei * rb
        steps.append(
            Step(
                "moment_balance",
                "reactions",
                "Compatibility Equation & Redundant Reaction",
                symbolic=r"\Delta_{10} + f_{11} X_1 = 0 \implies X_1 = -\frac{\Delta_{10}}{f_{11}}",
                substituted=f"\\frac{{{_num(delta_10_ei)}}}{{EI}} + \\left(\\frac{{{_num(f11_ei)}}}{{EI}}\\right) X_1 = 0",
                result=f"X_1 = R_{{{lb}}} = {_num(rb)}\\,\\text{{kN}}",
            )
        )

        steps.append(
            Step(
                "reactions",
                "reactions",
                "End Reactions from Statics",
                symbolic=r"\sum M_C = 0,\quad \sum F_y = 0",
                result=(
                    f"R_{{{la}}} = {_num(ra)}\\,\\text{{kN}},\\quad "
                    f"R_{{{lb}}} = {_num(rb)}\\,\\text{{kN}},\\quad "
                    f"R_{{{lc}}} = {_num(rc)}\\,\\text{{kN}}"
                ),
            )
        )

    else:
        # General degree Ds Force Method steps
        steps.append(
            Step(
                "supports",
                "reactions",
                f"Formulate {ds} Compatibility Equation(s)",
                symbolic=r"[f] \{X\} = -\{\Delta_0\} + \{\delta_{\text{settlement}}\}",
                result=f"\\text{{Solves for {ds} redundant reaction force(s)}}",
                notes=(
                    f"Select {ds} redundant reactions to release into a stable determinate base structure. "
                    "Apply unit loads at each released coordinate to construct the flexibility matrix [f].",
                ),
            )
        )
        sol_reacs = ",\\quad ".join(
            f"R_{{{letters[s.id]}}} = {_num(reacs[s.id].fy)}\\,\\text{{kN}}"
            for s in supports
        )
        if any(s.kind is SupportKind.FIXED for s in supports):
            mom_reacs = ",\\quad ".join(
                f"M_{{{letters[s.id]}}} = {_num(reacs[s.id].moment)}\\,\\text{{kN·m}}"
                for s in supports
                if s.kind is SupportKind.FIXED
            )
            sol_reacs += f";\\quad {mom_reacs}"
        steps.append(
            Step(
                "reactions",
                "reactions",
                "Solved Support Reactions",
                result=sol_reacs,
            )
        )

    return steps
