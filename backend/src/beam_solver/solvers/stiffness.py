"""1D Direct Stiffness Method (FEM) solver for indeterminate beams.

Euler--Bernoulli beam elements with exact cubic Hermite interpolation for bending
and linear elements for axial deformation.
"""


import numpy as np

from beam_solver.domain import (
    Beam,
    DistributedLoad,
    PointLoad,
    PointMoment,
    SupportKind,
)
from beam_solver.errors import SolverConsistencyError, UnstableBeamError
from beam_solver.solvers.classification import Classification
from beam_solver.solvers.reactions import Reaction, ReactionSolution
from beam_solver.tolerances import POSITION_TOL, same_position

DEFAULT_EI = 20_000.0  # kN·m² (equivalent to E=200 GPa, 200x300mm rectangle)
DEFAULT_EA = 2_000_000.0  # kN (equivalent to E=200 GPa, 0.01 m² area)


def _gather_nodes(beam: Beam) -> tuple[float, ...]:
    """Gather all unique critical positions along the beam as element nodes."""
    coords = [0.0, beam.length]
    for s in beam.supports:
        coords.append(s.position)
    coords.extend(beam.hinges)
    if beam.resolved_spans is not None:
        for span in beam.resolved_spans:
            coords.append(span.x_start)
            coords.append(span.x_end)
    for ld in beam.loads:
        if isinstance(ld, (PointLoad, PointMoment)):
            coords.append(ld.position)
        elif isinstance(ld, DistributedLoad):
            coords.append(ld.start)
            coords.append(ld.end)

    valid_coords = [c for c in coords if -POSITION_TOL <= c <= beam.length + POSITION_TOL]
    sorted_coords = sorted(valid_coords)

    unique: list[float] = []
    for c in sorted_coords:
        if not unique or not same_position(unique[-1], c):
            unique.append(c)
    return tuple(unique)


def _element_properties(beam: Beam, x_mid: float) -> tuple[float, float]:
    """Return (EI, EA) in kN·m² and kN for an element centered at x_mid."""
    if beam.resolved_spans is not None:
        for span in beam.resolved_spans:
            if span.x_start - POSITION_TOL <= x_mid <= span.x_end + POSITION_TOL:
                return span.ei, span.ea
    return DEFAULT_EI, DEFAULT_EA


def _solve_partitioned(
    k: np.ndarray, f: np.ndarray, prescribed: dict[int, float], classification: Classification
) -> tuple[np.ndarray, np.ndarray]:
    """Solve partitioned system K U = F + R given prescribed displacements."""
    n = k.shape[0]
    p_dofs = sorted(prescribed.keys())
    f_dofs = [d for d in range(n) if d not in prescribed]

    u = np.zeros(n, dtype=float)
    u_p = np.array([prescribed[d] for d in p_dofs], dtype=float) if p_dofs else np.empty(0)
    for d, val in prescribed.items():
        u[d] = val

    if f_dofs:
        k_ff = k[np.ix_(f_dofs, f_dofs)]
        k_fp = k[np.ix_(f_dofs, p_dofs)] if p_dofs else np.empty((len(f_dofs), 0))
        rhs = f[f_dofs] - (k_fp @ u_p if p_dofs else 0.0)
        try:
            u_f = np.linalg.solve(k_ff, rhs)
            u[f_dofs] = u_f
        except np.linalg.LinAlgError as exc:
            raise UnstableBeamError(
                "The beam is unstable or contains an internal mechanism.", classification
            ) from exc

    r = k @ u - f
    return u, r


