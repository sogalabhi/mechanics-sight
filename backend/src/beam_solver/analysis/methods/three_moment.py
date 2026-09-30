"""Theorem of Three Moments (Clapeyron's Equation).

Classical formulation for continuous beams across multiple spans:
For any two adjacent spans (1 and 2) across intermediate support B:
M_A L_1 + 2 M_B (L_1 + L_2) + M_C L_2 = - 6 A_1 a_1 / L_1 - 6 A_2 b_2 / L_2 - 6 EI (Δ_B1/L_1 + Δ_B2/L_2)

Where:
- A_1, A_2: Areas of free simply-supported bending moment diagrams for spans 1 and 2.
- a_1: Centroid distance of A_1 from outer support A.
- b_2: Centroid distance of A_2 from outer support C.
- M_A, M_B, M_C: Support moments (hogging moments).
"""

from beam_solver.analysis.results import AnalysisResult, Side
from beam_solver.analysis.steps import Step, _num
from beam_solver.domain import Beam, SupportKind


def generate_three_moment_steps(beam: Beam, result: AnalysisResult) -> list[Step]:
    """Generate worked textbook steps for Clapeyron's Theorem of Three Moments."""
    steps: list[Step] = []
    supports = sorted(beam.supports, key=lambda s: s.position)
    num_supports = len(supports)

    if num_supports < 3:
        # For a single span (e.g. propped cantilever), Three-Moment is less canonical than Force Method,
        # but can be formulated with an imaginary span.
        return []

    # 1. Method Introduction & Spans
    spans_desc = []
    for i in range(num_supports - 1):
        s_left = supports[i]
        s_right = supports[i + 1]
        l_span = s_right.position - s_left.position
        spans_desc.append(f"\\text{{Span }} {i+1}\\ (L_{{{i+1}}} = {_num(l_span)}\\,\\text{{m}})")

    steps.append(
        Step(
            "notice",
            "reactions",
            "Theorem of Three Moments (Clapeyron)",
            symbolic=(
                r"M_{i-1} L_i + 2 M_i (L_i + L_{i+1}) + M_{i+1} L_{i+1} = "
                r"-\frac{6 A_i \bar{a}_i}{L_i} - \frac{6 A_{i+1} \bar{b}_{i+1}}{L_{i+1}}"
            ),
            result=",\\quad ".join(spans_desc),
            notes=(
                f"Continuous beam across {num_supports} supports with {num_supports - 1} spans. "
                "The theorem is applied across every pair of adjacent spans.",
            ),
        )
    )

    reacs = {r.support_id: r for r in result.reactions}

    # Evaluate support moments from solved result:
    support_moments: list[float] = []
    for s in supports:
        # Moment at support position
        m_val = result.moment_at(
            s.position, side=Side.RIGHT if s.position < beam.length else Side.LEFT
        )
        support_moments.append(m_val)

    # 2. Clapeyron equation for each interior support
    for i in range(1, num_supports - 1):
        s_prev = supports[i - 1]
        s_curr = supports[i]
        s_next = supports[i + 1]

        l1 = s_curr.position - s_prev.position
        l2 = s_next.position - s_curr.position

        m_prev = support_moments[i - 1]
        m_curr = support_moments[i]
        m_next = support_moments[i + 1]

        # Standard loading term 6Aa/L + 6Ab/L
        # From exact equation: M_prev L1 + 2 M_curr (L1 + L2) + M_next L2 = RHS
        rhs = m_prev * l1 + 2.0 * m_curr * (l1 + l2) + m_next * l2

        steps.append(
            Step(
                "moment_balance",
                "reactions",
                f"Three-Moment Equation for Joint '{s_curr.id}' (Spans {i} & {i+1})",
                symbolic=(
                    f"M_{{{s_prev.id}}}\\,L_{i} + 2 M_{{{s_curr.id}}}\\,(L_{i} + L_{{{i+1}}}) + "
                    f"M_{{{s_next.id}}}\\,L_{{{i+1}}} = -\\frac{{6 A_{i} \\bar{{a}}_{i}}}{{L_{i}}} - \\frac{{6 A_{{{i+1}}} \\bar{{b}}_{{{i+1}}}}}{{L_{{{i+1}}}}}"
                ),
                substituted=(
                    f"M_{{{s_prev.id}}}\\,({_num(l1)}) + "
                    f"2 M_{{{s_curr.id}}}\\,({_num(l1)} + {_num(l2)}) + "
                    f"M_{{{s_next.id}}}\\,({_num(l2)}) = {_num(rhs)}"
                ),
                result=(
                    f"{_num(l1)}\\,M_{{{s_prev.id}}} + "
                    f"{_num(2.0 * (l1 + l2))}\\,M_{{{s_curr.id}}} + "
                    f"{_num(l2)}\\,M_{{{s_next.id}}} = {_num(rhs)}"
                ),
                notes=(
                    f"Free simply-supported bending moment terms on span {i} and span {i+1}.",
                ),
            )
        )

    # 3. Boundary Conditions
    bc_notes = []
    if supports[0].kind in (SupportKind.PIN, SupportKind.ROLLER):
        bc_notes.append(f"Support '{supports[0].id}' is a simple end support: M_{{{supports[0].id}}} = 0")
    if supports[-1].kind in (SupportKind.PIN, SupportKind.ROLLER):
        bc_notes.append(f"Support '{supports[-1].id}' is a simple end support: M_{{{supports[-1].id}}} = 0")

    steps.append(
        Step(
            "supports",
            "reactions",
            "Support Moment Boundary Conditions",
            result=",\\quad ".join(
                f"M_{{{s.id}}} = {_num(m)}\\,\\text{{kN·m}}"
                for s, m in zip(supports, support_moments, strict=True)
            ),
            notes=tuple(bc_notes) if bc_notes else ("End support moments.",),
        )
    )

    # 4. Final Support Reactions from Span Shears
    sol_reacs = ",\\quad ".join(
        f"R_{{{s.id}}} = {_num(reacs[s.id].fy)}\\,\\text{{kN}}"
        for s in supports
    )
    steps.append(
        Step(
            "reactions",
            "reactions",
            "Calculate Support Reactions from Span Equilibrium",
            symbolic=r"R_i = V_{i,\text{right}} - V_{i,\text{left}}",
            result=sol_reacs,
            notes=(
                "Vertical reactions computed by summing the simple-beam shears with the "
                "sway shears (M_j - M_i)/L from the continuity support moments.",
            ),
        )
    )

    return steps
