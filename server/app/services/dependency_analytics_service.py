from collections import Counter

from app.services.dependency_service import (
    DependencyService
)


class DependencyAnalyticsService:

    def get_summary(
        self,
        repo_name: str
    ):

        dependency_service = (
            DependencyService()
        )

        data = (
            dependency_service.get_dependencies(
                repo_name
            )
        )

        internal_counter = Counter()
        external_counter = Counter()

        for dependency in data[
            "dependencies"
        ]:

            if (
                dependency["type"]
                == "internal"
            ):

                internal_counter[
                    dependency["target"]
                ] += 1

            else:

                external_counter[
                    dependency["target"]
                ] += 1

        top_internal = []

        for module, count in (
            internal_counter.most_common(10)
        ):

            top_internal.append({
                "module": module,
                "imports": count
            })

        top_external = []

        for module, count in (
            external_counter.most_common(10)
        ):

            top_external.append({
                "module": module,
                "imports": count
            })

        return {
            "internal_edges":
                data["internal_edges"],

            "external_edges":
                data["external_edges"],

            "top_internal_modules":
                top_internal,

            "top_external_modules":
                top_external
        }