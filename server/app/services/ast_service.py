from pathlib import Path

from app.parsers.python_parser import (
    PythonParser
)


class ASTService:

    def parse_repository(
        self,
        repo_name: str
    ):

        repo_path = (
            Path("repositories")
            / repo_name
        )

        parser = PythonParser()

        files = []

        for py_file in repo_path.rglob("*.py"):

            try:

                symbols = parser.extract_symbols(
                    str(py_file)
                )

                files.append({
                    "file": str(py_file),
                    **symbols
                })

            except Exception:
                continue

        return files