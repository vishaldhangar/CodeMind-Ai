from fastapi import APIRouter

from app.services.route_detection_service import (
    RouteDetectionService
)

router = APIRouter()

service = RouteDetectionService()


@router.get("/{repo_name}")
def get_routes(repo_name: str):
    """
    Detect all HTTP routes in a repository.

    Returns:
      - Python routes via AST (FastAPI, Flask, Django)
      - Next.js routes via filesystem conventions
      - Express.js routes via regex scanning
    """
    return service.detect_routes(repo_name)
