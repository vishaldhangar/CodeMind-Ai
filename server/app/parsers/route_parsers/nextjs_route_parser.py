import re
from pathlib import Path


PAGE_EXTENSIONS = {".js", ".jsx", ".ts", ".tsx", ".mjs"}

# Exported HTTP method handlers in App Router route files
_HTTP_EXPORT = re.compile(
    r'export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(',
    re.MULTILINE,
)
# Default export: export default function Name(
_DEFAULT_FN = re.compile(
    r'export\s+default\s+(?:async\s+)?function\s+(\w+)\s*[(<]',
    re.MULTILINE,
)
# const Name = ... ; export default Name
_DEFAULT_VAR = re.compile(
    r'export\s+default\s+(\w+)\s*[;\n]',
    re.MULTILINE,
)

# Files to skip in pages/ router
SKIP_PREFIXES = {"_", "."}

# Directories to skip entirely
SKIP_DIRS = {
    "node_modules", ".next", "dist",
    "build", ".git", "out"
}


class NextJsRouteParser:
    """
    Detects routes in Next.js projects using
    filesystem conventions only — zero code parsing.

    Supports:
      - Pages Router:  pages/**
      - App Router:    app/**/page.tsx, app/**/route.ts
    """

    def parse_repository(
        self,
        repo_path: str
    ) -> list:

        routes = []
        repo = Path(repo_path)

        # Pages Router
        pages_dir = repo / "pages"
        if pages_dir.exists() and pages_dir.is_dir():
            routes.extend(
                self._parse_pages_router(pages_dir)
            )

        # App Router
        app_dir = repo / "app"
        if app_dir.exists() and app_dir.is_dir():
            routes.extend(
                self._parse_app_router(app_dir)
            )

        return routes

    # ──────────────────────────────────────────────────
    # Pages Router
    # ──────────────────────────────────────────────────

    def _parse_pages_router(
        self,
        pages_dir: Path
    ) -> list:

        routes = []

        for file in pages_dir.rglob("*"):

            if not file.is_file():
                continue

            if file.suffix not in PAGE_EXTENSIONS:
                continue

            if any(
                part in SKIP_DIRS
                for part in file.parts
            ):
                continue

            # Skip _app.js, _document.js, _error.js
            if any(
                file.stem.startswith(p)
                for p in SKIP_PREFIXES
            ):
                continue

            route_path = self._to_route_path(
                file, pages_dir
            )

            # Files under pages/api/ are API routes
            is_api = "api" in [
                p.lower()
                for p in file.relative_to(
                    pages_dir
                ).parts[:-1]
            ]

            handlers = self._extract_handlers(file, is_api=is_api)
            if is_api:
                if not handlers:
                    handlers = [("ANY", None)]
                for method, handler in handlers:
                    routes.append({
                        "method": method,
                        "path": route_path,
                        "handler": handler,
                        "file": str(file),
                        "line": None,
                        "framework": "nextjs_pages",
                        "type": "api_route"
                    })
            else:
                method, handler = handlers[0] if handlers else ("GET", None)
                routes.append({
                    "method": method,
                    "path": route_path,
                    "handler": handler,
                    "file": str(file),
                    "line": None,
                    "framework": "nextjs_pages",
                    "type": "page_route"
                })

        return routes

    # ──────────────────────────────────────────────────
    # App Router
    # ──────────────────────────────────────────────────

    def _parse_app_router(
        self,
        app_dir: Path
    ) -> list:

        routes = []

        for file in app_dir.rglob("*"):

            if not file.is_file():
                continue

            if file.suffix not in PAGE_EXTENSIONS:
                continue

            if any(
                part in SKIP_DIRS
                for part in file.parts
            ):
                continue

            stem = file.stem.lower()

            if stem == "route":
                # API route: app/api/.../route.ts
                route_path = self._to_route_path(
                    file.parent / "_index",
                    app_dir
                )
                handlers = self._extract_handlers(file, is_api=True)
                if not handlers:
                    handlers = [("ANY", None)]
                for method, handler in handlers:
                    routes.append({
                        "method": method,
                        "path": route_path,
                        "handler": handler,
                        "file": str(file),
                        "line": None,
                        "framework": "nextjs_app",
                        "type": "api_route"
                    })

            elif stem == "page":
                # Page route: app/.../page.tsx
                route_path = self._to_route_path(
                    file.parent / "_index",
                    app_dir
                )
                handlers = self._extract_handlers(file, is_api=False)
                method, handler = handlers[0] if handlers else ("GET", None)
                routes.append({
                    "method": method,
                    "path": route_path,
                    "handler": handler,
                    "file": str(file),
                    "line": None,
                    "framework": "nextjs_app",
                    "type": "page_route"
                })

        return routes

    # ──────────────────────────────────────────────────
    # Handler extraction
    # ──────────────────────────────────────────────────

    def _extract_handlers(
        self,
        file: Path,
        is_api: bool
    ) -> list[tuple[str, str]]:
        """
        Read the file and return [(method, handler_name), …].
        For API routes: exported HTTP method functions.
        For page files: the default exported component.
        Falls back to (method, None) if nothing found.
        """
        try:
            text = file.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            return []

        if is_api:
            # route.ts: may export GET, POST, etc.
            found = _HTTP_EXPORT.findall(text)
            if found:
                return [(m, m) for m in found]
            return []

        # page.tsx: default export
        m = _DEFAULT_FN.search(text)
        if m:
            return [('GET', m.group(1))]
        m = _DEFAULT_VAR.search(text)
        if m and m.group(1) not in ('null', 'undefined'):
            return [('GET', m.group(1))]
        return [('GET', None)]

    # ──────────────────────────────────────────────────
    # Path conversion utility
    # ──────────────────────────────────────────────────

    def _to_route_path(
        self,
        file: Path,
        base_dir: Path
    ) -> str:
        """
        Convert a filesystem path to a URL route string.

        pages/users/[id].js  →  /users/:id
        pages/index.js       →  /
        app/api/[...slug]/   →  /api/:slug*
        """

        try:
            relative = file.relative_to(base_dir)
        except ValueError:
            return "/"

        parts = list(relative.parts)

        # Strip extension from last segment
        if parts:
            stem = Path(parts[-1]).stem
            # Remove the sentinel _index we passed
            if stem == "_index":
                parts = parts[:-1]
            else:
                parts[-1] = stem

        # Remove trailing "index"
        if parts and parts[-1].lower() == "index":
            parts = parts[:-1]

        converted = []

        for part in parts:

            if part.startswith("[...") and part.endswith("]"):
                # catch-all: [...slug] → :slug*
                converted.append(
                    f":{part[4:-1]}*"
                )

            elif (
                part.startswith("[[...")
                and part.endswith("]]")
            ):
                # optional catch-all: [[...slug]] → :slug*
                converted.append(
                    f":{part[5:-2]}*"
                )

            elif part.startswith("[") and part.endswith("]"):
                # dynamic: [id] → :id
                converted.append(
                    f":{part[1:-1]}"
                )

            elif part.startswith("(") and part.endswith(")"):
                # route group: (auth) → ignored in URL
                pass

            else:
                converted.append(part)

        return "/" + "/".join(converted) if converted else "/"
