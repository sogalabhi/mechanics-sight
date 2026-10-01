"""Direct Stiffness Method (1D Matrix Structural Analysis / FEM).

Matrix FEM solution steps:
1. Discretization into nodes and degrees of freedom (DOFs: v, θ, u).
2. Element stiffness matrices k^e in local/global coordinates.
3. Work-equivalent nodal forces for distributed loads (Hermite shape functions).
4. Assembly into global stiffness matrix K and global force vector F.
5. Boundary condition partitioning: K_ff U_f = F_f - K_fp U_p.
6. Displacement solution U and support reaction recovery R = K_pf U_f + K_pp U_p - F_p.
"""

from beam_solver.analysis.results import AnalysisResult
from beam_solver.analysis.steps import Step, _num
from beam_solver.domain import Beam, SupportKind


def generate_direct_stiffness_steps(beam: Beam, result: AnalysisResult) -> list[Step]:
    """Generate worked steps for the Direct Stiffness (Matrix FEM) Method."""
    steps: list[Step] = []
    supports = sorted(beam.supports, key=lambda s: s.position)

    # 1. Formulation & Element Stiffness
    steps.append(
        Step(
            "notice",
            "reactions",
            "Direct Stiffness Method: 1D Beam Element Formulation",
            symbolic=(
                r"k^e = \begin{bmatrix} "
                r"\frac{12EI}{L^3} & \frac{6EI}{L^2} & -\frac{12EI}{L^3} & \frac{6EI}{L^2} \\ "
                r"\frac{6EI}{L^2} & \frac{4EI}{L} & -\frac{6EI}{L^2} & \frac{2EI}{L} \\ "
                r"-\frac{12EI}{L^3} & -\frac{6EI}{L^2} & \frac{12EI}{L^3} & -\frac{6EI}{L^2} \\ "
                r"\frac{6EI}{L^2} & \frac{2EI}{L} & -\frac{6EI}{L^2} & \frac{4EI}{L} "
                r"\end{bmatrix}"
            ),
            result=r"\text{Exact cubic Hermite shape function formulation for Euler--Bernoulli beams}",
            notes=(
                "Each element possesses 2 nodes and 4 degrees of freedom: "
                r"transverse displacements (v_1, v_2) and rotations (\theta_1, \theta_2).",
            ),
        )
    )

    # 2. Equivalent Nodal Loads
    steps.append(
        Step(
            "loads",
            "reactions",
            "Work-Equivalent Nodal Loads",
            symbolic=(
                r"\mathbf{F}^{\text{equiv}} = \int_0^L \mathbf{N}(x)^T w(x)\,dx:\quad "
                r"f_v = \frac{wL}{2},\quad f_\theta = \pm \frac{wL^2}{12}"
            ),
            result=r"\text{Transforms span loads into work-conjugate nodal actions}",
            notes=(
                "Distributed loads are integrated against cubic shape functions N_i(x) to yield "
                "exact nodal forces and fixed-end moments.",
            ),
        )
    )

    # 3. Partitioned System & Boundary Conditions
    steps.append(
        Step(
            "moment_balance",
            "reactions",
            "Global Assembly & Partitioned Matrix Solution",
            symbolic=(
                r"\begin{bmatrix} \mathbf{K}_{ff} & \mathbf{K}_{fp} \\ \mathbf{K}_{pf} & \mathbf{K}_{pp} \end{bmatrix} "
                r"\begin{bmatrix} \mathbf{U}_f \\ \mathbf{U}_p \end{bmatrix} = "
                r"\begin{bmatrix} \mathbf{F}_f \\ \mathbf{F}_p + \mathbf{R}_p \end{bmatrix}"
            ),
            result=r"\mathbf{U}_f = \mathbf{K}_{ff}^{-1}\left(\mathbf{F}_f - \mathbf{K}_{fp} \mathbf{U}_p\right)",
            notes=(
                "DOFs are partitioned into free (f) and prescribed (p) coordinates. "
                "Prescribed displacements incorporate support settlements and spring supports.",
            ),
        )
    )

    # 4. Solved Reactions
    letters = {s.id: chr(ord("A") + i) for i, s in enumerate(supports)}
    reacs = {r.support_id: r for r in result.reactions}
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
            "Support Reaction Recovery",
            symbolic=r"\mathbf{R}_p = \mathbf{K}_{pf} \mathbf{U}_f + \mathbf{K}_{pp} \mathbf{U}_p - \mathbf{F}_p",
            result=sol_reacs,
            notes=(
                "Exact support reactions extracted from the global equilibrium equations.",
            ),
        )
    )

    return steps
