from git import Repo
from pathlib import Path


class RepoService:

    def clone_repo(self, github_url: str):

        repo_name = github_url.split("/")[-1]

        destination = Path("repositories") / repo_name

        if destination.exists():
            return str(destination)

        Repo.clone_from(
            github_url,
            destination
        )

        return str(destination)