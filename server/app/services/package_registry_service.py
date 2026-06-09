from pathlib import Path


class PackageRegistryService:

    def build_registry(
        self,
        repo_name: str
    ):

        repo_path = (
            Path("repositories")
            / repo_name
        )

        packages = set()

        for py_file in repo_path.rglob("*.py"):

            relative = (
                py_file.relative_to(repo_path)
            )

            module = (
                str(relative)
                .replace("\\", ".")
                .replace("/", ".")
                .replace(".py", "")
            )

            packages.add(module)

            parts = module.split(".")

            for i in range(1, len(parts)):

                packages.add(
                    ".".join(parts[:i])
                )

        return packages