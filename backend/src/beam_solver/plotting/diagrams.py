"""Matplotlib diagrams: beam sketch, SFD and BMD on one shared x-axis."""

from typing import TYPE_CHECKING

from beam_solver.analysis import AnalysisResult
from beam_solver.domain import Beam, DistributedLoad, PointLoad, PointMoment, SupportKind

if TYPE_CHECKING:
    from matplotlib.axes import Axes
    from matplotlib.figure import Figure

_SUPPORT_MARKERS = {SupportKind.PIN: "^", SupportKind.ROLLER: "o", SupportKind.FIXED: "s"}


def _draw_beam(ax: "Axes", beam: Beam, title: str) -> None:
    ax.plot([0, beam.length], [0, 0], color="black", linewidth=4)
    for s in beam.supports:
        ax.plot(s.position, -0.15, _SUPPORT_MARKERS[s.kind], color="tab:gray", markersize=12)
    for load in beam.loads:
        if isinstance(load, PointLoad):
            if load.fx != 0.0:
                ax.annotate(
                    f"Fx = {load.fx:g} kN",
                    xy=(load.position, 0),
                    xytext=(load.position - (0.5 if load.fx > 0 else -0.5), 0.3),
                    arrowprops={"arrowstyle": "->", "color": "tab:purple"},
                )
            if load.magnitude == 0.0:
                continue
            up = load.magnitude > 0
            ax.annotate(
                f"{abs(load.magnitude):g} kN",
                xy=(load.position, 0.05 if not up else -0.05),
                xytext=(load.position, 0.6 if not up else -0.6),
                ha="center",
                arrowprops={"arrowstyle": "->", "color": "tab:red"},
            )
        elif isinstance(load, PointMoment):
            arrow = "↺" if load.magnitude > 0 else "↻"
            ax.text(load.position, 0.3, f"{arrow} {abs(load.magnitude):g} kN·m", ha="center")
        elif isinstance(load, DistributedLoad):
            peak = max(abs(load.w_start), abs(load.w_end)) or 1.0
            h1, h2 = 0.5 * abs(load.w_start) / peak, 0.5 * abs(load.w_end) / peak
            ax.fill(
                [load.start, load.start, load.end, load.end],
                [0.05, 0.05 + h1, 0.05 + h2, 0.05],
                color="tab:orange",
                alpha=0.4,
            )
    ax.set_ylim(-0.8, 1.0)
    ax.set_yticks([])
    ax.set_title(title)


def plot_diagrams(beam: Beam, result: AnalysisResult, title: str = "Beam") -> "Figure":
    """Stacked beam / SFD / BMD figure sharing one x-axis."""
    import matplotlib.pyplot as plt

    has_axial = any(load.horizontal_resultant() != 0.0 for load in beam.loads)
    count = 4 if has_axial else 3
    fig, axes = plt.subplots(count, 1, sharex=True, figsize=(9, 10 if has_axial else 8))
    ax_beam, ax_v, ax_m = axes[0], axes[-2], axes[-1]
    _draw_beam(ax_beam, beam, title)
    sampled = result.sample(100)
    if has_axial:
        ax_n = axes[1]
        ax_n.plot(sampled.x, sampled.axial, color="tab:purple")
        ax_n.fill_between(sampled.x, sampled.axial, alpha=0.2, color="tab:purple")
        ax_n.axhline(0, color="black", linewidth=0.8)
        ax_n.set_ylabel("Axial N (kN), tension +")
        ax_n.grid(alpha=0.3)
        for p in result.critical_points:
            ax_n.plot([p.x, p.x], [p.axial_left, p.axial_right], color="tab:purple")
    for ax, values, label, color in (
        (ax_v, sampled.shear, "Shear V (kN)", "tab:blue"),
        (ax_m, sampled.moment, "Moment M (kN·m)", "tab:green"),
    ):
        ax.plot(sampled.x, values, color=color)
        ax.fill_between(sampled.x, values, alpha=0.2, color=color)
        ax.axhline(0, color="black", linewidth=0.8)
        ax.set_ylabel(label)
        ax.grid(alpha=0.3)
    for p in result.critical_points:  # vertical jump lines
        ax_v.plot([p.x, p.x], [p.shear_left, p.shear_right], color="tab:blue")
        ax_m.plot([p.x, p.x], [p.moment_left, p.moment_right], color="tab:green")
    for extreme in (result.max_sagging, result.max_hogging):
        if extreme is not None:
            ax_m.plot(extreme.x, extreme.value, "o", color="tab:red")
            ax_m.annotate(
                f"{extreme.value:.3g}",
                (extreme.x, extreme.value),
                ha="center",
                textcoords="offset points",
                xytext=(0, 8),
            )
    for x in result.zero_shear_points:
        ax_v.plot(x, 0, "x", color="tab:red")
    ax_m.set_xlabel("x (m)")
    fig.tight_layout()
    return fig
