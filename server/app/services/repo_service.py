import shutil
from git import Repo
from pathlib import Path

from app.services.job_service import JobService


REPOS_DIR = Path("repositories")


class RepoService:

    # ──────────────────────────────────────────────────
    # Async import (background task)
    # ──────────────────────────────────────────────────

    def clone_repo_background(
        self,
        github_url: str,
        job_id: str
    ):
        """
        Clone a repository in the background.
        Called by FastAPI BackgroundTasks — runs after
        the HTTP response is already sent.
        Updates the job record throughout.
        """

        repo_name = self._repo_name(github_url)
        destination = REPOS_DIR / repo_name

        JobService.update(
            job_id,
            status="running",
            progress=f"Cloning {github_url} …"
        )

        try:

            if destination.exists():
                JobService.update(
                    job_id,
                    status="done",
                    progress="Already exists — skipped clone.",
                    result={
                        "repo_name": repo_name,
                        "path":      str(destination),
                        "skipped":   True
                    }
                )
                return

            REPOS_DIR.mkdir(parents=True, exist_ok=True)

            Repo.clone_from(github_url, destination)

            # Invalidate KG cache for this repo
            try:
                from app.services.knowledge_graph_service import (
                    KnowledgeGraphService
                )
                KnowledgeGraphService().invalidate_cache(
                    repo_name
                )
            except Exception:
                pass

            JobService.update(
                job_id,
                status="done",
                progress="Clone complete.",
                result={
                    "repo_name": repo_name,
                    "path":      str(destination),
                    "skipped":   False
                }
            )

        except Exception as exc:

            # Clean up partial clone
            if destination.exists():
                try:
                    shutil.rmtree(destination)
                except Exception:
                    pass

            JobService.update(
                job_id,
                status="failed",
                error=str(exc)
            )

    # ──────────────────────────────────────────────────
    # Repository management
    # ──────────────────────────────────────────────────

    def list_repos(self) -> list:
        """
        Return all repositories in the repositories/ dir.
        """

        if not REPOS_DIR.exists():
            return []

        repos = []

        for entry in sorted(REPOS_DIR.iterdir()):

            if not entry.is_dir():
                continue

            # Count files (skip .git internals)
            try:
                file_count = sum(
                    1 for f in entry.rglob("*")
                    if f.is_file()
                    and ".git" not in f.parts
                )
            except Exception:
                file_count = 0

            # Folder size in MB
            try:
                size_bytes = sum(
                    f.stat().st_size
                    for f in entry.rglob("*")
                    if f.is_file()
                    and ".git" not in f.parts
                )
                size_mb = round(size_bytes / 1_048_576, 2)
            except Exception:
                size_mb = 0.0

            # Detect if it is a git repo
            is_git = (entry / ".git").exists()

            repos.append({
                "name":       entry.name,
                "path":       str(entry),
                "file_count": file_count,
                "size_mb":    size_mb,
                "is_git_repo": is_git
            })

        return repos

    def get_repo_info(self, repo_name: str) -> dict | None:
        """
        Return info about a specific repo, or None if
        it does not exist.
        """

        path = REPOS_DIR / repo_name

        if not path.exists():
            return None

        try:
            file_count = sum(
                1 for f in path.rglob("*")
                if f.is_file()
                and ".git" not in f.parts
            )
        except Exception:
            file_count = 0

        try:
            size_bytes = sum(
                f.stat().st_size
                for f in path.rglob("*")
                if f.is_file()
                and ".git" not in f.parts
            )
            size_mb = round(size_bytes / 1_048_576, 2)
        except Exception:
            size_mb = 0.0

        # Language breakdown from extensions
        ext_counts: dict[str, int] = {}
        try:
            for f in path.rglob("*"):
                if (
                    f.is_file()
                    and ".git" not in f.parts
                    and f.suffix
                ):
                    ext = f.suffix.lower()
                    ext_counts[ext] = (
                        ext_counts.get(ext, 0) + 1
                    )
        except Exception:
            pass

        top_exts = sorted(
            ext_counts.items(),
            key=lambda x: -x[1]
        )[:8]

        return {
            "name":        repo_name,
            "path":        str(path),
            "file_count":  file_count,
            "size_mb":     size_mb,
            "is_git_repo": (path / ".git").exists(),
            "top_extensions": dict(top_exts)
        }

    def delete_repo(self, repo_name: str) -> bool:
        """
        Delete a cloned repository.
        Returns True if deleted, False if not found.
        """

        path = REPOS_DIR / repo_name

        if not path.exists():
            return False

        shutil.rmtree(path)

        # Invalidate KG cache
        try:
            from app.services.knowledge_graph_service import (
                KnowledgeGraphService
            )
            KnowledgeGraphService().invalidate_cache(
                repo_name
            )
        except Exception:
            pass

        return True

    # ──────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────

    def _repo_name(self, github_url: str) -> str:
        """
        Extract repo name from URL.
        Strips .git suffix if present.
        """
        name = github_url.rstrip("/").split("/")[-1]
        if name.endswith(".git"):
            name = name[:-4]
        return name