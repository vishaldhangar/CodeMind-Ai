from fastapi import APIRouter

from app.services.dependency_analytics_service import (
    DependencyAnalyticsService
)

router = APIRouter()

service = (
    DependencyAnalyticsService()
)


@router.get("/{repo_name}/summary")
def dependency_summary(
    repo_name: str
):

    return service.get_summary(
        repo_name
    )