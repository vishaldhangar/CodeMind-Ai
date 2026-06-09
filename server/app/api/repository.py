from fastapi import APIRouter

from app.schemas.repository import RepoImportRequest
from app.services.repo_service import RepoService

router = APIRouter()

repo_service = RepoService()


@router.post("/import")
def import_repository(
    request: RepoImportRequest
):
    path = repo_service.clone_repo(
        request.github_url
    )

    return {
        "status": "success",
        "path": path
    }