import networkx as nx


class DependencyGraphBuilder:

    def build_graph(
        self,
        parsed_files: list,
        package_registry: set
    ):

        graph = nx.DiGraph()

        for file_data in parsed_files:

            source = file_data["file"]

            graph.add_node(source)

            for imp in file_data["imports"]:

                module = (
                    imp.get("full_import")
                    or imp["module"]
                )

                module_parts = module.split(".")

                resolved_module = module

                # Resolve internal modules
                for i in range(
                    len(module_parts),
                    0,
                    -1
                ):

                    candidate = ".".join(
                        module_parts[:i]
                    )

                    if candidate in package_registry:

                        resolved_module = candidate
                        break

                # Normalize external imports
                if (
                    resolved_module == module
                    and "." in module
                ):

                    resolved_module = (
                        module.split(".")[0]
                    )

                dependency_type = (
                    "internal"
                    if any(
                        resolved_module == pkg
                        or resolved_module.startswith(
                            f"{pkg}."
                        )
                        for pkg in package_registry
                    )
                    else "external"
                )

                graph.add_edge(
                    source,
                    resolved_module,
                    dependency_type=dependency_type
                )

        return graph