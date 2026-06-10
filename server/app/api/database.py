from fastapi import APIRouter

from app.services.database_detection_service import (
    DatabaseDetectionService
)

router = APIRouter()

service = DatabaseDetectionService()


@router.get("/{repo_name}")
def get_database_info(repo_name: str):
    """
    Detect databases, ORMs and data models used
    in a repository.

    Sources checked:
      - requirements.txt / pyproject.toml (Python)
      - AST import scan (Python)
      - package.json (Node.js)
      - prisma/schema.prisma
    """
    return service.detect_databases(repo_name)
