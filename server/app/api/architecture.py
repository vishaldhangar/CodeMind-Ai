from fastapi import APIRouter

from app.services.architecture_service import (
    ArchitectureService
)

router = APIRouter()

service = ArchitectureService()


@router.get("/{repo_name}")
def architecture(
    repo_name: str
):
    return service.get_architecture(
        repo_name
    )