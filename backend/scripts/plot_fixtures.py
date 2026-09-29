"""Plot every fixture in shared/fixtures to plots/<name>.png for visual checking."""

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from beam_solver.analysis import analyze
from beam_solver.io import beam_from_json
from beam_solver.plotting.diagrams import plot_diagrams

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    out_dir = ROOT / "plots"
    out_dir.mkdir(exist_ok=True)
    for path in sorted((ROOT / "shared" / "fixtures").glob("*.json")):
        beam = beam_from_json(json.loads(path.read_text())["input"])
        fig = plot_diagrams(beam, analyze(beam), title=path.stem)
        fig.savefig(out_dir / f"{path.stem}.png", dpi=110)
        plt.close(fig)
        print(out_dir / f"{path.stem}.png")


if __name__ == "__main__":
    main()
