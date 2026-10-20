"""Disposition de la carte : initialisation spectrale, forces de type ForceAtlas2, stabilité d'une version à l'autre.

La position d'une notion doit rester la même quand de nouveaux cours arrivent : c'est la condition de la mémoire
spatiale (« l'inox est au nord-est »). Les notions déjà placées sont rappelées vers leur ancienne position,
les nouvelles partent du barycentre de leurs voisines, puis un alignement de Procruste supprime toute dérive.
"""
import hashlib

import numpy as np

PARAMS = {"iterations": 700, "incremental_iterations": 250, "repulsion": 1.0, "gravity": 0.05, "anchor": 4.0,
          "start_step": 0.08, "end_step": 0.002, "radius": 0.004, "intra": 1.5, "inter": 0.3, "cohesion": 0.15}


def _jitter(ident, dim, amplitude=1.0):
    digest = hashlib.md5(ident.encode("utf-8")).digest()
    return np.array([(digest[i] / 255.0 - 0.5) * 2 * amplitude for i in range(dim)])


def _matrix(n, edges):
    w = np.zeros((n, n))
    for a, b, s in edges:
        w[a, b] = w[b, a] = max(w[a, b], s, 1e-3)
    return w


def _spectral(w, dim, ids):
    """Vecteurs propres du laplacien normalisé : la « PCA du graphe », une première carte globale."""
    n = len(w)
    reg = w + (w[w > 0].mean() if (w > 0).any() else 1.0) * 1e-3 / max(n, 1)
    np.fill_diagonal(reg, 0)
    degree = reg.sum(1)
    inv = 1 / np.sqrt(degree)
    laplacian = np.eye(n) - inv[:, None] * reg * inv[None, :]
    values, vectors = np.linalg.eigh(laplacian)
    coords = vectors[:, 1:dim + 1] * inv[:, None]
    for k in range(coords.shape[1]):
        # Orientation du vecteur propre fixée par le signe de sa plus grande composante : résultat reproductible.
        if coords[np.argmax(np.abs(coords[:, k])), k] < 0:
            coords[:, k] *= -1
    coords /= np.abs(coords).max() or 1.0
    noise = np.array([_jitter(i, dim, 0.01) for i in ids])
    return coords + noise


def _forces(x, w, mass, iterations, start, end, anchors=None, anchor_weight=None, groups=None):
    """LinLog : attraction en log(1 + d) le long des liens, répulsion en 1/d entre toutes les notions, gravité douce ;
    avec des continents, chaque notion est en plus rappelée vers le centre du sien (des îles plutôt qu'une pelote)."""
    n, dim = x.shape
    rows, cols = np.nonzero(np.triu(w))
    weights = w[rows, cols]
    mm = mass[:, None] * mass[None, :]
    if groups is not None:
        groups = np.asarray(groups)
        count = np.bincount(groups).astype(float)[:, None]
    for it in range(iterations):
        rep = PARAMS["repulsion"] * mm / _dist2(x) * 1e-3
        np.fill_diagonal(rep, 0)
        # Σ_j r_ij (x_i − x_j) = x_i Σ_j r_ij − (R x)_i : pas de tableau n × n × dim.
        force = x * rep.sum(1)[:, None] - rep @ x
        edge = x[rows] - x[cols]
        length = np.sqrt((edge ** 2).sum(-1)) + 1e-9
        pull = (weights * np.log1p(length / 0.05) / length)[:, None] * edge
        np.add.at(force, rows, -pull)
        np.add.at(force, cols, pull)
        force -= PARAMS["gravity"] * mass[:, None] * x
        if groups is not None:
            centre = np.zeros((len(count), dim))
            np.add.at(centre, groups, x)
            force -= PARAMS["cohesion"] * mass[:, None] * (x - (centre / np.maximum(count, 1))[groups])
        if anchors is not None:
            force -= anchor_weight[:, None] * mass[:, None] * (x - anchors) * PARAMS["anchor"]
        move = force / mass[:, None]
        norm = np.sqrt((move ** 2).sum(-1)) + 1e-12
        step = start * (end / start) ** (it / max(iterations - 1, 1))
        x = x + move * np.minimum(1.0, step / norm)[:, None]
    return x


def _separate(x, radius, rounds=40):
    """Écarte les notions qui se chevauchent encore, sans bouleverser la carte."""
    for _ in range(rounds):
        dist = np.sqrt(_dist2(x))
        overlap = np.clip(radius[:, None] + radius[None, :] - dist, 0, None)
        np.fill_diagonal(overlap, 0)
        if overlap.max() < 1e-6:
            break
        push = overlap / dist / 2
        x = x + x * push.sum(1)[:, None] - push @ x
    return x


