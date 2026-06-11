import networkx as nx

from app.services.ast_service import ASTService
from app.services.dependency_service import DependencyService
from app.services.call_graph_service import CallGraphService
from app.graph.knowledge_graph import KnowledgeGraphBuilder


class KnowledgeGraphService:
    """
    Orchestrates building and querying the Knowledge Graph.

    Caches the built graph per repository to avoid
    rebuilding on every API call.
    """

    _cache: dict[str, nx.MultiDiGraph] = {}

    # ──────────────────────────────────────────────────
    # Graph construction
    # ──────────────────────────────────────────────────

    def build(self, repo_name: str) -> nx.MultiDiGraph:
        """
        Build (or return cached) knowledge graph
        for the repository.
        """

        if repo_name in self._cache:
            return self._cache[repo_name]

        parsed_files = self._safe(
            lambda: ASTService().parse_repository(
                repo_name
            ),
            []
        )

        dep_data = self._safe(
            lambda: DependencyService(
            ).get_dependencies(repo_name),
            {"dependencies": []}
        )

        cg_data = self._safe(
            lambda: CallGraphService().build(repo_name),
            {"nodes": [], "edges": []}
        )

        graph = KnowledgeGraphBuilder().build(
            parsed_files, dep_data, cg_data
        )

        self._cache[repo_name] = graph

        return graph

    # ──────────────────────────────────────────────────
    # Public query methods
    # ──────────────────────────────────────────────────

    def get_summary(self, repo_name: str) -> dict:
        """
        High-level statistics about the Knowledge Graph.
        Lightweight — does not serialize nodes/edges.
        """

        graph = self.build(repo_name)

        node_type_counts: dict[str, int] = {}
        edge_type_counts: dict[str, int] = {}

        for _, data in graph.nodes(data=True):
            t = data.get("node_type", "unknown")
            node_type_counts[t] = (
                node_type_counts.get(t, 0) + 1
            )

        for _, _, data in graph.edges(data=True):
            t = data.get("edge_type", "unknown")
            edge_type_counts[t] = (
                edge_type_counts.get(t, 0) + 1
            )

        # Top 10 most-connected nodes (by degree)
        top_nodes = sorted(
            [
                {
                    "id": n,
                    "name": graph.nodes[n].get("name", n),
                    "type": graph.nodes[n].get(
                        "node_type", "unknown"
                    ),
                    "degree": graph.degree(n)
                }
                for n in graph.nodes
            ],
            key=lambda x: -x["degree"]
        )[:10]

        return {
            "repository": repo_name,
            "total_nodes": graph.number_of_nodes(),
            "total_edges": graph.number_of_edges(),
            "node_types": node_type_counts,
            "edge_types": edge_type_counts,
            "top_connected_nodes": top_nodes
        }

    def get_nodes(
        self,
        repo_name: str,
        node_type: str | None = None,
        limit: int = 100,
        offset: int = 0
    ) -> dict:
        """
        Paginated list of knowledge graph nodes.
        Optionally filter by node_type.
        """

        graph = self.build(repo_name)

        nodes = []

        for node_id, data in graph.nodes(data=True):

            if (
                node_type
                and data.get("node_type") != node_type
            ):
                continue

            nodes.append({
                "id":       node_id,
                "type":     data.get("node_type"),
                "name":     data.get("name"),
                "file":     data.get("file"),
                "line":     data.get("line"),
                "is_method": data.get("is_method"),
                "bases":    data.get("bases"),
                "method_count": data.get("method_count"),
                "in_degree":  graph.in_degree(node_id),
                "out_degree": graph.out_degree(node_id)
            })

        total = len(nodes)
        page  = nodes[offset: offset + limit]

        return {
            "repository": repo_name,
            "total":      total,
            "offset":     offset,
            "limit":      limit,
            "nodes":      page
        }

    def get_node(
        self,
        repo_name: str,
        node_id: str
    ) -> dict:
        """
        Fetch a single node and its immediate
        neighbourhood (1-hop predecessors + successors).
        Normalizes path separators so / and \\ both work.
        """

        graph = self.build(repo_name)

        # Try exact match first, then path-separator variants
        resolved_id = None

        if node_id in graph:
            resolved_id = node_id
        else:
            # Try swapping separators
            alt = node_id.replace("/", "\\")
            if alt in graph:
                resolved_id = alt
            else:
                alt2 = node_id.replace("\\", "/")
                if alt2 in graph:
                    resolved_id = alt2

        if resolved_id is None:
            return {
                "error": f"Node '{node_id}' not found",
                "repository": repo_name,
                "hint": (
                    "Use /knowledge/{repo}/search?q=name "
                    "to find the correct node ID"
                )
            }

        node_id = resolved_id
        data = dict(graph.nodes[node_id])

        # Outgoing edges (what this node points to)
        outgoing = []
        for _, target, edata in graph.out_edges(
            node_id, data=True
        ):
            outgoing.append({
                "target":     target,
                "target_name": graph.nodes[target].get(
                    "name", target
                ),
                "target_type": graph.nodes[target].get(
                    "node_type"
                ),
                "edge_type":  edata.get("edge_type")
            })

        # Incoming edges (what points to this node)
        incoming = []
        for source, _, edata in graph.in_edges(
            node_id, data=True
        ):
            incoming.append({
                "source":     source,
                "source_name": graph.nodes[source].get(
                    "name", source
                ),
                "source_type": graph.nodes[source].get(
                    "node_type"
                ),
                "edge_type":  edata.get("edge_type")
            })

        return {
            "repository":   repo_name,
            "id":           node_id,
            "type":         data.get("node_type"),
            "name":         data.get("name"),
            "file":         data.get("file"),
            "line":         data.get("line"),
            "properties":   {
                k: v for k, v in data.items()
                if k not in (
                    "node_type", "name",
                    "file", "line"
                )
            },
            "in_degree":    graph.in_degree(node_id),
            "out_degree":   graph.out_degree(node_id),
            "outgoing":     outgoing,
            "incoming":     incoming
        }

    def get_edges(
        self,
        repo_name: str,
        edge_type: str | None = None,
        limit: int = 200,
        offset: int = 0
    ) -> dict:
        """
        Paginated list of knowledge graph edges.
        Optionally filter by edge_type
        (contains / imports / calls / inherits).
        """

        graph = self.build(repo_name)

        edges = []

        for source, target, edata in graph.edges(
            data=True
        ):

            et = edata.get("edge_type", "unknown")

            if edge_type and et != edge_type:
                continue

            edges.append({
                "source":      source,
                "source_name": graph.nodes[source].get(
                    "name", source
                ),
                "target":      target,
                "target_name": graph.nodes[target].get(
                    "name", target
                ),
                "edge_type":   et
            })

        total = len(edges)
        page  = edges[offset: offset + limit]

        return {
            "repository": repo_name,
            "total":      total,
            "offset":     offset,
            "limit":      limit,
            "edge_type":  edge_type,
            "edges":      page
        }

    def search_nodes(
        self,
        repo_name: str,
        query: str,
        node_type: str | None = None,
        limit: int = 20
    ) -> dict:
        """
        Search nodes by name substring.
        """

        graph = self.build(repo_name)
        query_lower = query.lower()

        results = []

        for node_id, data in graph.nodes(data=True):

            if (
                node_type
                and data.get("node_type") != node_type
            ):
                continue

            name = data.get("name", "").lower()

            if query_lower in name:
                results.append({
                    "id":        node_id,
                    "type":      data.get("node_type"),
                    "name":      data.get("name"),
                    "file":      data.get("file"),
                    "in_degree":  graph.in_degree(node_id),
                    "out_degree": graph.out_degree(node_id)
                })

        # Sort by relevance: exact match > starts with > contains
        def score(item):
            n = item["name"].lower()
            if n == query_lower:
                return 0
            if n.startswith(query_lower):
                return 1
            return 2

        results.sort(key=score)

        return {
            "repository": repo_name,
            "query":      query,
            "total":      len(results),
            "results":    results[:limit]
        }

    def get_inheritance_tree(
        self,
        repo_name: str,
        class_name: str
    ) -> dict:
        """
        Return the full inheritance chain for a class:
        - ancestors (what it inherits from)
        - descendants (what inherits from it)
        """

        graph = self.build(repo_name)

        # Find the class node
        class_nodes = [
            n for n, d in graph.nodes(data=True)
            if (
                d.get("node_type") == "class"
                and d.get("name") == class_name
            )
        ]

        if not class_nodes:
            return {
                "error": (
                    f"Class '{class_name}' not found"
                ),
                "repository": repo_name
            }

        class_id = class_nodes[0]

        # Ancestors: follow 'inherits' edges upward
        ancestors = []
        self._collect_ancestors(
            graph, class_id, ancestors, set()
        )

        # Descendants: reverse inherits edges
        descendants = []
        self._collect_descendants(
            graph, class_id, descendants, set()
        )

        return {
            "repository":  repo_name,
            "class":       class_name,
            "node_id":     class_id,
            "ancestors":   ancestors,
            "descendants": descendants
        }

    # ──────────────────────────────────────────────────
    # Inheritance tree helpers
    # ──────────────────────────────────────────────────

    def _collect_ancestors(
        self,
        graph: nx.MultiDiGraph,
        node_id: str,
        result: list,
        visited: set,
        depth: int = 1
    ):
        for _, target, edata in graph.out_edges(
            node_id, data=True
        ):
            if edata.get("edge_type") != "inherits":
                continue
            if target in visited:
                continue
            visited.add(target)
            result.append({
                "id":    target,
                "name":  graph.nodes[target].get("name"),
                "type":  graph.nodes[target].get(
                    "node_type"
                ),
                "depth": depth
            })
            self._collect_ancestors(
                graph, target, result,
                visited, depth + 1
            )

    def _collect_descendants(
        self,
        graph: nx.MultiDiGraph,
        node_id: str,
        result: list,
        visited: set,
        depth: int = 1
    ):
        for source, _, edata in graph.in_edges(
            node_id, data=True
        ):
            if edata.get("edge_type") != "inherits":
                continue
            if source in visited:
                continue
            visited.add(source)
            result.append({
                "id":    source,
                "name":  graph.nodes[source].get("name"),
                "type":  graph.nodes[source].get(
                    "node_type"
                ),
                "depth": depth
            })
            self._collect_descendants(
                graph, source, result,
                visited, depth + 1
            )

    # ──────────────────────────────────────────────────
    # Cache management
    # ──────────────────────────────────────────────────

    def invalidate_cache(self, repo_name: str):
        """Force graph rebuild on next request."""
        self._cache.pop(repo_name, None)

    # ──────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────

    def _safe(self, fn, default):
        try:
            return fn()
        except Exception:
            return default
