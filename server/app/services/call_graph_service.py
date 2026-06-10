from app.services.ast_service import ASTService
from app.graph.call_graph import CallGraphBuilder


class CallGraphService:

    def build(self, repo_name: str) -> dict:

        ast_service = ASTService()

        parsed_files = (
            ast_service.parse_repository(repo_name)
        )

        builder = CallGraphBuilder()
        graph = builder.build_graph(parsed_files)

        nodes = []

        for node_id, data in graph.nodes(data=True):

            nodes.append({
                "id": node_id,
                "file": data.get("file"),
                "function": data.get("function"),
                "type": data.get(
                    "node_type", "function"
                )
            })

        edges = []

        for caller, callee, data in graph.edges(
            data=True
        ):

            edges.append({
                "caller": caller,
                "callee": callee,
                "resolution": data.get(
                    "resolution", "unknown"
                )
            })

        internal_edges = [
            e for e in edges
            if e["resolution"] == "internal"
        ]

        external_edges = [
            e for e in edges
            if e["resolution"] == "external"
        ]

        internal_nodes = [
            n for n in nodes
            if n["type"] == "function"
        ]

        return {
            "repository": repo_name,
            "total_functions": len(internal_nodes),
            "total_internal_calls": len(internal_edges),
            "total_external_calls": len(external_edges),
            "nodes": nodes,
            "edges": edges
        }

    def get_function_calls(
        self,
        repo_name: str,
        function_name: str
    ) -> dict:
        """What does this function call?"""

        data = self.build(repo_name)

        calls = [
            edge for edge in data["edges"]
            if function_name in edge["caller"]
        ]

        return {
            "repository": repo_name,
            "function": function_name,
            "calls": calls,
            "total": len(calls)
        }

    def get_callers(
        self,
        repo_name: str,
        function_name: str
    ) -> dict:
        """Who calls this function?"""

        data = self.build(repo_name)

        callers = [
            edge for edge in data["edges"]
            if (
                function_name in edge["callee"]
                and edge["resolution"] == "internal"
            )
        ]

        return {
            "repository": repo_name,
            "function": function_name,
            "called_by": callers,
            "total": len(callers)
        }
