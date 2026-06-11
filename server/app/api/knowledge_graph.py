from fastapi import APIRouter, Query
from typing import Optional

from app.services.knowledge_graph_service import (
    KnowledgeGraphService
)

router = APIRouter()

service = KnowledgeGraphService()

VALID_NODE_TYPES = {
    "file", "class", "function", "module", "external"
}

VALID_EDGE_TYPES = {
    "contains", "imports", "calls", "inherits"
}


@router.get("/{repo_name}/summary")
def get_knowledge_graph_summary(repo_name: str):
    """
    Knowledge Graph overview — stats only, no node/edge list.

    Returns:
      - total_nodes, total_edges
      - breakdown by node type: file, class, function, module, external
      - breakdown by edge type: contains, imports, calls, inherits
      - top 10 most connected nodes
    """
    return service.get_summary(repo_name)


@router.get("/{repo_name}/nodes")
def get_nodes(
    repo_name: str,
    type: Optional[str] = Query(
        None,
        description=(
            "Filter by node type: "
            "file | class | function | module | external"
        )
    ),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """
    Paginated list of all Knowledge Graph nodes.
    Filter by type to narrow results.
    """
    node_type = type if type in VALID_NODE_TYPES else None
    return service.get_nodes(
        repo_name, node_type, limit, offset
    )


@router.get("/{repo_name}/node/{node_id:path}")
def get_node(repo_name: str, node_id: str):
    """
    Fetch a single node and its 1-hop neighbourhood.

    node_id examples:
      - file::app/services/auth_service.py
      - class::app/services/auth_service.py::AuthService
      - func::app/services/auth_service.py::login
      - module::fastapi
      - external::BaseModel
    """
    return service.get_node(repo_name, node_id)


@router.get("/{repo_name}/edges")
def get_edges(
    repo_name: str,
    type: Optional[str] = Query(
        None,
        description=(
            "Filter by edge type: "
            "contains | imports | calls | inherits"
        )
    ),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0)
):
    """
    Paginated list of all Knowledge Graph edges.
    Filter by type to see just imports, calls, etc.
    """
    edge_type = type if type in VALID_EDGE_TYPES else None
    return service.get_edges(
        repo_name, edge_type, limit, offset
    )


@router.get("/{repo_name}/search")
def search_nodes(
    repo_name: str,
    q: str = Query(
        ...,
        description="Search term (substring match on node name)"
    ),
    type: Optional[str] = Query(
        None,
        description="Optionally restrict to a node type"
    ),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Search the Knowledge Graph by name substring.

    Examples:
      /knowledge/my-repo/search?q=auth
      /knowledge/my-repo/search?q=login&type=function
      /knowledge/my-repo/search?q=User&type=class
    """
    node_type = type if type in VALID_NODE_TYPES else None
    return service.search_nodes(
        repo_name, q, node_type, limit
    )


@router.get("/{repo_name}/inheritance/{class_name}")
def get_inheritance_tree(
    repo_name: str,
    class_name: str
):
    """
    Full inheritance chain for a class.

    Returns:
      - ancestors: classes/externals this class inherits from
      - descendants: classes that inherit from this class
    """
    return service.get_inheritance_tree(
        repo_name, class_name
    )


@router.post("/{repo_name}/invalidate-cache")
def invalidate_cache(repo_name: str):
    """
    Invalidate the cached knowledge graph for a repo.
    Forces a full rebuild on the next request.
    """
    service.invalidate_cache(repo_name)
    return {
        "repository": repo_name,
        "message": "Cache invalidated. "
                   "Graph will be rebuilt on next request."
    }
