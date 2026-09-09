from pathlib import Path

_SKIP_DIRS = frozenset({
    'node_modules', '.git', '.next', 'dist', 'build',
    'out', '__pycache__', '.venv', 'venv', 'env',
    '.turbo', '.cache', 'coverage', '.mypy_cache',
})

_JS_TS_EXTS = {'.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'}


class PackageRegistryService:

    def build_registry(self, repo_name: str) -> set:
        repo_path = Path("repositories") / repo_name
        packages: set[str] = set()

        # ── Python modules ────────────────────────────
        for py_file in repo_path.rglob("*.py"):
            if _SKIP_DIRS.intersection(set(py_file.parts)):
                continue
            relative = py_file.relative_to(repo_path)
            module = (
                str(relative)
                .replace("\\", ".")
                .replace("/", ".")
                .replace(".py", "")
            )
            packages.add(module)
            parts = module.split(".")
            for i in range(1, len(parts)):
                packages.add(".".join(parts[:i]))

        # ── JS / TS files ─────────────────────────────
        # Store as repo-relative forward-slash paths without extension
        # e.g. "lib/prisma", "components/ui/button"
        for ext in _JS_TS_EXTS:
            for f in repo_path.rglob(f"*{ext}"):
                if _SKIP_DIRS.intersection(set(f.parts)):
                    continue
                relative = f.relative_to(repo_path)
                path_str = str(relative).replace("\\", "/")
                no_ext = path_str[: -len(ext)]
                packages.add(no_ext)        # lib/prisma
                packages.add(path_str)      # lib/prisma.js

        return packages
