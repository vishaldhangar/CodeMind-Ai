from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.schemas.repository import RepoImportRequest
from app.services.repo_service import RepoService
from app.services.job_service import JobService

router       = APIRouter()
repo_service = RepoService()


# ── Import (async) ────────────────────────────────────

@router.post("/import")
def import_repository(
    request: RepoImportRequest,
    background_tasks: BackgroundTasks
):
    """
    Start an async repository clone.

    Returns a job_id immediately.
    Poll GET /repo/import/status/{job_id} for progress.
    """

    repo_name = request.github_url.rstrip(
        "/"
    ).split("/")[-1].replace(".git", "")

    job_id = JobService.create(
        "repo_import",
        {
            "github_url": request.github_url,
            "repo_name":  repo_name
        }
    )

    background_tasks.add_task(
        repo_service.clone_repo_background,
        request.github_url,
        job_id
    )

    return {
        "status":   "started",
        "job_id":   job_id,
        "repo_name": repo_name,
        "message": (
            f"Import started. "
            f"Poll /repo/import/status/{job_id}"
        )
    }


@router.get("/import/status/{job_id}")
def import_status(job_id: str):
    """
    Poll the status of a repository import job.

    Statuses: pending | running | done | failed
    """

    job = JobService.get(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found."
        )

    return job


# ── Repository management ─────────────────────────────

@router.get("/list")
def list_repositories():
    """
    List all imported repositories with metadata
    (file count, size in MB, git status).
    """

    return {
        "repositories": repo_service.list_repos(),
        "total": len(repo_service.list_repos())
    }


@router.get("/{repo_name}/info")
def get_repo_info(repo_name: str):
    """
    Detailed info about a specific repository:
    file count, size, top file extensions.
    """

    info = repo_service.get_repo_info(repo_name)

    if not info:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repo_name}' not found."
        )

    return info


@router.delete("/{repo_name}")
def delete_repository(repo_name: str):
    """
    Permanently delete a cloned repository.
    Also invalidates the Knowledge Graph cache.
    """

    deleted = repo_service.delete_repo(repo_name)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Repository '{repo_name}' not found."
        )

    return {
        "status":  "deleted",
        "repo_name": repo_name,
        "message": (
            f"Repository '{repo_name}' deleted "
            f"and cache invalidated."
        )
    }


# ── Jobs ─────────────────────────────────────────────

@router.get("/jobs")
def list_jobs():
    """
    List all background jobs (most recent first).
    """
    return {
        "jobs":  JobService.all(),
        "total": len(JobService.all())
    }