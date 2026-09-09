import networkx as nx

_JS_TS_EXTS = {'.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'}
_JS_TS_EXT_LIST = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs']


class DependencyGraphBuilder:

    def build_graph(
        self,
        parsed_files: list,
        package_registry: set,
    ):
        graph = nx.DiGraph()

        for file_data in parsed_files:
            source = file_data["file"]
            graph.add_node(source)

            # Detect file language once
            src_norm = source.replace("\\", "/")
            suffix = "." + src_norm.rsplit(".", 1)[-1] if "." in src_norm else ""
            is_js_ts = suffix in _JS_TS_EXTS

            for imp in file_data["imports"]:
                raw_module = imp.get("module") or ""

                if is_js_ts:
                    resolved, dep_type = self._resolve_js(
                        raw_module, src_norm, package_registry
                    )
                else:
                    resolved, dep_type = self._resolve_py(
                        imp, package_registry
                    )

                graph.add_edge(
                    source, resolved,
                    dependency_type=dep_type,
                )

        return graph

    # ── JS / TS resolution ────────────────────────────

    def _resolve_js(
        self,
        module: str,
        source_norm: str,
        registry: set,
    ) -> tuple[str, str]:
        """
        Resolve a JS/TS import string to either an internal
        repo-relative path or an external package name.
        """

        # Repo-relative source dir (strip "repositories/<name>/")
        parts = source_norm.split("/")
        if len(parts) >= 3 and parts[0] == "repositories":
            rel_dir = "/".join(parts[2:-1])   # e.g. "actions"
        else:
            rel_dir = "/".join(parts[:-1])

        candidate: str | None = None

        if module.startswith("@/"):
            # Next.js / TS path alias  @/ → repo root
            candidate = module[2:]             # "lib/prisma"

        elif module.startswith("./") or module.startswith("../"):
            # Relative import — resolve from source dir
            base = f"{rel_dir}/{module}" if rel_dir else module
            candidate = self._normalize(base)  # "lib/prisma"

        if candidate is not None:
            # Strip extension for lookup
            no_ext = self._strip_ext(candidate)
            if no_ext in registry or candidate in registry:
                return no_ext, "internal"
            # Try common extensions (e.g. import wrote no ext)
            for ext in _JS_TS_EXT_LIST:
                if (no_ext + ext) in registry:
                    return no_ext, "internal"
            # Try /index variants
            for ext in _JS_TS_EXT_LIST:
                if (no_ext + "/index" + ext) in registry:
                    return no_ext, "internal"

        # External — normalise to package root
        pkg = self._pkg_name(module)
        return pkg, "external"

    @staticmethod
    def _normalize(path: str) -> str:
        """Collapse ./ and ../ segments."""
        out: list[str] = []
        for seg in path.split("/"):
            if seg == "..":
                if out:
                    out.pop()
            elif seg not in (".", ""):
                out.append(seg)
        return "/".join(out)

    @staticmethod
    def _strip_ext(path: str) -> str:
        for ext in _JS_TS_EXT_LIST:
            if path.endswith(ext):
                return path[: -len(ext)]
        return path

    @staticmethod
    def _pkg_name(module: str) -> str:
        """Return the top-level package name."""
        if module.startswith("@"):
            parts = module.split("/")
            return "/".join(parts[:2]) if len(parts) >= 2 else module
        return module.split("/")[0]

    # ── Python resolution (unchanged logic) ──────────

    def _resolve_py(
        self,
        imp: dict,
        registry: set,
    ) -> tuple[str, str]:
        module = imp.get("full_import") or imp.get("module") or ""
        module_parts = module.split(".")
        resolved = module

        for i in range(len(module_parts), 0, -1):
            candidate = ".".join(module_parts[:i])
            if candidate in registry:
                resolved = candidate
                break

        if resolved == module and "." in module:
            resolved = module.split(".")[0]

        dep_type = (
            "internal"
            if any(
                resolved == pkg or resolved.startswith(f"{pkg}.")
                for pkg in registry
            )
            else "external"
        )
        return resolved, dep_type
