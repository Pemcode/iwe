"""Disposition : déterministe, fidèle aux grappes, stable quand de nouvelles notions arrivent."""
import math
import sys
from pathlib import Path

import pytest

np = pytest.importorskip("numpy")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from carte_disposition import layout  # noqa: E402


def two_clusters(extra=0):
    """Deux grappes de 12 notions reliées par un pont, plus `extra` notions accrochées à la grappe A."""
    ids = [f"a{i}" for i in range(12)] + [f"b{i}" for i in range(12)] + [f"n{i}" for i in range(extra)]
    edges = []
    for group in ("a", "b"):
        for i in range(12):
            for j in range(i + 1, 12):
                if (i + j) % 3 != 0:
                    edges.append((ids.index(f"{group}{i}"), ids.index(f"{group}{j}"), 0.6))
    edges.append((ids.index("a0"), ids.index("b0"), 0.1))
    for k in range(extra):
        edges += [(ids.index(f"n{k}"), ids.index(f"a{k}"), 0.7), (ids.index(f"n{k}"), ids.index(f"a{k + 1}"), 0.7)]
    return ids, edges


def centroid(points, prefix):
    chosen = [p for k, p in points.items() if k.startswith(prefix)]
    return [sum(c) / len(chosen) for c in zip(*chosen)]


@pytest.mark.parametrize("dim", [2, 3])
def test_layout_is_deterministic_normalised_and_keeps_clusters_apart(dim):
    ids, edges = two_clusters()
    first, _ = layout(ids, edges, dim)
    second, _ = layout(ids, edges, dim)
    assert first == second
    assert all(len(p) == dim and all(abs(c) <= 1.3 for c in p) for p in first.values())
    ca, cb = centroid(first, "a"), centroid(first, "b")
    spread = sum(math.dist(first[k], ca) for k in first if k.startswith("a")) / 12
    assert math.dist(ca, cb) > 2 * spread


def test_new_notions_join_their_neighbours_without_moving_the_map():
    ids, edges = two_clusters()
    before, scale = layout(ids, edges, 2)
    ids2, edges2 = two_clusters(extra=3)
    after, _ = layout(ids2, edges2, 2, previous=before, scale=scale)
    moves = [math.dist(before[k], after[k]) for k in before]
    assert math.sqrt(sum(m * m for m in moves) / len(moves)) < 0.05
    ca, cb = centroid(before, "a"), centroid(before, "b")
    for k in ("n0", "n1", "n2"):
        assert math.dist(after[k], ca) < math.dist(after[k], cb)
