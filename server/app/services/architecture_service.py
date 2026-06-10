from app.services.tech_stack_service import (
    TechStackService
)
from app.services.route_detection_service import (
    RouteDetectionService
)
from app.services.database_detection_service import (
    DatabaseDetectionService
)
from app.services.folder_semantics_service import (
    FolderSemanticsService
)
from app.services.call_graph_service import (
    CallGraphService
)
from app.services.dependency_analytics_service import (
    DependencyAnalyticsService
)


class ArchitectureService:
    """
    Full architecture analysis of a repository.

    Consumes all intelligence layers:
      - TechStackService         → languages, frameworks
      - RouteDetectionService    → entry points
      - DatabaseDetectionService → databases, models
      - FolderSemanticsService   → layers, pattern
      - CallGraphService         → core modules
      - DependencyAnalyticsService → top imports
    """

    def get_architecture(
        self,
        repo_name: str
    ) -> dict:

        # ── Gather all intelligence ───────────────────
        tech_stack = self._safe(
            lambda: TechStackService().get_tech_stack(
                repo_name
            ),
            default={
                "languages": [], "frameworks": [],
                "databases": [], "ai_stack": [],
                "testing_tools": [], "auth": [],
                "task_queue": [], "http_clients": [],
                "ui_libraries": []
            }
        )

        routes_data = self._safe(
            lambda: RouteDetectionService(
            ).detect_routes(repo_name),
            default={
                "routes": [], "total_routes": 0,
                "api_routes": 0, "page_routes": 0,
                "frameworks_detected": []
            }
        )

        db_data = self._safe(
            lambda: DatabaseDetectionService(
            ).detect_databases(repo_name),
            default={
                "databases": [], "db_models": [],
                "has_database": False
            }
        )

        folder_data = self._safe(
            lambda: FolderSemanticsService(
            ).analyze(repo_name),
            default={
                "folders": [], "detected_layers": [],
                "architecture_pattern": "Unknown",
                "pattern_confidence": "low"
            }
        )

        call_graph_data = self._safe(
            lambda: CallGraphService().build(repo_name),
            default={"nodes": [], "edges": []}
        )

        dep_analytics = self._safe(
            lambda: DependencyAnalyticsService(
            ).get_summary(repo_name),
            default={"top_internal_modules": []}
        )

        # ── Merge databases into tech_stack ──────────
        detected_db_names = [
            db["type"]
            for db in db_data.get("databases", [])
        ]

        merged_dbs = list(
            set(
                tech_stack.get("databases", [])
                + detected_db_names
            )
        )
        tech_stack["databases"] = sorted(merged_dbs)

        # ── Entry points: from routes ─────────────────
        entry_points = [
            {
                "type": "http_route",
                "method": r["method"],
                "path": r["path"],
                "handler": r.get("handler"),
                "file": r.get("file"),
                "framework": r.get("framework"),
                "route_type": r.get("type")
            }
            for r in routes_data.get("routes", [])
        ]

        # ── Core modules: most-called internally ──────
        core_modules = self._extract_core_modules(
            call_graph_data,
            dep_analytics
        )

        # ── Summary text ──────────────────────────────
        summary = self._generate_summary(
            repo_name,
            tech_stack,
            routes_data,
            folder_data,
            db_data,
            call_graph_data
        )

        return {
            "repository": repo_name,
            "tech_stack": tech_stack,
            "entry_points": entry_points[:20],
            "core_modules": core_modules[:10],
            "layers": folder_data.get("folders", []),
            "detected_layers": folder_data.get(
                "detected_layers", []
            ),
            "architecture_pattern": folder_data.get(
                "architecture_pattern", "Unknown"
            ),
            "pattern_confidence": folder_data.get(
                "pattern_confidence", "low"
            ),
            "db_models": db_data.get("db_models", []),
            "summary": summary
        }

    # ──────────────────────────────────────────────────
    # Core module extraction
    # ──────────────────────────────────────────────────

    def _extract_core_modules(
        self,
        call_graph_data: dict,
        dep_analytics: dict
    ) -> list:

        # Count how many times each internal node
        # is called (in-degree in the call graph)
        call_counts: dict[str, int] = {}

        for edge in call_graph_data.get("edges", []):

            if edge.get("resolution") != "internal":
                continue

            callee = edge["callee"]
            call_counts[callee] = (
                call_counts.get(callee, 0) + 1
            )

        core_modules = []
        seen_files: set[str] = set()

        # Sort by call count descending
        for node_id, count in sorted(
            call_counts.items(),
            key=lambda x: -x[1]
        )[:10]:

            # node_id format: "file_path::function_name"
            if "::" in node_id:
                file_path = node_id.split("::")[0]

                if file_path not in seen_files:
                    seen_files.add(file_path)
                    core_modules.append({
                        "module": file_path,
                        "call_count": count,
                        "reason": "most called internally"
                    })

        # Fallback: use dependency analytics
        if not core_modules:

            for mod in dep_analytics.get(
                "top_internal_modules", []
            )[:5]:

                core_modules.append({
                    "module": mod["module"],
                    "call_count": mod["imports"],
                    "reason": "most imported internally"
                })

        return core_modules

    # ──────────────────────────────────────────────────
    # Summary generation
    # ──────────────────────────────────────────────────

    def _generate_summary(
        self,
        repo_name: str,
        tech_stack: dict,
        routes_data: dict,
        folder_data: dict,
        db_data: dict,
        call_graph_data: dict
    ) -> str:

        parts = []

        pattern = folder_data.get(
            "architecture_pattern", ""
        )

        if pattern and pattern not in (
            "Unknown", "Monolith / Script"
        ):
            parts.append(f"A {pattern}")
        else:
            parts.append("A software repository")

        frameworks = tech_stack.get("frameworks", [])
        if frameworks:
            parts.append(
                f"built with "
                f"{', '.join(frameworks[:3])}"
            )

        languages = tech_stack.get("languages", [])
        if languages:
            lang_str = ", ".join(languages[:3])
            parts.append(f"written in {lang_str}")

        layers = folder_data.get("detected_layers", [])
        if len(layers) >= 2:
            parts.append(
                f"with {len(layers)} architectural "
                f"layers"
            )

        total_routes = routes_data.get(
            "total_routes", 0
        )
        if total_routes:
            parts.append(
                f"exposing {total_routes} routes"
            )

        dbs = tech_stack.get("databases", [])
        if dbs:
            parts.append(
                f"using {', '.join(dbs[:3])} "
                f"for data storage"
            )

        total_fns = call_graph_data.get(
            "total_functions", 0
        )
        if total_fns:
            parts.append(
                f"containing {total_fns} tracked "
                f"functions"
            )

        return ". ".join(parts) + "."

    # ──────────────────────────────────────────────────
    # Safe execution helper
    # ──────────────────────────────────────────────────

    def _safe(self, fn, default):
        try:
            return fn()
        except Exception:
            return default