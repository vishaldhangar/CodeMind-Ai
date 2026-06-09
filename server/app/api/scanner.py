from fastapi import APIRouter

from app.services.scanner_service import (
    ScannerService
)

router = APIRouter()

scanner = ScannerService()


@router.get("/{repo_name}")
def scan_repository(
    repo_name: str
):

    repo_path = (
        f"repositories/{repo_name}"
    )

    return scanner.scan_repository(
        repo_path
    )