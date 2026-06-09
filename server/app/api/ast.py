from fastapi import APIRouter

from app.services.ast_service import (
    ASTService
)

router = APIRouter()

service = ASTService()


@router.get("/{repo_name}")
def parse_repo(
    repo_name: str
):
    return service.parse_repository(
        repo_name
    )