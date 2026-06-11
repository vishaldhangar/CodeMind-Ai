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
        function_calls = {}

        # ── Pass 1: collect classes with bases + methods ──
        # We walk top-level class bodies directly so we can
        # record which functions are methods of which class.
        class_method_names: set[str] = set()

        for node in ast.walk(tree):

            if isinstance(node, ast.ClassDef):

                bases = self._extract_bases(node)

                # Direct methods = FunctionDef nodes that
                # are immediate children of the class body
                methods = [
                    item.name
                    for item in node.body
                    if isinstance(
                        item,
                        (ast.FunctionDef, ast.AsyncFunctionDef)
                    )
                ]

                for m in methods:
                    class_method_names.add(m)

                classes.append({
                    "name":    node.name,
                    "line":    node.lineno,
                    "bases":   bases,
                    "methods": methods
                })

        # ── Pass 2: collect functions + imports ───────────
        for node in ast.walk(tree):

            if isinstance(
                node,
                (ast.FunctionDef, ast.AsyncFunctionDef)
            ):

                functions.append({
                    "name":      node.name,
                    "line":      node.lineno,
                    "is_method": node.name in class_method_names
                })

                function_calls[node.name] = (
                    self._extract_calls(node)
                )

            elif isinstance(node, ast.Import):

                for alias in node.names:

                    imports.append({
                        "module": alias.name
                    })

            elif isinstance(node, ast.ImportFrom):

                if node.module:

                    for alias in node.names:

                        imports.append({
                            "module":        node.module,
                            "imported_name": alias.name,
                            "full_import": (
                                f"{node.module}.{alias.name}"
                            )
                        })

        return {
            "functions":      functions,
            "classes":        classes,
            "imports":        imports,
            "function_calls": function_calls
        }

    def _extract_bases(
        self,
        class_node: ast.ClassDef
    ) -> list[str]:
        """
        Extract base class names from a ClassDef node.

        class Foo(Bar, baz.Mixin):  →  ["Bar", "baz.Mixin"]
        """

        bases = []

        for base in class_node.bases:

            if isinstance(base, ast.Name):
                bases.append(base.id)

            elif isinstance(base, ast.Attribute):
                # e.g. models.Model  or  db.Base
                if isinstance(base.value, ast.Name):
                    bases.append(
                        f"{base.value.id}.{base.attr}"
                    )
                else:
                    bases.append(base.attr)

        return bases

    def _extract_calls(
        self,
        func_node: ast.AST
    ) -> list:
        """
        Walk a function node's body and collect the names
        of every function/method it calls.
        Stops at nested function boundaries to avoid
        attributing inner-function calls to the outer one.
        """

        seen = set()
        calls = []

        # Custom BFS that does NOT recurse into nested
        # FunctionDef / AsyncFunctionDef nodes
        queue = list(ast.iter_child_nodes(func_node))

        while queue:

            child = queue.pop()

            # Don't recurse into nested function bodies
            if (
                isinstance(
                    child,
                    (ast.FunctionDef, ast.AsyncFunctionDef)
                )
                and child is not func_node
            ):
                continue

            if isinstance(child, ast.Call):

                callee = None

                if isinstance(child.func, ast.Name):
                    # direct call: some_function()
                    callee = child.func.id

                elif isinstance(
                    child.func, ast.Attribute
                ):
                    # method call: obj.some_method()
                    callee = child.func.attr

                if callee and callee not in seen:
                    seen.add(callee)
                    calls.append(callee)

            queue.extend(ast.iter_child_nodes(child))

        return calls