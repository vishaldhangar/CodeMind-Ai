import ast
from pathlib import Path


HTTP_METHODS = {
    "get", "post", "put", "patch",
    "delete", "head", "options"
}


class PythonRouteParser:
    """
    Detects HTTP routes in Python files.

    Supports:
      - FastAPI:  @router.get("/path")
      - Flask:    @app.route("/path", methods=["GET"])
      - Django:   path("url/", view) in urls.py
    """

    def parse_file(
        self,
        file_path: str
    ) -> list:

        routes = []

        try:
            with open(
                file_path, "r",
                encoding="utf-8",
                errors="ignore"
            ) as f:
                source = f.read()

            tree = ast.parse(source)

        except Exception:
            return routes

        # Django: urls.py files use path() / re_path()
        if Path(file_path).name == "urls.py":
            return self._parse_django_urls(
                tree, file_path
            )

        # FastAPI / Flask: decorator-based routing
        for node in ast.walk(tree):

            if not isinstance(
                node,
                (ast.FunctionDef, ast.AsyncFunctionDef)
            ):
                continue

            for decorator in node.decorator_list:

                route = self._extract_decorator_route(
                    decorator,
                    node.name,
                    file_path
                )

                if route:
                    routes.append(route)

        return routes

    # ──────────────────────────────────────────────────
    # FastAPI / Flask decorator extraction
    # ──────────────────────────────────────────────────

    def _extract_decorator_route(
        self,
        decorator,
        handler_name: str,
        file_path: str
    ):

        if not isinstance(decorator, ast.Call):
            return None

        func = decorator.func
        method = None
        path_str = None

        if isinstance(func, ast.Attribute):

            attr = func.attr.lower()

            if attr in HTTP_METHODS:
                # @router.get("/path") or @app.post("/path")
                method = attr.upper()

            elif attr == "route":
                # Flask: @app.route("/path", methods=[...])
                method = self._extract_flask_methods(
                    decorator
                )

            else:
                return None

        else:
            return None

        # Extract path from first positional arg
        if decorator.args:

            arg = decorator.args[0]

            if (
                isinstance(arg, ast.Constant)
                and isinstance(arg.value, str)
            ):
                path_str = arg.value

        if not path_str:
            return None

        return {
            "method": method,
            "path": path_str,
            "handler": handler_name,
            "file": file_path,
            "line": (
                decorator.lineno
                if hasattr(decorator, "lineno")
                else None
            ),
            "framework": "fastapi_flask",
            "type": "api_route"
        }

    def _extract_flask_methods(
        self,
        decorator
    ) -> str:

        for keyword in decorator.keywords:

            if keyword.arg != "methods":
                continue

            if not isinstance(
                keyword.value, ast.List
            ):
                continue

            methods = []

            for elt in keyword.value.elts:

                if isinstance(elt, ast.Constant):
                    methods.append(
                        elt.value.upper()
                    )

            return ",".join(methods) if methods else "GET"

        return "GET"

    # ──────────────────────────────────────────────────
    # Django urls.py extraction
    # ──────────────────────────────────────────────────

    def _parse_django_urls(
        self,
        tree,
        file_path: str
    ) -> list:

        routes = []

        for node in ast.walk(tree):

            if not isinstance(node, ast.Call):
                continue

            func = node.func
            func_name = None

            if isinstance(func, ast.Name):
                func_name = func.id
            elif isinstance(func, ast.Attribute):
                func_name = func.attr

            if func_name not in ("path", "re_path"):
                continue

            if not node.args:
                continue

            path_arg = node.args[0]
            path_str = None
            handler_name = None

            if isinstance(path_arg, ast.Constant):
                path_str = path_arg.value

            if len(node.args) > 1:

                view_arg = node.args[1]

                if isinstance(
                    view_arg, ast.Attribute
                ):
                    obj = view_arg.value
                    obj_name = (
                        obj.id
                        if isinstance(obj, ast.Name)
                        else "views"
                    )
                    handler_name = (
                        f"{obj_name}.{view_arg.attr}"
                    )

                elif isinstance(view_arg, ast.Name):
                    handler_name = view_arg.id

            if path_str is not None:

                routes.append({
                    "method": "ANY",
                    "path": (
                        f"/{path_str}"
                        if not path_str.startswith("/")
                        else path_str
                    ),
                    "handler": handler_name,
                    "file": file_path,
                    "line": (
                        node.lineno
                        if hasattr(node, "lineno")
                        else None
                    ),
                    "framework": "django",
                    "type": "api_route"
                })

        return routes
