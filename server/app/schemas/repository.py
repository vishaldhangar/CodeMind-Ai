from pydantic import BaseModel


class RepoImportRequest(BaseModel):
    github_url: str