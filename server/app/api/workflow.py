from fastapi import APIRouter

from app.services.workflow_service import (
    WorkflowService
)

router = APIRouter()

service = WorkflowService()


@router.get("/{repo_name}")
def get_workflows(repo_name: str):
    """
    Trace execution flows for every detected HTTP
    route in the repository.

    Each workflow shows:
      - Entry point (method + path + handler)
      - Full call tree from handler to terminal calls
      - Depth, total steps, DB involvement
      - Architectural layers touched
    """
    return service.get_workflows(repo_name)


@router.get("/{repo_name}/function/{function_name}")
def get_function_workflow(
    repo_name: str,
    function_name: str
):
    """
    Trace the execution flow starting from any
    specific function (not just HTTP handlers).

    Useful for:
      - Background tasks
      - Event handlers
      - Any internal function you want to inspect
    """
    return service.get_workflow_for_function(
        repo_name,
        function_name
    )