def solve_stiffness(beam: Beam, classification: Classification) -> ReactionSolution:
    """Solve statically indeterminate (and determinate) beams via 1D Direct Stiffness FEM."""
    nodes = _gather_nodes(beam)
    num_nodes = len(nodes)
    if num_nodes < 2:
        raise SolverConsistencyError("Stiffness analysis requires at least two nodes.")

    # 1. DOF indexing
    # Axial DOFs: u_i = i (0 .. num_nodes - 1)
    num_axial_dofs = num_nodes

    # Bending DOFs:
    # Vertical translation: v_i = i (0 .. num_nodes - 1)
    # Rotational DOFs: non-hinge nodes share one DOF; hinge nodes have separate left/right DOFs.
    rot_left: list[int] = [0] * num_nodes
    rot_right: list[int] = [0] * num_nodes
    next_rot_dof = num_nodes

    for i, x in enumerate(nodes):
        is_hinge = any(same_position(x, h) for h in beam.hinges)
        if is_hinge:
            rot_left[i] = next_rot_dof
            next_rot_dof += 1
            rot_right[i] = next_rot_dof
            next_rot_dof += 1
        else:
            rot_left[i] = next_rot_dof
            rot_right[i] = next_rot_dof
            next_rot_dof += 1

    num_bend_dofs = next_rot_dof

    # 2. Assemble Global Stiffness Matrices
    k_bend = np.zeros((num_bend_dofs, num_bend_dofs), dtype=float)
    f_bend = np.zeros(num_bend_dofs, dtype=float)

    k_axial = np.zeros((num_axial_dofs, num_axial_dofs), dtype=float)
    f_axial = np.zeros(num_axial_dofs, dtype=float)

    for e in range(num_nodes - 1):
        x1, x2 = nodes[e], nodes[e + 1]
        elem_len = x2 - x1
        x_mid = 0.5 * (x1 + x2)
        ei, ea = _element_properties(beam, x_mid)

        # Axial element stiffness
        k_a = (ea / elem_len) * np.array([[1.0, -1.0], [-1.0, 1.0]], dtype=float)
        a_dofs = [e, e + 1]
        for i_idx, gi in enumerate(a_dofs):
            for j_idx, gj in enumerate(a_dofs):
                k_axial[gi, gj] += k_a[i_idx, j_idx]

        # Bending element stiffness
        elem_l = elem_len
        l2 = elem_l * elem_l
        l3 = l2 * elem_l
        k_b = np.array(
            [
                [12.0 * ei / l3, 6.0 * ei / l2, -12.0 * ei / l3, 6.0 * ei / l2],
                [6.0 * ei / l2, 4.0 * ei / elem_l, -6.0 * ei / l2, 2.0 * ei / elem_l],
                [-12.0 * ei / l3, -6.0 * ei / l2, 12.0 * ei / l3, -6.0 * ei / l2],
                [6.0 * ei / l2, 2.0 * ei / elem_l, -6.0 * ei / l2, 4.0 * ei / elem_l],
            ],
            dtype=float,
        )
        b_dofs = [e, rot_right[e], e + 1, rot_left[e + 1]]
        for i_idx, gi in enumerate(b_dofs):
            for j_idx, gj in enumerate(b_dofs):
                k_bend[gi, gj] += k_b[i_idx, j_idx]

    # 3. Assemble Applied External & Equivalent Nodal Loads
    for ld in beam.loads:
        if isinstance(ld, PointLoad):
            node_idx = next(i for i, x in enumerate(nodes) if same_position(x, ld.position))
            f_bend[node_idx] += ld.magnitude
            f_axial[node_idx] += ld.fx
        elif isinstance(ld, PointMoment):
            node_idx = next(i for i, x in enumerate(nodes) if same_position(x, ld.position))
            rot_dof = rot_left[node_idx]
            f_bend[rot_dof] += ld.magnitude
        elif isinstance(ld, DistributedLoad):
            for e in range(num_nodes - 1):
                x1, x2 = nodes[e], nodes[e + 1]
                if x1 >= ld.start - POSITION_TOL and x2 <= ld.end + POSITION_TOL:
                    seg_l = x2 - x1
                    w1 = ld.intensity_at(x1)
                    w2 = ld.intensity_at(x2)
                    w_uniform = w1
                    dw = w2 - w1
                    # Equivalent nodal forces for Hermite cubic shape functions
                    f1 = 0.5 * w_uniform * seg_l + (3.0 / 20.0) * dw * seg_l
                    f2 = (w_uniform * seg_l * seg_l) / 12.0 + (dw * seg_l * seg_l) / 30.0
                    f3 = 0.5 * w_uniform * seg_l + (7.0 / 20.0) * dw * seg_l
                    f4 = -(w_uniform * seg_l * seg_l) / 12.0 - (dw * seg_l * seg_l) / 20.0

                    b_dofs = [e, rot_right[e], e + 1, rot_left[e + 1]]
                    elem_f = [f1, f2, f3, f4]
                    for d_idx, dof in enumerate(b_dofs):
                        f_bend[dof] += elem_f[d_idx]

    # 4. Enforce Boundary Conditions
    prescribed_bend: dict[int, float] = {}
    prescribed_axial: dict[int, float] = {}
    support_node_map: dict[str, int] = {}

    for s in beam.supports:
        node_idx = next(i for i, x in enumerate(nodes) if same_position(x, s.position))
        support_node_map[s.id] = node_idx

        # Vertical restraint / spring
        if s.spring_ky is not None and s.spring_ky > 0:
            k_bend[node_idx, node_idx] += s.spring_ky
            if s.settlement != 0.0:
                f_bend[node_idx] -= s.spring_ky * s.settlement
        else:
            prescribed_bend[node_idx] = -s.settlement

        # Rotational restraint / spring
        if s.kind is SupportKind.FIXED:
            rot_dof = rot_left[node_idx]
            if s.spring_ktheta is not None and s.spring_ktheta > 0:
                k_bend[rot_dof, rot_dof] += s.spring_ktheta
            else:
                prescribed_bend[rot_dof] = 0.0

        # Axial restraint
        if s.kind in (SupportKind.PIN, SupportKind.FIXED):
            prescribed_axial[node_idx] = 0.0

    # 5. Solve Systems
    u_bend, r_bend = _solve_partitioned(k_bend, f_bend, prescribed_bend, classification)
    _u_axial, r_axial = _solve_partitioned(k_axial, f_axial, prescribed_axial, classification)

    # 6. Extract Reactions
    reactions_list: list[Reaction] = []
    has_custom_stiffness = beam.resolved_spans is not None
    used_default_stiffness_for_spring_or_settlement = False

    for s in beam.supports:
        node_idx = support_node_map[s.id]

        # Vertical reaction
        if s.spring_ky is not None and s.spring_ky > 0:
            v_disp = u_bend[node_idx]
            fy = float(s.spring_ky * (-v_disp - s.settlement))
            if not has_custom_stiffness:
                used_default_stiffness_for_spring_or_settlement = True
        else:
            fy = float(r_bend[node_idx])
            if s.settlement != 0.0 and not has_custom_stiffness:
                used_default_stiffness_for_spring_or_settlement = True

        # Moment reaction
        if s.kind is SupportKind.FIXED:
            rot_dof = rot_left[node_idx]
            if s.spring_ktheta is not None and s.spring_ktheta > 0:
                theta = u_bend[rot_dof]
                moment = float(s.spring_ktheta * (-theta))
                if not has_custom_stiffness:
                    used_default_stiffness_for_spring_or_settlement = True
            else:
                moment = float(r_bend[rot_dof])
        else:
            moment = 0.0

        # Horizontal reaction
        fx = float(r_axial[node_idx]) if s.kind in (SupportKind.PIN, SupportKind.FIXED) else 0.0

        reactions_list.append(
            Reaction(
                s.id,
                fx=0.0 if abs(fx) < 1e-10 else fx,
                fy=0.0 if abs(fy) < 1e-10 else fy,
                moment=0.0 if abs(moment) < 1e-10 else moment,
            )
        )

    warnings: list[str] = []
    if classification.axial_degree > 0:
        total_applied_fx = sum(abs(load.horizontal_resultant()) for load in beam.loads)
        if total_applied_fx < 1e-12:
            warnings.append(
                "Horizontal reactions are statically indeterminate but exactly zero: "
                "there are no horizontal loads."
            )
    if used_default_stiffness_for_spring_or_settlement:
        warnings.append(
            "Reactions for settlements or elastic springs were computed using default rigidity "
            f"(EI = {DEFAULT_EI:,.0f} kN·m²). Define material and section for custom rigidity."
        )

    return ReactionSolution(classification, tuple(reactions_list), tuple(warnings))
