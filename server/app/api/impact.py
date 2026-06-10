from fastapi import APIRouter, Query

from app.services.impact_analysis_service import (
    ImpactAnalysisService
)

router = APIRouter()

service = ImpactAnalysisService()


@router.get("/{repo_name}/file")
def analyze_file_impact(
    repo_name: str,
    path: str = Query(
        ...,
        description=(
            "File path relative to the repo root. "
            "e.g. app/services/auth_service.py"
        )
    )
):
    """
    What breaks if this FILE changes?

    Returns:
      - blast_radius: none / low / medium / high / critical
      - direct_dependents: files that directly import it
      - transitive_dependents: files that transitively depend on it
      - affected_functions: functions in other files that call into it
      - affected_workflows: HTTP flows that pass through it
      - affected_layers: architectural layers touched
    """
    return service.analyze_file(repo_name, path)


@router.get("/{repo_name}/function/{function_name}")
def analyze_function_impact(
    repo_name: str,
    function_name: str
):
    """
    What breaks if this FUNCTION changes?

    Returns:
      - blast_radius
      - direct_callers: functions that call this function
      - affected_workflows: HTTP flows that invoke this function
      - affected_layers: architectural layers touched
    """
    return service.analyze_function(
        repo_name,
        function_name
    )
