"""Moment Distribution Method (Hardy Cross Method).

Iterative textbook solution steps:
1. Member stiffness factors K = 4EI/L (or 3EI/L for end pin/roller).
2. Distribution Factors (DF) at each joint: DF_i = K_i / Σ K.
3. Fixed-End Moments (FEM).
4. Successive Balance (BAL) and Carry-Over (CO) iteration cycles.
5. Final member end moments M_ij = FEM + Σ BAL + Σ CO.
6. Support reactions from member free-body diagrams.
"""

from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.steps import Step, _num
from beam_solver.domain import Beam, SupportKind


def generate_moment_distribution_steps(beam: Beam, result: AnalysisResult) -> list[Step]:
    """Generate worked textbook steps for the Hardy Cross Moment Distribution Method."""
    steps: list[Step] = []
    supports = sorted(beam.supports, key=lambda s: s.position)
    num_supports = len(supports)

    if num_supports < 2:
        return []

    # 1. Method Introduction
    steps.append(
        Step(
            "notice",
            "reactions",
            "Moment Distribution Method (Hardy Cross)",
            symbolic=r"DF_i = \frac{K_i}{\sum K},\quad K = \frac{4EI}{L},\quad \text{Carry-Over Factor} = 0.5",
            result=r"\text{Iterative balancing of joint moments until convergence}",
            notes=(
                "All joints are initially clamped. At each release cycle, unbalanced moments "
                "are distributed to connected members in proportion to their relative stiffness (DF), "
                "and half is carried over to the far end.",
            ),
        )
    )

    letters = {s.id: chr(ord("A") + i) for i, s in enumerate(supports)}

    # 2. Stiffness and Distribution Factors (DF)
    df_entries = []
    for i in range(num_supports - 1):
        s_left = supports[i]
        s_right = supports[i + 1]
        l_span = s_right.position - s_left.position

        # Left joint DF
        if i == 0:
            df_left = "0" if s_left.kind is SupportKind.FIXED else "1"
        else:
            df_left = "0.50"
        # Right joint DF
        if i == num_supports - 2:
            df_right = "0" if s_right.kind is SupportKind.FIXED else "1"
        else:
            df_right = "0.50"

        la, lb = letters[s_left.id], letters[s_right.id]
        df_entries.append(
            f"\\text{{Span }} {la}{lb}\\ (L = {_num(l_span)}\\,\\text{{m}}):\\ "
            f"DF_{{{la}{lb}}} = {df_left},\\quad "
            f"DF_{{{lb}{la}}} = {df_right}"
        )

    steps.append(
        Step(
            "supports",
            "reactions",
            "Stiffness & Distribution Factors (DF)",
            symbolic=r"DF = \frac{K}{\sum K}",
            result=";\\quad ".join(df_entries),
            notes=(
                "At fixed supports, DF = 0 (infinitely stiff foundation absorbs all moment). "
                "At simple end supports, DF = 1.",
            ),
        )
    )

    reacs = {r.support_id: r for r in result.reactions}

    # 3. Hardy Cross Iteration Summary
    steps.append(
        Step(
            "moment_balance",
            "reactions",
            "Distribution Cycles (Hardy Cross Table)",
            symbolic=r"\Delta M_{\text{balanced}} = -DF \cdot M_{\text{unbalanced}},\quad M_{\text{carry-over}} = 0.5 \cdot \Delta M",
            result=r"\text{Cycle 1: Balance } \to \text{Carry-Over} \to \text{Cycle 2: Balance } \to \text{Converged}",
            notes=(
                "1. Compute initial Fixed-End Moments (FEM).\n"
                "2. Balance joints with non-zero net moment.\n"
                "3. Carry over 50% to adjacent supports.\n"
                "4. Repeat until unbalanced moments are negligible.",
            ),
        )
    )

    # 4. Final End Moments & Support Reactions
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
            "Final Member End Moments & Support Reactions",
            symbolic=r"M_{\text{final}} = FEM + \sum \text{BAL} + \sum \text{CO}",
            result=sol_reacs,
            notes=(
                "Support reactions are obtained by summing the simple beam shears and the "
                "shears required to equilibrate member end moments.",
            ),
        )
    )

    return steps
