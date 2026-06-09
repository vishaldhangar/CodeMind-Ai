from fastapi import APIRouter

from app.services.dependency_service import (
    DependencyService
)

router = APIRouter()

service = DependencyService()


@router.get("/{repo_name}")
def get_dependencies(
    repo_name: str
):

    return service.get_dependencies(
        repo_name
    )