import ast


class PythonParser:

    def extract_symbols(
        self,
        file_path: str
    ):

        with open(
            file_path,
            "r",
            encoding="utf-8",
            errors="ignore"
        ) as f:
            source = f.read()

        tree = ast.parse(source)

        functions = []
        classes = []
        imports = []

        for node in ast.walk(tree):

            if isinstance(node, ast.FunctionDef):

                functions.append({
                    "name": node.name,
                    "line": node.lineno
                })

            elif isinstance(node, ast.ClassDef):

                classes.append({
                    "name": node.name,
                    "line": node.lineno
                })

            elif isinstance(node, ast.Import):

                for alias in node.names:

                    imports.append({
                        "module": alias.name
                    })

            elif isinstance(node, ast.ImportFrom):

                if node.module:

                    for alias in node.names:

                        imports.append({
                            "module": node.module,
                            "imported_name": alias.name,
                            "full_import": (
                                f"{node.module}.{alias.name}"
                            )
                        })

        return {
            "functions": functions,
            "classes": classes,
            "imports": imports
        }