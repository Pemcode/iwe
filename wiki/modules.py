"""Ordre pédagogique des modules ; les nouvelles matières restent toujours visibles."""

MODULES = (
    ("procedes", "Procédés"),
    ("materiaux", "Matériaux"),
    ("conception", "Conception et calcul"),
    ("fabrication", "Contrôle et fabrication"),
)


def subject_modules(subjects):
    groups = {ident: [] for ident, _ in MODULES}
    groups["autres"] = []
    for subject in subjects:
        module = subject.get("module")
        groups[module if module in groups else "autres"].append(subject)
    return [(ident, title, groups[ident]) for ident, title in (*MODULES, ("autres", "Autres")) if groups[ident]]