def _dist2(x):
    """Carrés des distances entre toutes les notions, par |a|² + |b|² − 2 a·b."""
    sq = (x ** 2).sum(1)
    return np.maximum(sq[:, None] + sq[None, :] - 2 * x @ x.T, 1e-6)


def _normalise(x):
    """Centre, axe principal à l'horizontale (écrans en paysage), étendue ramenée à environ [-1, 1]."""
    x = x - x.mean(0)
    _, _, vt = np.linalg.svd(x, full_matrices=False)
    for k in range(vt.shape[0]):
        if vt[k][np.argmax(np.abs(vt[k]))] < 0:
            vt[k] *= -1
    x = x @ vt.T
    scale = 1.0 / (np.percentile(np.abs(x), 99) or 1.0)
    return x * scale, scale


def _procrustes(source, target):
    """Rotation, échelle et translation qui superposent au mieux `source` à `target` (sans symétrie miroir)."""
    ms, mt = source.mean(0), target.mean(0)
    a, b = source - ms, target - mt
    u, s, vt = np.linalg.svd(a.T @ b)
    d = np.sign(np.linalg.det(u @ vt)) or 1.0
    fix = np.eye(a.shape[1])
    fix[-1, -1] = d
    rotation = u @ fix @ vt
    scale = (s * np.diag(fix)).sum() / ((a ** 2).sum() or 1.0)
    return lambda points: (points - ms) @ rotation * scale + mt


def _by_group(w, dim, ids, groups):
    """Départ en îles : les continents sont placés comme des super-notions (carte spectrale de leurs liens),
    écartés selon leur taille, puis chaque notion part du centre du sien."""
    groups = np.asarray(groups)
    k = groups.max() + 1
    onehot = np.zeros((len(groups), k))
    onehot[np.arange(len(groups)), groups] = 1
    between = onehot.T @ w @ onehot
    np.fill_diagonal(between, 0)
    names = [f"continent-{c}" for c in range(k)]
    centres = _spectral(between, dim, names) if k > dim + 1 else np.array([_jitter(name, dim) for name in names])
    size = onehot.sum(0)
    radius = 0.35 * np.sqrt(size / size.max())
    centres = _separate(centres, radius, rounds=200)
    return centres[groups] + np.array([_jitter(i, dim) for i in ids]) * radius[groups][:, None] * 0.6


def layout(ids, edges, dim, previous=None, scale=None, groups=None):
    """Positions normalisées {identifiant: [x, y(, z)]} et facteur d'échelle à conserver pour la version suivante.
    `groups` (continent de chaque notion) rassemble les notions d'un même continent en îles."""
    n = len(ids)
    if n == 0:
        return {}, scale
    w = _matrix(n, edges)
    degree = (w > 0).sum(1)
    mass = 1.0 + degree
    if groups is not None:
        same = np.asarray(groups)[:, None] == np.asarray(groups)[None, :]
        w = w * np.where(same, PARAMS["intra"], PARAMS["inter"])
    known = [i for i, ident in enumerate(ids) if previous and ident in previous]
    if previous and scale and len(known) >= dim + 1:
        x = np.zeros((n, dim))
        for i in known:
            x[i] = np.array(previous[ids[i]][:dim]) / scale
        placed = set(known)
        for i in range(n):
            if i in placed:
                continue
            neighbours = [j for j in np.nonzero(w[i])[0] if j in placed]
            base = (np.average(x[neighbours], axis=0, weights=w[i, neighbours]) if neighbours else x[known].mean(0))
            x[i] = base + _jitter(ids[i], dim, 0.01 / scale)
        anchors = x.copy()
        anchor_weight = np.array([1.0 if i in placed else 0.0 for i in range(n)])
        x = _forces(x, w, mass, PARAMS["incremental_iterations"], PARAMS["start_step"] / 4, PARAMS["end_step"],
                    anchors, anchor_weight, groups)
        x = _separate(x, PARAMS["radius"] / scale * np.sqrt(mass / mass.mean()))
        target = np.array([previous[ids[i]][:dim] for i in known])
        transform = _procrustes(x[known], target)
        x = transform(x)
    else:
        x = _spectral(w, dim, ids) if groups is None else _by_group(w, dim, ids, groups)
        x = _forces(x, w, mass, PARAMS["iterations"], PARAMS["start_step"], PARAMS["end_step"], groups=groups)
        x, scale = _normalise(x)
        x = _separate(x, PARAMS["radius"] * np.sqrt(mass / mass.mean()))
    return {ident: [round(float(c), 4) for c in x[i]] for i, ident in enumerate(ids)}, scale
