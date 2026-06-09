from pathlib import Path


class ScannerService:

    def scan_repository(self, repo_path: str):

        repo = Path(repo_path)

        total_files = 0
        total_lines = 0

        languages = {}

        for file in repo.rglob("*"):

            if not file.is_file():
                continue

            total_files += 1

            extension = file.suffix.lower()

            languages[extension] = (
                languages.get(extension, 0) + 1
            )

            try:
                with open(
                    file,
                    "r",
                    encoding="utf-8",
                    errors="ignore"
                ) as f:

                    total_lines += len(
                        f.readlines()
                    )

            except:
                pass

        return {
            "repository": repo.name,
            "total_files": total_files,
            "total_lines": total_lines,
            "languages": languages
        }