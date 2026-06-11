import os
from pathlib import Path

from app.services.architecture_service import ArchitectureService
from app.services.workflow_service import WorkflowService
from app.services.database_detection_service import DatabaseDetectionService
from app.services.route_detection_service import RouteDetectionService
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.services.call_graph_service import CallGraphService


# ── Intent keyword map ────────────────────────────────
INTENTS: dict[str, list[str]] = {
    "architecture": [
        "architecture", "structure", "pattern", "layer",
        "overview", "how is it built", "tech stack",
        "organized", "designed", "framework"
    ],
    "workflow": [
        "flow", "workflow", "request", "trace",
        "execution", "process", "what happens",
        "end to end", "lifecycle", "pipeline"
    ],
    "database": [
        "database", " db ", "model", "orm", "sql",
        "schema", "table", "collection", "mongodb",
        "postgres", "redis", "migration", "prisma"
    ],
    "routes": [
        "route", "endpoint", "api", "url", " http",
        "rest", "controller", "handler", "path"
    ],
    "impact": [
        "impact", "change", "break", "affect",
        "what if", "if i modify", "refactor",
        "depend", "ripple", "consequence"
    ],
    "graph": [
        "function", "method", "call", "class",
        "inherit", "relationship", "dependency",
        "import", "who calls", "what calls", "uses"
    ]
}

# Max items to include per section (token budget)
WORKFLOW_SAMPLE  = 6
ROUTE_SAMPLE     = 25
TOP_NODES_SAMPLE = 8


