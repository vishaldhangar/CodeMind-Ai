from app.services.route_detection_service import (
    RouteDetectionService
)
from app.services.call_graph_service import (
    CallGraphService
)
from app.services.folder_semantics_service import (
    FolderSemanticsService
)


# Maximum call chain depth to trace per workflow
MAX_DEPTH = 6

# Function names that indicate database operations.
# Used to flag "touches_database" in a workflow.
DB_CALL_PATTERNS = {
    # SQL / generic ORM
    "execute", "executemany", "fetchone",
    "fetchall", "fetchmany", "fetch",
    "query", "raw", "scalar",
    "scalar_one", "scalar_one_or_none",
    # SQLAlchemy session
    "add", "add_all", "commit", "rollback",
    "flush", "refresh", "merge", "expunge",
    "get", "first", "all", "one",
    "one_or_none", "filter", "filter_by",
    "where", "select", "insert", "update",
    "delete", "join", "outerjoin",
    # MongoDB / Motor / Beanie
    "find", "find_one", "find_one_and_update",
    "find_one_and_delete", "find_one_and_replace",
    "insert_one", "insert_many",
    "update_one", "update_many",
    "delete_one", "delete_many",
    "aggregate", "count_documents",
    "estimated_document_count", "replace_one",
    # Redis
    "set", "get", "mset", "mget",
    "hset", "hget", "hmset", "hmget",
    "lpush", "rpush", "lrange", "llen",
    "expire", "ttl", "exists", "incr",
    "decr", "sadd", "smembers",
    # Generic CRUD
    "save", "create", "bulk_create",
    "bulk_update", "bulk_delete",
    "count", "exists", "destroy",
    "upsert", "find_or_create",
}


