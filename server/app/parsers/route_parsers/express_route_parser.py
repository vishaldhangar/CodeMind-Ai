import re
from pathlib import Path


# Matches: router.get('/path', ...) or app.post('/path', ...)
# Handles single quotes, double quotes, and backticks
EXPRESS_PATTERN = re.compile(
    r"""(?:router|app)\s*\.\s*(get|post|put|patch|delete|use|all)\s*\(\s*['"`]([^'"`]+)['"`]""",
    re.IGNORECASE
)

JS_EXTENSIONS = {".js", ".ts", ".mjs", ".cjs"}

SKIP_DIRS = {
    "node_modules", ".next", "dist",
    "build", ".git", "out", "coverage"
}


class ExpressRouteParser:
    """
    Detects Express.js routes using regex line scanning.
    No AST — intentionally lightweight.

    Detects:
      router.get('/path', handler)
      app.post('/path', middleware, handler)
      app.use('/prefix', subRouter)
    """

    def parse_repository(
        self,
        repo_path: str
    ) -> list:

        routes = []
        repo = Path(repo_path)

        for file in repo.rglob("*"):

            if not file.is_file():
                continue

            if file.suffix not in JS_EXTENSIONS:
                continue

            # Skip build/vendor directories
            if any(
                part in SKIP_DIRS
                for part in file.parts
            ):
                continue

            routes.extend(
                self._scan_file(str(file))
            )

        return routes

    def _scan_file(
        self,
        file_path: str
    ) -> list:

        routes = []

        try:
            with open(
                file_path, "r",
                encoding="utf-8",
                errors="ignore"
            ) as f:
                content = f.read()

        except Exception:
            return routes

        for line_num, line in enumerate(
            content.splitlines(), start=1
        ):

            # Skip commented lines
            stripped = line.strip()
            if stripped.startswith("//"):
                continue

            for match in EXPRESS_PATTERN.finditer(line):

                raw_method = match.group(1).upper()
                path_str = match.group(2)

                # "use" and "all" → ANY
                method = (
                    "ANY"
                    if raw_method in ("USE", "ALL")
                    else raw_method
                )

                routes.append({
                    "method": method,
                    "path": path_str,
                    "handler": None,
                    "file": file_path,
                    "line": line_num,
                    "framework": "express",
                    "type": "api_route"
                })

        return routes
