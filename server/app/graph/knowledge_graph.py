import networkx as nx


# ── Node type constants ───────────────────────────────
NODE_FILE     = "file"
NODE_CLASS    = "class"
NODE_FUNCTION = "function"
NODE_MODULE   = "module"
NODE_EXTERNAL = "external"

# ── Edge type constants ───────────────────────────────
EDGE_CONTAINS = "contains"   # file→class, file→fn, class→method
EDGE_IMPORTS  = "imports"    # file→module/external
EDGE_CALLS    = "calls"      # function→function
EDGE_INHERITS = "inherits"   # class→class/external


class KnowledgeGraphBuilder:
    """
    Builds the repository-wide Knowledge Graph.

    Unified node ID scheme:
      file::      {file_path}
      class::     {file_path}::{class_name}
      func::      {file_path}::{fn_name}
      module::    {module_name}
      external::  {name}

    Edge types:
      contains  — file→class, file→fn, class→method
      imports   — file→module or external
      calls     — func→func / func→external
      inherits  — class→class or external base
    """

    def build(
        self,
        parsed_files: list,
        dep_data: dict,
        cg_data: dict
    ) -> nx.MultiDiGraph:
        """
        Build and return the full knowledge graph.

        Parameters
        ----------
        parsed_files : output of ASTService.parse_repository()
        dep_data     : output of DependencyService.get_dependencies()
        cg_data      : output of CallGraphService.build()
        """

        graph = nx.MultiDiGraph()

        # class_name → node_id (for inheritance resolution)
        class_registry: dict[str, str] = {}

        self._add_ast_nodes(
            graph, parsed_files, class_registry
        )
        self._add_import_edges(graph, dep_data)
        self._add_call_edges(graph, cg_data)
        self._add_inheritance_edges(
            graph, class_registry
        )

        return graph

    # ──────────────────────────────────────────────────
    # Step 1 — AST nodes + containment edges
    # ──────────────────────────────────────────────────

    def _add_ast_nodes(
        self,
        graph: nx.MultiDiGraph,
        parsed_files: list,
        class_registry: dict
    ):

        for file_data in parsed_files:

            file_path = file_data["file"]
            file_id   = f"file::{file_path}"
            file_name = (
                file_path.replace("\\", "/")
                          .split("/")[-1]
            )

            # ── File node ─────────────────────────────
            graph.add_node(
                file_id,
                node_type=NODE_FILE,
                name=file_name,
                file=file_path
            )

            # Collect method names for this file so we
            # can mark standalone vs method functions
            class_method_names: set[str] = set()
            for cls in file_data.get("classes", []):
                for m in cls.get("methods", []):
                    class_method_names.add(m)

            # ── Class nodes ───────────────────────────
            for cls in file_data.get("classes", []):

                cls_id = (
                    f"class::{file_path}::{cls['name']}"
                )

                graph.add_node(
                    cls_id,
                    node_type=NODE_CLASS,
                    name=cls["name"],
                    file=file_path,
                    line=cls.get("line"),
                    bases=cls.get("bases", []),
                    method_count=len(
                        cls.get("methods", [])
                    )
                )

                # file CONTAINS class
                graph.add_edge(
                    file_id, cls_id,
                    edge_type=EDGE_CONTAINS
                )

                # Register for inheritance resolution
                class_registry[cls["name"]] = cls_id

                # ── Method nodes ──────────────────────
                for method_name in cls.get(
                    "methods", []
                ):
                    method_id = (
                        f"func::{file_path}"
                        f"::{method_name}"
                    )

                    if method_id not in graph:
                        graph.add_node(
                            method_id,
                            node_type=NODE_FUNCTION,
                            name=method_name,
                            file=file_path,
                            is_method=True,
                            class_name=cls["name"]
                        )

                    # class CONTAINS method
                    graph.add_edge(
                        cls_id, method_id,
                        edge_type=EDGE_CONTAINS
                    )

            # ── Standalone function nodes ─────────────
            for fn in file_data.get("functions", []):

                if fn["name"] in class_method_names:
                    continue  # handled above

                fn_id = (
                    f"func::{file_path}::{fn['name']}"
                )

                if fn_id not in graph:
                    graph.add_node(
                        fn_id,
                        node_type=NODE_FUNCTION,
                        name=fn["name"],
                        file=file_path,
                        line=fn.get("line"),
                        is_method=False
                    )

                # file CONTAINS function
                graph.add_edge(
                    file_id, fn_id,
                    edge_type=EDGE_CONTAINS
                )

    # ──────────────────────────────────────────────────
    # Step 2 — Import edges
    # ──────────────────────────────────────────────────

    def _add_import_edges(
        self,
        graph: nx.MultiDiGraph,
        dep_data: dict
    ):

        for edge in dep_data.get("dependencies", []):

            source_file   = edge["source"]
            target_module = edge["target"]
            dep_type      = edge["type"]

            source_id = f"file::{source_file}"

            if source_id not in graph:
                continue

            if dep_type == "internal":
                target_id = f"module::{target_module}"
                node_type = NODE_MODULE
            else:
                target_id = f"external::{target_module}"
                node_type = NODE_EXTERNAL

            if target_id not in graph:
                graph.add_node(
                    target_id,
                    node_type=node_type,
                    name=target_module
                )

            graph.add_edge(
                source_id, target_id,
                edge_type=EDGE_IMPORTS,
                module=target_module
            )

    # ──────────────────────────────────────────────────
    # Step 3 — Call edges
    # ──────────────────────────────────────────────────

    def _add_call_edges(
        self,
        graph: nx.MultiDiGraph,
        cg_data: dict
    ):
        """
        Call graph node IDs are  "file_path::fn_name".
        Knowledge graph IDs are  "func::file_path::fn_name".

        External nodes are already "external::name".
        """

        for edge in cg_data.get("edges", []):

            raw_caller = edge["caller"]
            raw_callee = edge["callee"]
            resolution = edge.get("resolution", "unknown")

            caller_id = self._cg_to_kg_id(raw_caller)
            callee_id = self._cg_to_kg_id(raw_callee)

            # Ensure external callee node exists
            if (
                callee_id.startswith("external::")
                and callee_id not in graph
            ):
                name = callee_id.replace("external::", "")
                graph.add_node(
                    callee_id,
                    node_type=NODE_EXTERNAL,
                    name=name
                )

            if (
                caller_id in graph
                and callee_id in graph
            ):
                graph.add_edge(
                    caller_id, callee_id,
                    edge_type=EDGE_CALLS,
                    resolution=resolution
                )

    # ──────────────────────────────────────────────────
    # Step 4 — Inheritance edges
    # ──────────────────────────────────────────────────

    def _add_inheritance_edges(
        self,
        graph: nx.MultiDiGraph,
        class_registry: dict
    ):

        for cls_id, data in list(graph.nodes(data=True)):

            if data.get("node_type") != NODE_CLASS:
                continue

            for base_name in data.get("bases", []):

                # Try to resolve to a known class
                if base_name in class_registry:
                    base_id = class_registry[base_name]
                else:
                    # External base (e.g. BaseModel, SQLModel)
                    base_id = f"external::{base_name}"

                    if base_id not in graph:
                        graph.add_node(
                            base_id,
                            node_type=NODE_EXTERNAL,
                            name=base_name
                        )

                graph.add_edge(
                    cls_id, base_id,
                    edge_type=EDGE_INHERITS
                )

    # ──────────────────────────────────────────────────
    # Utility
    # ──────────────────────────────────────────────────

    def _cg_to_kg_id(self, raw_id: str) -> str:
        """
        Convert a call-graph node ID to a knowledge
        graph node ID.

        "repositories/fastapi/fastapi/routing.py::route"
            → "func::repositories/fastapi/fastapi/routing.py::route"

        "external::append"
            → "external::append"
        """

        if raw_id.startswith("external::"):
            return raw_id

        if "::" in raw_id:
            return f"func::{raw_id}"

        return raw_id