class WorkflowService:
    """
    Phase 2: Workflow Engine.

    Traces execution flows from HTTP entry points
    through the Function Call Graph, building a
    depth-limited tree for each route handler.

    Every node in the tree records:
      - function name
      - source file
      - architectural layer
      - whether it is a database call
      - child calls (recursive)
    """

    # ──────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────

    def get_workflows(
        self,
        repo_name: str
    ) -> dict:
        """
        Build a workflow for every detected HTTP route.
        """

        routes_data = self._safe(
            lambda: RouteDetectionService(
            ).detect_routes(repo_name),
            {"routes": []}
        )

        cg_data, node_map, edge_map = (
            self._load_call_graph(repo_name)
        )

        folder_layer_map = self._load_folder_layers(
            repo_name
        )

        internal_nodes = [
            n for n in cg_data.get("nodes", [])
            if n.get("type") == "function"
        ]

        workflows = []

        for route in routes_data.get("routes", []):

            handler = route.get("handler")

            if not handler:
                continue

            wf = self._build_workflow(
                route,
                handler,
                internal_nodes,
                node_map,
                edge_map,
                folder_layer_map
            )

            workflows.append(wf)

        return {
            "repository": repo_name,
            "total_workflows": len(workflows),
            "workflows": workflows
        }

    def get_workflow_for_function(
        self,
        repo_name: str,
        function_name: str
    ) -> dict:
        """
        Trace the execution flow starting from any
        named function, not just HTTP handlers.
        """

        cg_data, node_map, edge_map = (
            self._load_call_graph(repo_name)
        )

        folder_layer_map = self._load_folder_layers(
            repo_name
        )

        internal_nodes = [
            n for n in cg_data.get("nodes", [])
            if n.get("type") == "function"
        ]

        node_id = self._find_handler_node(
            function_name, internal_nodes
        )

        if not node_id:
            return {
                "repository": repo_name,
                "function": function_name,
                "error": (
                    f"Function '{function_name}' not "
                    f"found in the call graph."
                )
            }

        flow = self._trace_flow(
            node_id, node_map, edge_map,
            folder_layer_map, depth=0, visited=set()
        )

        steps, db, layers = self._analyze_flow(flow)

        return {
            "repository": repo_name,
            "function": function_name,
            "node_id": node_id,
            "flow": flow,
            "depth": self._get_depth(flow),
            "total_steps": steps,
            "touches_database": db,
            "layers_involved": sorted(layers)
        }

    # ──────────────────────────────────────────────────
    # Workflow builder
    # ──────────────────────────────────────────────────

    def _build_workflow(
        self,
        route: dict,
        handler: str,
        internal_nodes: list,
        node_map: dict,
        edge_map: dict,
        folder_layer_map: dict
    ) -> dict:

        node_id = self._find_handler_node(
            handler, internal_nodes
        )

        if node_id:
            flow = self._trace_flow(
                node_id, node_map, edge_map,
                folder_layer_map, depth=0, visited=set()
            )
        else:
            # Handler not in call graph yet
            flow = {
                "function": handler,
                "file": route.get("file"),
                "node_id": None,
                "type": "entry_point",
                "layer": self._file_to_layer(
                    route.get("file", ""),
                    folder_layer_map
                ),
                "is_db_call": False,
                "calls": [],
                "unresolved": True
            }

        steps, db, layers = self._analyze_flow(flow)

        return {
            "name": (
                f"{route['method']} {route['path']}"
            ),
            "entry": {
                "method": route["method"],
                "path": route["path"],
                "handler": handler,
                "file": route.get("file"),
                "framework": route.get("framework"),
                "route_type": route.get("type")
            },
            "flow": flow,
            "depth": self._get_depth(flow),
            "total_steps": steps,
            "touches_database": db,
            "layers_involved": sorted(layers)
        }

    # ──────────────────────────────────────────────────
    # Call graph DFS tracer
    # ──────────────────────────────────────────────────

    def _trace_flow(
        self,
        node_id: str,
        node_map: dict,
        edge_map: dict,
        folder_layer_map: dict,
        depth: int,
        visited: set
    ) -> dict:
        """
        DFS through the call graph from node_id.
        - Stops at MAX_DEPTH
        - Stops at external nodes (library calls)
        - Detects and breaks cycles
        """

        node_data = node_map.get(node_id, {})

        fn_name = node_data.get("function") or (
            node_id.split("::")[-1]
            if "::" in node_id
            else node_id.replace("external::", "")
        )

        file_path = node_data.get("file")
        node_type = node_data.get("type", "function")

        is_external = (
            node_type == "external"
            or node_id.startswith("external::")
        )

        is_db = self._is_db_call(fn_name)

        layer = (
            self._file_to_layer(
                file_path or "",
                folder_layer_map
            )
            if not is_external else None
        )

        result: dict = {
            "function": fn_name,
            "file": file_path,
            "node_id": node_id,
            "type": (
                "external" if is_external
                else "internal"
            ),
            "layer": layer,
            "is_db_call": is_db,
            "calls": []
        }

        # ── Stop conditions ───────────────────────────

        if depth >= MAX_DEPTH:
            result["truncated"] = True
            return result

        if is_external:
            return result

        if node_id in visited:
            result["cycle_detected"] = True
            return result

        # Immutable copy so sibling branches get
        # independent visited sets
        visited = visited | {node_id}

        # ── Recurse into children ─────────────────────

        for edge in edge_map.get(node_id, []):

            callee_id = edge["callee"]

            child = self._trace_flow(
                callee_id, node_map, edge_map,
                folder_layer_map, depth + 1, visited
            )

            result["calls"].append(child)

        return result

    # ──────────────────────────────────────────────────
    # Handler resolution
    # ──────────────────────────────────────────────────

    def _find_handler_node(
        self,
        handler_name: str,
        internal_nodes: list
    ) -> str | None:
        """
        Resolve a handler function name to a qualified
        call graph node ID.

        Priority:
          1. Nodes in api/ routes/ views/ handlers/ dirs
          2. Single unambiguous match
          3. First match
        """

        matches = [
            n["id"] for n in internal_nodes
            if n.get("function") == handler_name
        ]

        if not matches:
            return None

        if len(matches) == 1:
            return matches[0]

        # Prefer nodes in presentation layer paths
        api_dirs = {
            "/api/", "\\api\\",
            "/routes/", "\\routes\\",
            "/views/", "\\views\\",
            "/handlers/", "\\handlers\\",
            "/controllers/", "\\controllers\\"
        }

        preferred = [
            m for m in matches
            if any(d in m for d in api_dirs)
        ]

        return preferred[0] if preferred else matches[0]

    # ──────────────────────────────────────────────────
    # Layer resolution
    # ──────────────────────────────────────────────────

    def _file_to_layer(
        self,
        file_path: str,
        folder_layer_map: dict
    ) -> str | None:

        if not file_path:
            return None

        normalized = file_path.replace("\\", "/")

        # Longest match wins (more specific path)
        best_match = None
        best_len = 0

        for folder_path, layer in (
            folder_layer_map.items()
        ):
            folder_norm = folder_path.replace(
                "\\", "/"
            )

            if (
                folder_norm in normalized
                and len(folder_norm) > best_len
            ):
                best_match = layer
                best_len = len(folder_norm)

        return best_match

    # ──────────────────────────────────────────────────
    # Flow analytics
    # ──────────────────────────────────────────────────

    def _analyze_flow(
        self,
        flow: dict
    ) -> tuple[int, bool, set]:
        """
        Recursively compute:
          - total node count in the flow tree
          - whether any node is a DB call
          - set of all architectural layers touched
        """

        total = 1
        db = flow.get("is_db_call", False)
        layers: set = set()

        layer = flow.get("layer")
        if layer:
            layers.add(layer)

        for child in flow.get("calls", []):
            c_total, c_db, c_layers = (
                self._analyze_flow(child)
            )
            total += c_total
            db = db or c_db
            layers |= c_layers

        return total, db, layers

    def _get_depth(
        self,
        flow: dict,
        current: int = 0
    ) -> int:
        """Maximum depth of the flow tree."""

        children = flow.get("calls", [])

        if not children:
            return current

        return max(
            self._get_depth(child, current + 1)
            for child in children
        )

    # ──────────────────────────────────────────────────
    # Data loaders
    # ──────────────────────────────────────────────────

    def _load_call_graph(
        self,
        repo_name: str
    ) -> tuple[dict, dict, dict]:
        """
        Load call graph and build lookup maps.

        Returns:
          cg_data  - raw call graph dict
          node_map - node_id → node data
          edge_map - caller_id → list of
                     {callee, resolution}
        """

        cg_data = self._safe(
            lambda: CallGraphService().build(repo_name),
            {"nodes": [], "edges": []}
        )

        node_map = {
            n["id"]: n
            for n in cg_data.get("nodes", [])
        }

        edge_map: dict[str, list] = {}

        for edge in cg_data.get("edges", []):

            caller = edge["caller"]
            edge_map.setdefault(caller, []).append({
                "callee": edge["callee"],
                "resolution": edge.get(
                    "resolution", "unknown"
                )
            })

        return cg_data, node_map, edge_map

    def _load_folder_layers(
        self,
        repo_name: str
    ) -> dict:
        """
        Load folder semantics and build
        folder_path → layer_name map.
        """

        folder_data = self._safe(
            lambda: FolderSemanticsService(
            ).analyze(repo_name),
            {"folders": []}
        )

        return {
            f["path"]: f["layer"]
            for f in folder_data.get("folders", [])
        }

    # ──────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────

    def _is_db_call(self, fn_name: str) -> bool:
        return fn_name.lower() in DB_CALL_PATTERNS

    def _safe(self, fn, default):
        try:
            return fn()
        except Exception:
            return default