class ContextBuilderService:
    """
    Selectively pulls data from all intelligence layers
    based on detected question intent.

    This is the "memory" layer — the LLM gets rich,
    targeted codebase knowledge rather than raw code.
    """

    # ──────────────────────────────────────────────────
    # Public
    # ──────────────────────────────────────────────────

    def build(
        self,
        repo_name: str,
        question: str
    ) -> dict:
        """
        Build context dict based on question intent.
        Always includes architecture summary.
        Conditionally includes workflow, DB, routes, graph.
        """

        intents = self._detect_intents(question)

        context: dict = {
            "repository":       repo_name,
            "intents_detected": intents
        }

        # ── Always: lightweight architecture summary ──
        context["architecture"] = self._safe(
            lambda: self._arch_summary(repo_name), {}
        )

        # ── Conditional sections ──────────────────────

        if "workflow" in intents:
            context["workflows"] = self._safe(
                lambda: self._workflow_summary(repo_name),
                {}
            )

        if "database" in intents:
            context["database"] = self._safe(
                lambda: DatabaseDetectionService(
                ).detect_databases(repo_name),
                {}
            )

        if "routes" in intents:
            context["routes"] = self._safe(
                lambda: self._routes_summary(repo_name),
                {}
            )

        if "graph" in intents or "impact" in intents:
            context["knowledge_graph"] = self._safe(
                lambda: self._kg_summary(repo_name), {}
            )

        return context

    def build_for_file(
        self,
        repo_name: str,
        file_path: str
    ) -> dict:
        """
        Context specifically for explaining a file.
        Includes: file source (truncated), KG neighbours,
        architecture summary.
        """

        context: dict = {
            "repository": repo_name,
            "target_file": file_path
        }

        context["architecture"] = self._safe(
            lambda: self._arch_summary(repo_name), {}
        )

        # Read file source (first 120 lines)
        context["file_source"] = self._safe(
            lambda: self._read_file_head(
                repo_name, file_path, 120
            ),
            "File not readable."
        )

        # KG neighbourhood
        context["file_context"] = self._safe(
            lambda: self._kg_file_context(
                repo_name, file_path
            ),
            {}
        )

        return context

    def build_for_function(
        self,
        repo_name: str,
        function_name: str
    ) -> dict:
        """
        Context specifically for explaining a function.
        Includes: call graph (callers + callees),
        workflow membership, architecture summary.
        """

        context: dict = {
            "repository":    repo_name,
            "target_function": function_name
        }

        context["architecture"] = self._safe(
            lambda: self._arch_summary(repo_name), {}
        )

        # What does this function call?
        context["outgoing_calls"] = self._safe(
            lambda: CallGraphService().get_function_calls(
                repo_name, function_name
            ),
            {}
        )

        # Who calls this function?
        context["callers"] = self._safe(
            lambda: CallGraphService().get_callers(
                repo_name, function_name
            ),
            {}
        )

        # Is it an entry point in any workflow?
        context["workflow_membership"] = self._safe(
            lambda: self._fn_workflow_membership(
                repo_name, function_name
            ),
            []
        )

        return context

    # ──────────────────────────────────────────────────
    # Intent detection
    # ──────────────────────────────────────────────────

    def _detect_intents(self, question: str) -> list[str]:

        q = question.lower()
        detected = []

        for intent, keywords in INTENTS.items():
            if any(kw in q for kw in keywords):
                detected.append(intent)

        return detected

    # ──────────────────────────────────────────────────
    # Data extractors
    # ──────────────────────────────────────────────────

    def _arch_summary(self, repo_name: str) -> dict:

        arch = ArchitectureService().get_architecture(
            repo_name
        )

        return {
            "pattern":          arch.get("architecture_pattern"),
            "confidence":       arch.get("pattern_confidence"),
            "tech_stack":       arch.get("tech_stack", {}),
            "detected_layers":  arch.get("detected_layers", []),
            "summary":          arch.get("summary", ""),
            "total_entry_points": len(
                arch.get("entry_points", [])
            ),
            "core_modules":     arch.get("core_modules", [])[:5]
        }

    def _workflow_summary(self, repo_name: str) -> dict:

        wf = WorkflowService().get_workflows(repo_name)
        workflows = wf.get("workflows", [])

        return {
            "total": wf.get("total_workflows", 0),
            "sample": [
                {
                    "name":    w["name"],
                    "depth":   w.get("depth", 0),
                    "steps":   w.get("total_steps", 0),
                    "touches_db": w.get(
                        "touches_database", False
                    ),
                    "layers":  w.get("layers_involved", [])
                }
                for w in workflows[:WORKFLOW_SAMPLE]
            ]
        }

    def _routes_summary(self, repo_name: str) -> dict:

        r = RouteDetectionService().detect_routes(
            repo_name
        )

        return {
            "total":      r.get("total_routes", 0),
            "api_routes": r.get("api_routes", 0),
            "page_routes": r.get("page_routes", 0),
            "frameworks": r.get("frameworks_detected", []),
            "sample": [
                {
                    "method":    route["method"],
                    "path":      route["path"],
                    "handler":   route.get("handler"),
                    "framework": route.get("framework"),
                    "type":      route.get("type")
                }
                for route in r.get(
                    "routes", []
                )[:ROUTE_SAMPLE]
            ]
        }

    def _kg_summary(self, repo_name: str) -> dict:

        kg = KnowledgeGraphService().get_summary(repo_name)

        return {
            "total_nodes":  kg.get("total_nodes", 0),
            "total_edges":  kg.get("total_edges", 0),
            "node_types":   kg.get("node_types", {}),
            "edge_types":   kg.get("edge_types", {}),
            "top_nodes":    kg.get(
                "top_connected_nodes", []
            )[:TOP_NODES_SAMPLE]
        }

    def _kg_file_context(
        self,
        repo_name: str,
        file_path: str
    ) -> dict:
        """Get KG neighbours of a file node."""

        kg_svc = KnowledgeGraphService()
        node_id = f"file::{file_path}"
        node = kg_svc.get_node(repo_name, node_id)

        if "error" in node:
            return {}

        return {
            "contains":  [
                e["target_name"]
                for e in node.get("outgoing", [])
                if e.get("edge_type") == "contains"
            ],
            "imports": [
                e["target_name"]
                for e in node.get("outgoing", [])
                if e.get("edge_type") == "imports"
            ],
            "imported_by": [
                e["source_name"]
                for e in node.get("incoming", [])
                if e.get("edge_type") == "imports"
            ]
        }

    def _fn_workflow_membership(
        self,
        repo_name: str,
        function_name: str
    ) -> list:
        """Which workflows contain this function?"""

        wf_data = WorkflowService().get_workflows(
            repo_name
        )

        matches = []

        for wf in wf_data.get("workflows", []):

            flow = wf.get("flow", {})

            if self._flow_has_fn(flow, function_name):
                matches.append({
                    "workflow": wf["name"],
                    "method":   wf["entry"]["method"],
                    "path":     wf["entry"]["path"]
                })

        return matches

    def _flow_has_fn(
        self,
        node: dict,
        fn_name: str
    ) -> bool:

        if not node:
            return False

        if node.get("function") == fn_name:
            return True

        return any(
            self._flow_has_fn(child, fn_name)
            for child in node.get("calls", [])
        )

    def _read_file_head(
        self,
        repo_name: str,
        file_path: str,
        max_lines: int
    ) -> str:

        full_path = (
            Path("repositories")
            / repo_name
            / file_path
        )

        if not full_path.exists():
            return f"File not found: {file_path}"

        lines = []

        with open(
            full_path, "r",
            encoding="utf-8",
            errors="ignore"
        ) as f:
            for i, line in enumerate(f):
                if i >= max_lines:
                    lines.append(
                        f"\n... (truncated at "
                        f"{max_lines} lines)"
                    )
                    break
                lines.append(line)

        return "".join(lines)

    def _safe(self, fn, default):
        try:
            return fn()
        except Exception:
            return default
