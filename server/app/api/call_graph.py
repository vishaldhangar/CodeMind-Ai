from fastapi import APIRouter

from app.services.call_graph_service import (
    CallGraphService
)

router = APIRouter()

service = CallGraphService()


@router.get("/{repo_name}")
def get_call_graph(repo_name: str):
    """
    Full function call graph for a repository.
    Returns all nodes (functions) and edges (calls).
    """
    return service.build(repo_name)


@router.get("/{repo_name}/function/{function_name}")
def get_function_calls(
    repo_name: str,
    function_name: str
):
    """
    What does a specific function call?
    Returns all outgoing call edges for the function.
    """
    return service.get_function_calls(
        repo_name,
        function_name
    )


@router.get("/{repo_name}/callers/{function_name}")
def get_callers(
    repo_name: str,
    function_name: str
):
    """
    Who calls a specific function?
    Returns all incoming call edges for the function.
    """
    return service.get_callers(
        repo_name,
        function_name
    )
