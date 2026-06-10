from pathlib import Path


# ── Folder name → architectural layer ────────────────
LAYER_MAP: dict[str, str] = {
    # API / Presentation
    "api":           "API Layer",
    "routes":        "API Layer",
    "endpoints":     "API Layer",
    "controllers":   "API Layer",
    "handlers":      "API Layer",
    "views":         "API Layer",
    "routers":       "API Layer",
    "rest":          "API Layer",
    "graphql":       "API Layer",

    # Service / Business Logic
    "services":      "Service Layer",
    "service":       "Service Layer",
    "business":      "Service Layer",
    "use_cases":     "Service Layer",
    "usecases":      "Service Layer",
    "domain":        "Service Layer",
    "application":   "Service Layer",
    "interactors":   "Service Layer",

    # Repository / Data Access
    "repositories":  "Repository Layer",
    "repository":    "Repository Layer",
    "repos":         "Repository Layer",
    "dao":           "Repository Layer",
    "data_access":   "Repository Layer",
    "store":         "Repository Layer",

    # Models / Entities
    "models":        "Model Layer",
    "model":         "Model Layer",
    "entities":      "Model Layer",
    "entity":        "Model Layer",
    "schemas":       "Schema Layer",
    "schema":        "Schema Layer",
    "dto":           "Schema Layer",
    "dtos":          "Schema Layer",
    "types":         "Schema Layer",

    # Infrastructure
    "db":            "Infrastructure Layer",
    "database":      "Infrastructure Layer",
    "migrations":    "Infrastructure Layer",
    "config":        "Infrastructure Layer",
    "configuration": "Infrastructure Layer",
    "core":          "Infrastructure Layer",
    "infrastructure":"Infrastructure Layer",
    "infra":         "Infrastructure Layer",

    # Middleware
    "middleware":    "Middleware Layer",
    "middlewares":   "Middleware Layer",
    "interceptors":  "Middleware Layer",
    "guards":        "Middleware Layer",
    "filters":       "Middleware Layer",

    # Utilities
    "utils":         "Utility Layer",
    "util":          "Utility Layer",
    "helpers":       "Utility Layer",
    "helper":        "Utility Layer",
    "lib":           "Utility Layer",
    "libs":          "Utility Layer",
    "common":        "Utility Layer",
    "shared":        "Utility Layer",
    "support":       "Utility Layer",

    # Testing
    "tests":         "Test Layer",
    "test":          "Test Layer",
    "__tests__":     "Test Layer",
    "spec":          "Test Layer",
    "specs":         "Test Layer",
    "e2e":           "Test Layer",

    # React / Next.js / Frontend
    "components":    "UI Component Layer",
    "component":     "UI Component Layer",
    "pages":         "Page Layer",
    "app":           "Page Layer",
    "screens":       "Page Layer",
    "views":         "Page Layer",
    "hooks":         "Hooks Layer",
    "hook":          "Hooks Layer",
    "context":       "State Layer",
    "contexts":      "State Layer",
    "redux":         "State Layer",
    "zustand":       "State Layer",
    "jotai":         "State Layer",
    "recoil":        "State Layer",
    "store":         "State Layer",
    "stores":        "State Layer",
    "public":        "Static Layer",
    "assets":        "Static Layer",
    "static":        "Static Layer",
    "styles":        "Style Layer",
    "style":         "Style Layer",
    "css":           "Style Layer",
    "sass":          "Style Layer",
}

# ── Pattern detection rules ───────────────────────────
# Ordered from most specific to least specific.
# First rule whose required_layers is a subset of
# detected_layers wins.
PATTERN_RULES: list[tuple[set, str, str]] = [
    (
        {"API Layer", "Service Layer",
         "Repository Layer", "Model Layer"},
        "Layered Architecture", "high"
    ),
    (
        {"API Layer", "Service Layer",
         "Repository Layer"},
        "Layered Architecture (partial)", "medium"
    ),
    (
        {"API Layer", "Service Layer", "Model Layer"},
        "Service-Oriented", "medium"
    ),
    (
        {"API Layer", "Model Layer"},
        "MVC (partial)", "medium"
    ),
    (
        {"UI Component Layer", "Page Layer",
         "Hooks Layer", "State Layer"},
        "React SPA (full)", "high"
    ),
    (
        {"UI Component Layer", "Page Layer",
         "Hooks Layer"},
        "React SPA", "high"
    ),
    (
        {"UI Component Layer", "Page Layer"},
        "React Application", "medium"
    ),
    (
        {"API Layer", "Page Layer"},
        "Full-Stack (Next.js style)", "high"
    ),
    (
        {"Service Layer"},
        "Service-Centric", "low"
    ),
]


class FolderSemanticsService:
    """
    Classifies repository directories into architectural
    layers and detects overall architecture pattern.

    Completely language-agnostic — works by directory
    name matching only. No code parsing.
    """

    def analyze(self, repo_name: str) -> dict:

        repo_path = Path("repositories") / repo_name

        folder_data = []
        detected_layer_set: set[str] = set()

        # Walk top 2 levels of directory tree
        for entry in repo_path.rglob("*"):

            if not entry.is_dir():
                continue

            try:
                relative = entry.relative_to(repo_path)
                depth = len(relative.parts)
            except ValueError:
                continue

            if depth > 2:
                continue

            folder_name = entry.name.lower()

            if folder_name not in LAYER_MAP:
                continue

            layer = LAYER_MAP[folder_name]

            try:
                file_count = sum(
                    1 for f in entry.iterdir()
                    if f.is_file()
                )
            except PermissionError:
                file_count = 0

            folder_data.append({
                "path": str(relative).replace(
                    "\\", "/"
                ),
                "name": entry.name,
                "layer": layer,
                "file_count": file_count
            })

            detected_layer_set.add(layer)

        # Detect architecture pattern
        pattern = "Monolith / Script"
        confidence = "low"

        for required_layers, pat_name, conf in (
            PATTERN_RULES
        ):

            if required_layers.issubset(
                detected_layer_set
            ):
                pattern = pat_name
                confidence = conf
                break

        return {
            "repository": repo_name,
            "folders": folder_data,
            "detected_layers": sorted(
                detected_layer_set
            ),
            "architecture_pattern": pattern,
            "pattern_confidence": confidence
        }
