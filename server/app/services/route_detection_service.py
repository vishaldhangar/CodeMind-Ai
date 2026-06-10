from pathlib import Path

from app.parsers.route_parsers.python_route_parser import (
    PythonRouteParser
)
from app.parsers.route_parsers.nextjs_route_parser import (
    NextJsRouteParser
)
from app.parsers.route_parsers.express_route_parser import (
    ExpressRouteParser
)


class RouteDetectionService:

    def detect_routes(
        self,
        repo_name: str
    ) -> dict:

        repo_path = Path("repositories") / repo_name
        routes = []

        # ── Python routes (AST-based) ─────────────────
        python_parser = PythonRouteParser()

        for py_file in repo_path.rglob("*.py"):
            file_routes = python_parser.parse_file(
                str(py_file)
            )
            routes.extend(file_routes)

        # ── Next.js routes (filesystem only) ──────────
        nextjs_parser = NextJsRouteParser()
        nextjs_routes = nextjs_parser.parse_repository(
            str(repo_path)
        )
        routes.extend(nextjs_routes)

        # ── Express routes (regex only) ────────────────
        # Only attempt if package.json exists
        pkg_json = repo_path / "package.json"

        if pkg_json.exists():
            express_parser = ExpressRouteParser()
            express_routes = (
                express_parser.parse_repository(
                    str(repo_path)
                )
            )
            routes.extend(express_routes)

        # ── Aggregate ─────────────────────────────────
        api_routes = [
            r for r in routes
            if r["type"] == "api_route"
        ]

        page_routes = [
            r for r in routes
            if r["type"] == "page_route"
        ]

        frameworks_detected = list(
            set(r["framework"] for r in routes)
        )

        return {
            "repository": repo_name,
            "total_routes": len(routes),
            "api_routes": len(api_routes),
            "page_routes": len(page_routes),
            "frameworks_detected": frameworks_detected,
            "routes": routes
        }
