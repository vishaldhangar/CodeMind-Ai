from app.services.dependency_service import (
    DependencyService
)
from app.services.call_graph_service import (
    CallGraphService
)
from app.services.workflow_service import (
    WorkflowService
)
from app.services.folder_semantics_service import (
    FolderSemanticsService
)


# Blast radius thresholds (number of affected files)
BLAST_THRESHOLDS = [
    (0,  "none"),
    (3,  "low"),
    (10, "medium"),
    (20, "high"),
]


class ImpactAnalysisService:
    """
    Phase 3: Impact Analysis Engine.

    Answers:
      "What breaks if this FILE changes?"
      "What breaks if this FUNCTION changes?"

    Uses:
      - Dependency Graph  → who imports this file?
      - Call Graph        → who calls functions here?
      - Workflow Engine   → which request flows pass through?
      - Folder Semantics  → what layer is each dependent in?
    """

    # ──────────────────────────────────────────────────
    # Public: file-level impact
    # ──────────────────────────────────────────────────

    def analyze_file(
        self,
        repo_name: str,
        file_path: str
    ) -> dict:
        """
        Full impact report for changing a specific file.

        file_path: path relative to the repo root,
                   e.g. "app/services/auth_service.py"
        """

        dep_data = self._safe(
            lambda: DependencyService(
            ).get_dependencies(repo_name),
            {"dependencies": []}
        )

        cg_data = self._safe(
            lambda: CallGraphService().build(repo_name),
            {"nodes": [], "edges": []}
        )

        folder_data = self._safe(
            lambda: FolderSemanticsService(
            ).analyze(repo_name),
            {"folders": []}
        )

        wf_data = self._safe(
            lambda: WorkflowService(
            ).get_workflows(repo_name),
            {"workflows": []}
        )

        folder_layer_map = self._build_layer_map(
            folder_data
        )

        # ── 1. Direct dependents ──────────────────────
        direct = self._direct_dependents(
            file_path, dep_data, folder_layer_map
        )

        # ── 2. Transitive dependents (BFS) ────────────
        transitive = self._transitive_dependents(
            file_path, direct, dep_data, folder_layer_map
        )

        all_dependents = direct + transitive

        # ── 3. Affected functions ─────────────────────
        affected_fns = self._affected_functions(
            file_path, cg_data
        )

        # ── 4. Affected workflows ─────────────────────
        affected_wf = self._workflows_touching_file(
            file_path, wf_data
        )

        # ── 5. Affected layers ────────────────────────
        affected_layers = sorted({
            d["layer"]
            for d in all_dependents
            if d.get("layer")
        })

        total_files = len({
            d["file"] for d in all_dependents
        })

        return {
            "repository": repo_name,
            "target": file_path,
            "target_type": "file",
            "impact": {
                "blast_radius": self._blast_radius(
                    total_files
                ),
                "total_affected_files": total_files,
                "total_affected_functions": (
                    len(affected_fns)
                ),
                "total_affected_workflows": (
                    len(affected_wf)
                ),
                "affected_layers": affected_layers,
                "direct_dependents": direct,
                "transitive_dependents": transitive,
                "affected_functions": affected_fns,
                "affected_workflows": affected_wf
            }
        }

    # ──────────────────────────────────────────────────
    # Public: function-level impact
    # ──────────────────────────────────────────────────

    def analyze_function(
        self,
        repo_name: str,
        function_name: str
    ) -> dict:
        """
        Full impact report for changing a specific
        function.
        """

        cg_service = CallGraphService()

        callers_data = self._safe(
            lambda: cg_service.get_callers(
                repo_name, function_name
            ),
            {"called_by": []}
        )

        folder_data = self._safe(
            lambda: FolderSemanticsService(
            ).analyze(repo_name),
            {"folders": []}
        )

        wf_data = self._safe(
            lambda: WorkflowService(
            ).get_workflows(repo_name),
            {"workflows": []}
        )

        folder_layer_map = self._build_layer_map(
            folder_data
        )

        # Enrich callers with layer info
        callers = []
        affected_layers: set[str] = set()

        for edge in callers_data.get("called_by", []):

            caller_id = edge["caller"]
            file_path = (
                caller_id.split("::")[0]
                if "::" in caller_id
                else None
            )
            layer = self._file_to_layer(
                file_path or "", folder_layer_map
            )

            if layer:
                affected_layers.add(layer)

            callers.append({
                "caller_id": caller_id,
                "file": file_path,
                "layer": layer,
                "resolution": edge.get("resolution")
            })

        # Find workflows containing this function
        affected_wf = self._workflows_containing_fn(
            function_name, wf_data
        )

        return {
            "repository": repo_name,
            "target": function_name,
            "target_type": "function",
            "impact": {
                "blast_radius": self._blast_radius(
                    len(callers)
                ),
                "total_affected_functions": len(callers),
                "total_affected_workflows": (
                    len(affected_wf)
                ),
                "affected_layers": sorted(
                    affected_layers
                ),
                "direct_callers": callers,
                "affected_workflows": affected_wf
            }
        }

    # ──────────────────────────────────────────────────
    # Dependency graph analysis
    # ──────────────────────────────────────────────────

    def _direct_dependents(
        self,
        file_path: str,
        dep_data: dict,
        folder_layer_map: dict
    ) -> list:
        """
        Find files that directly import the target file.

        Strategy: convert file path to all possible
        module name variants, then match against
        dependency graph targets.
        """

        module_names = self._file_to_module_names(
            file_path
        )

        seen: set[str] = set()
        direct = []

        for edge in dep_data.get("dependencies", []):

            if edge["type"] != "internal":
                continue

            source = edge["source"]
            target = edge["target"]

            if source in seen:
                continue

            # Avoid self-dependency
            if self._same_file(source, file_path):
                continue

            # Check if target matches any module name
            if self._target_matches(target, module_names):

                seen.add(source)
                layer = self._file_to_layer(
                    source, folder_layer_map
                )

                direct.append({
                    "file": source,
                    "layer": layer,
                    "dependency_type": "direct",
                    "imports_module": target
                })

        return direct

    def _transitive_dependents(
        self,
        file_path: str,
        direct: list,
        dep_data: dict,
        folder_layer_map: dict
    ) -> list:
        """
        BFS from direct dependents to find all
        transitive dependents.
        """

        if not direct:
            return []

        # Build reverse dependency map:
        # module_name → [files that import it]
        reverse: dict[str, list[str]] = {}

        for edge in dep_data.get("dependencies", []):
            if edge["type"] != "internal":
                continue
            reverse.setdefault(
                edge["target"], []
            ).append(edge["source"])

        visited: set[str] = {file_path}
        visited |= {d["file"] for d in direct}

        queue = [d["file"] for d in direct]
        transitive = []

        while queue:

            current = queue.pop(0)

            for module_name in self._file_to_module_names(
                current
            ):

                for dependent in reverse.get(
                    module_name, []
                ):

                    if dependent in visited:
                        continue

                    if self._same_file(
                        dependent, file_path
                    ):
                        continue

                    visited.add(dependent)
                    layer = self._file_to_layer(
                        dependent, folder_layer_map
                    )

                    transitive.append({
                        "file": dependent,
                        "layer": layer,
                        "dependency_type": "transitive",
                        "imports_module": module_name
                    })

                    queue.append(dependent)

        return transitive

    # ──────────────────────────────────────────────────
    # Call graph analysis
    # ──────────────────────────────────────────────────

    def _affected_functions(
        self,
        file_path: str,
        cg_data: dict
    ) -> list:
        """
        Find functions in OTHER files that call
        functions defined in the target file.
        """

        # Node IDs belonging to the target file
        target_nodes: set[str] = {
            n["id"]
            for n in cg_data.get("nodes", [])
            if self._node_in_file(n, file_path)
        }

        seen_callers: set[str] = set()
        affected = []

        for edge in cg_data.get("edges", []):

            callee = edge["callee"]
            caller = edge["caller"]

            if callee not in target_nodes:
                continue

            # Skip calls within the same file
            if self._node_in_file(
                {"id": caller}, file_path
            ):
                continue

            if caller in seen_callers:
                continue

            seen_callers.add(caller)

            caller_file = (
                caller.split("::")[0]
                if "::" in caller
                else None
            )

            callee_fn = (
                callee.split("::")[-1]
                if "::" in callee
                else callee
            )

            caller_fn = (
                caller.split("::")[-1]
                if "::" in caller
                else caller
            )

            affected.append({
                "caller_function": caller_fn,
                "caller_file": caller_file,
                "calls_into_function": callee_fn,
                "calls_into_file": file_path,
                "resolution": edge.get("resolution")
            })

        return affected

    # ──────────────────────────────────────────────────
    # Workflow analysis
    # ──────────────────────────────────────────────────

    def _workflows_touching_file(
        self,
        file_path: str,
        wf_data: dict
    ) -> list:
        """
        Find workflows whose call tree passes through
        any function in the target file.
        """

        affected = []

        for wf in wf_data.get("workflows", []):

            touched_fns = self._flow_touches_file(
                wf.get("flow", {}),
                file_path
            )

            if touched_fns:
                affected.append({
                    "workflow": wf["name"],
                    "method": wf["entry"]["method"],
                    "path": wf["entry"]["path"],
                    "handler": wf["entry"]["handler"],
                    "functions_called_in_target": (
                        touched_fns
                    )
                })

        return affected

    def _workflows_containing_fn(
        self,
        function_name: str,
        wf_data: dict
    ) -> list:
        """
        Find workflows that call a specific function.
        """

        affected = []

        for wf in wf_data.get("workflows", []):

            depth = self._flow_has_function(
                wf.get("flow", {}),
                function_name
            )

            if depth is not None:
                affected.append({
                    "workflow": wf["name"],
                    "method": wf["entry"]["method"],
                    "path": wf["entry"]["path"],
                    "handler": wf["entry"]["handler"],
                    "function_depth": depth
                })

        return affected

    def _flow_touches_file(
        self,
        node: dict,
        file_path: str
    ) -> list[str]:
        """
        Recursively check if a flow node or any
        descendant is in the target file.
        Returns list of function names found.
        """

        if not node:
            return []

        found = []
        node_file = (
            node.get("file") or ""
        ).replace("\\", "/")

        target = file_path.replace("\\", "/")

        if target in node_file or node_file.endswith(
            target
        ):
            fn = node.get("function", "unknown")
            found.append(fn)

        for child in node.get("calls", []):
            found.extend(
                self._flow_touches_file(child, file_path)
            )

        return found

    def _flow_has_function(
        self,
        node: dict,
        function_name: str,
        depth: int = 0
    ) -> int | None:
        """
        Check if flow tree contains a function.
        Returns depth if found, None otherwise.
        """

        if not node:
            return None

        if node.get("function") == function_name:
            return depth

        for child in node.get("calls", []):
            result = self._flow_has_function(
                child, function_name, depth + 1
            )
            if result is not None:
                return result

        return None

    # ──────────────────────────────────────────────────
    # Utility helpers
    # ──────────────────────────────────────────────────

    def _file_to_module_names(
        self,
        file_path: str
    ) -> list[str]:
        """
        Convert a file path to all possible module
        name variants that might appear in imports.

        "app/services/auth_service.py"
         → ["app.services.auth_service",
            "services.auth_service",
            "auth_service"]
        """

        normalized = (
            file_path.replace("\\", "/")
        )

        # Strip repositories/repo_name/ prefix
        parts = normalized.split("/")
        if parts and parts[0] == "repositories":
            parts = parts[2:]  # strip repos/name

        # Strip .py
        if parts and parts[-1].endswith(".py"):
            parts[-1] = parts[-1][:-3]

        # Strip __init__
        if parts and parts[-1] == "__init__":
            parts = parts[:-1]

        # Generate all suffix variants
        variants = []
        for i in range(len(parts)):
            module = ".".join(parts[i:])
            if module:
                variants.append(module)

        return variants

    def _target_matches(
        self,
        target: str,
        module_names: list[str]
    ) -> bool:
        """Check if a dependency target matches any module variant."""

        for module in module_names:

            if (
                target == module
                or target.startswith(module + ".")
                or module.endswith("." + target)
                or target == module.split(".")[-1]
            ):
                return True

        return False

    def _same_file(
        self,
        file_a: str,
        file_b: str
    ) -> bool:
        """Check if two paths refer to the same file."""

        a = file_a.replace("\\", "/").lower()
        b = file_b.replace("\\", "/").lower()
        return a == b or a.endswith(b) or b.endswith(a)

    def _node_in_file(
        self,
        node: dict,
        file_path: str
    ) -> bool:
        """Check if a call graph node belongs to a file."""

        node_file = (
            node.get("file") or node.get("id", "")
        ).replace("\\", "/")

        target = file_path.replace("\\", "/")

        return (
            target in node_file
            or node_file.endswith(target)
        )

    def _build_layer_map(
        self,
        folder_data: dict
    ) -> dict:
        return {
            f["path"]: f["layer"]
            for f in folder_data.get("folders", [])
        }

    def _file_to_layer(
        self,
        file_path: str,
        folder_layer_map: dict
    ) -> str | None:

        if not file_path:
            return None

        normalized = file_path.replace("\\", "/")
        best = None
        best_len = 0

        for folder, layer in folder_layer_map.items():
            folder_norm = folder.replace("\\", "/")
            if (
                folder_norm in normalized
                and len(folder_norm) > best_len
            ):
                best = layer
                best_len = len(folder_norm)

        return best

    def _blast_radius(self, count: int) -> str:
        """
        Classify the blast radius by affected file count.
        """

        if count == 0:
            return "none"

        for threshold, label in reversed(
            BLAST_THRESHOLDS
        ):
            if count > threshold:
                return label

        return "critical"

    def _safe(self, fn, default):
        try:
            return fn()
        except Exception:
            return default
