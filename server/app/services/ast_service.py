from pathlib import Path

from app.parsers.python_parser import PythonParser
from app.parsers.js_ts_parser import JsTsParser


_JS_TS_EXTS = {'.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'}

_SKIP_DIRS = {
    'node_modules', '.git', '.next', 'dist', 'build',
    'out', '__pycache__', '.venv', 'venv', 'env',
    '.mypy_cache', 'coverage', '.turbo', '.cache',
}


class ASTService:

    def parse_repository(self, repo_name: str) -> list[dict]:
        repo_path = Path("repositories") / repo_name
        py_parser = PythonParser()
        js_parser = JsTsParser()
        files: list[dict] = []

        for file in repo_path.rglob("*"):
            if not file.is_file():
                continue

            # Skip unwanted directories (node_modules, .git, dist, etc.)
            if _SKIP_DIRS.intersection(set(file.parts)):
                continue

            ext = file.suffix.lower()

            try:
                if ext == '.py':
                    symbols = py_parser.extract_symbols(str(file))
                elif ext in _JS_TS_EXTS:
                    symbols = js_parser.extract_symbols(str(file))
                else:
                    continue

                files.append({"file": str(file), **symbols})

            except Exception:
                continue

        return files
