from app.services.ast_service import (
    ASTService
)

from app.graph.dependency_graph import (
    DependencyGraphBuilder
)

from app.services.package_registry_service import (
    PackageRegistryService
)


class DependencyService:

    def get_dependencies(
        self,
        repo_name: str
    ):

        ast_service = ASTService()

        parsed_files = (
            ast_service.parse_repository(
                repo_name
            )
        )

        registry_service = (
            PackageRegistryService()
        )

        package_registry = (
            registry_service.build_registry(
                repo_name
            )
        )

        graph_builder = (
            DependencyGraphBuilder()
        )

        graph = (
            graph_builder.build_graph(
                parsed_files,
                package_registry
            )
        )

        edges = []

        internal_count = 0
        external_count = 0

        for source, target, data in graph.edges(
            data=True
        ):

            dependency_type = data[
                "dependency_type"
            ]

            if dependency_type == "internal":
                internal_count += 1
            else:
                external_count += 1

            edges.append({
                "source": source,
                "target": target,
                "type": dependency_type
            })

        return {
            "nodes": graph.number_of_nodes(),
            "edges": graph.number_of_edges(),
            "internal_edges": internal_count,
            "external_edges": external_count,
            "dependencies": edges
        }