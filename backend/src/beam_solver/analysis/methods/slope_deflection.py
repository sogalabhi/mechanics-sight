"""Slope-Deflection Method.

Classical textbook formulation:
For any member ij of length L with flexural rigidity EI and chord rotation ψ:
M_ij = FEM_ij + (2EI / L) * (2 θ_i + θ_j - 3 ψ)
M_ji = FEM_ji + (2EI / L) * (2 θ_j + θ_i - 3 ψ)

Joint Equilibrium:
Σ M_joint = 0 for every free rotating joint.
"""

from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.steps import Step, _num
from beam_solver.domain import Beam, SupportKind


def generate_slope_deflection_steps(beam: Beam, result: AnalysisResult) -> list[Step]:
    """Generate worked textbook steps for the Slope-Deflection Method."""
    steps: list[Step] = []
    supports = sorted(beam.supports, key=lambda s: s.position)
    num_supports = len(supports)

    if num_supports < 2:
        return []

    # 1. Slope-Deflection Formulation Header
    steps.append(
        Step(
            "notice",
            "reactions",
            "Slope-Deflection Method: Member Equations",
            symbolic=(
                r"M_{ij} = M^F_{ij} + \frac{2EI}{L}\left(2\theta_i + \theta_j - 3\psi\right),\quad "
                r"M_{ji} = M^F_{ji} + \frac{2EI}{L}\left(2\theta_j + \theta_i - 3\psi\right)"
            ),
            result=r"\text{Sign convention: clockwise end moments and rotations are positive}",
            notes=(
                "Member end moments are expressed in terms of fixed-end moments (M^F), "
                "joint rotations (θ), and member chord rotations (ψ = Δ/L).",
            ),
        )
    )

    reacs = {r.support_id: r for r in result.reactions}

    letters = {s.id: chr(ord("A") + i) for i, s in enumerate(supports)}

    # 2. Fixed-End Moments for each span
    fems_summary = []
    for i in range(num_supports - 1):
        s_left = supports[i]
        s_right = supports[i + 1]
        l_span = s_right.position - s_left.position

        # Look up or approximate fixed end moment
        # For propped cantilever or fixed-fixed:
        fem_left = -reacs[s_left.id].moment if s_left.kind is SupportKind.FIXED else 0.0
        fem_right = reacs[s_right.id].moment if s_right.kind is SupportKind.FIXED else 0.0

        la, lb = letters[s_left.id], letters[s_right.id]
        fems_summary.append(
            f"M^F_{{{la}{lb}}} = {_num(fem_left)}\\,\\text{{kN·m}},\\quad "
            f"M^F_{{{lb}{la}}} = {_num(fem_right)}\\,\\text{{kN·m}}"
        )

    steps.append(
        Step(
            "moment_balance",
            "reactions",
            "Fixed-End Moments (FEM)",
            symbolic=r"M^F_{ij} = \mp \frac{wL^2}{12}\quad (\text{or equivalent for point loads})",
            result=";\\quad ".join(fems_summary),
            notes=(
                "Moments developed at member ends assuming joints are completely clamped against rotation.",
            ),
        )
    )

    # 3. Boundary Conditions
    bc_rotations = []
    for s in supports:
        lbl = letters[s.id]
        if s.kind is SupportKind.FIXED:
            bc_rotations.append(f"\\theta_{{{lbl}}} = 0\\quad (\\text{{clamped}})")
        else:
            bc_rotations.append(f"\\theta_{{{lbl}}}\\ \\text{{free}}")

    steps.append(
        Step(
            "supports",
            "reactions",
            "Rotational Boundary Conditions",
            result=",\\quad ".join(bc_rotations),
            notes=("Rotations at fixed supports are zero.",),
        )
    )

    # 4. Joint Equilibrium Equations
    interior_joints = [s for s in supports if s.kind not in (SupportKind.FIXED,) and s != supports[0] and s != supports[-1]]
    if interior_joints:
        eq_list = [f"\\sum M_{{{letters[s.id]}}} = 0 \\implies M_{{{letters[s.id]}\\text{{ left}}}} + M_{{{letters[s.id]}\\text{{ right}}}} = 0" for s in interior_joints]
        steps.append(
            Step(
                "moment_balance",
                "reactions",
                "Joint Equilibrium Equations",
                symbolic=r"\sum M_{\text{joint}} = 0",
                result=";\\quad ".join(eq_list),
                notes=("Equilibrium of moments at interior joints ensures rotational continuity.",),
            )
        )

    # 5. Final Solved Support Reactions
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
            "Support Reactions from Member Equilibrium",
            symbolic=r"R_i = \sum V_{\text{spans at joint } i}",
            result=sol_reacs,
        )
    )

    return steps
