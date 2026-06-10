import networkx as nx


class CallGraphBuilder:

    def build_graph(
        self,
        parsed_files: list
    ) -> nx.DiGraph:

        graph = nx.DiGraph()

        # Step 1: Build function definition index
        # Maps function_name → list of qualified ids
        # qualified id format:  "file_path::function_name"
        fn_index: dict[str, list[str]] = {}

        for file_data in parsed_files:

            file_path = file_data["file"]

            for fn in file_data.get("functions", []):

                fn_name = fn["name"]
                qualified = f"{file_path}::{fn_name}"

                graph.add_node(
                    qualified,
                    file=file_path,
                    function=fn_name,
                    node_type="function"
                )

                fn_index.setdefault(
                    fn_name, []
                ).append(qualified)

        # Step 2: Build per-file import resolution map
        # Maps:  file_path → {imported_name → qualified_id}
        import_map: dict[str, dict[str, str]] = {}

        for file_data in parsed_files:

            file_path = file_data["file"]
            import_map[file_path] = {}

            for imp in file_data.get("imports", []):

                imported_name = imp.get(
                    "imported_name"
                )

                if (
                    imported_name
                    and imported_name in fn_index
                ):
                    # Take the first match
                    # (multiple definitions = ambiguous)
                    import_map[file_path][
                        imported_name
                    ] = fn_index[imported_name][0]

        # Step 3: Add call edges
        for file_data in parsed_files:

            file_path = file_data["file"]
            function_calls = file_data.get(
                "function_calls", {}
            )

            for caller_name, callees in (
                function_calls.items()
            ):

                caller_qualified = (
                    f"{file_path}::{caller_name}"
                )

                if caller_qualified not in graph:
                    continue

                for callee_name in callees:

                    resolved = self._resolve(
                        callee_name,
                        file_path,
                        import_map,
                        fn_index
                    )

                    if resolved["type"] == "internal":

                        target = resolved["id"]

                        if target not in graph:
                            graph.add_node(
                                target,
                                node_type="function"
                            )

                        graph.add_edge(
                            caller_qualified,
                            target,
                            resolution="internal"
                        )

                    else:

                        ext_id = (
                            f"external::{callee_name}"
                        )

                        if ext_id not in graph:
                            graph.add_node(
                                ext_id,
                                function=callee_name,
                                node_type="external"
                            )

                        graph.add_edge(
                            caller_qualified,
                            ext_id,
                            resolution="external"
                        )

        return graph

    def _resolve(
        self,
        callee_name: str,
        caller_file: str,
        import_map: dict,
        fn_index: dict
    ) -> dict:
        """
        Try to resolve a callee name to a qualified id.
        Priority:
          1. Directly imported in this file
          2. Defined in the same file
          3. Unambiguous global match (only one definition)
          4. External (library call)
        """

        # 1. Check import map for this file
        file_imports = import_map.get(caller_file, {})

        if callee_name in file_imports:
            return {
                "type": "internal",
                "id": file_imports[callee_name]
            }

        # 2. Same-file definition
        same_file_candidates = [
            q for q in fn_index.get(callee_name, [])
            if q.startswith(caller_file + "::")
        ]

        if same_file_candidates:
            return {
                "type": "internal",
                "id": same_file_candidates[0]
            }

        # 3. Unambiguous global match
        global_candidates = fn_index.get(
            callee_name, []
        )

        if len(global_candidates) == 1:
            return {
                "type": "internal",
                "id": global_candidates[0]
            }

        # 4. External / ambiguous
        return {"type": "external", "id": None}
