import json
import re
from pathlib import Path

from app.services.ast_service import ASTService


# ── Python package → DB info ──────────────────────────
PYTHON_DB_PACKAGES = {
    "sqlalchemy":             {"db": "SQL (Generic)", "orm": "SQLAlchemy"},
    "sqlmodel":               {"db": "SQL (Generic)", "orm": "SQLModel"},
    "tortoise-orm":           {"db": "SQL (Generic)", "orm": "Tortoise ORM"},
    "databases":              {"db": "SQL (Generic)", "orm": None},
    "psycopg2":               {"db": "PostgreSQL",   "orm": None},
    "psycopg2-binary":        {"db": "PostgreSQL",   "orm": None},
    "psycopg":                {"db": "PostgreSQL",   "orm": None},
    "asyncpg":                {"db": "PostgreSQL",   "orm": None},
    "aiopg":                  {"db": "PostgreSQL",   "orm": None},
    "pymysql":                {"db": "MySQL",        "orm": None},
    "aiomysql":               {"db": "MySQL",        "orm": None},
    "mysql-connector-python": {"db": "MySQL",        "orm": None},
    "pymongo":                {"db": "MongoDB",      "orm": None},
    "motor":                  {"db": "MongoDB",      "orm": "Motor (async)"},
    "beanie":                 {"db": "MongoDB",      "orm": "Beanie ODM"},
    "redis":                  {"db": "Redis",        "orm": None},
    "aioredis":               {"db": "Redis",        "orm": None},
    "elasticsearch-py":       {"db": "Elasticsearch","orm": None},
    "elasticsearch":          {"db": "Elasticsearch","orm": None},
    "cassandra-driver":       {"db": "Cassandra",    "orm": None},
    "aiocassandra":           {"db": "Cassandra",    "orm": None},
    "boto3":                  {"db": "AWS (DynamoDB/S3)", "orm": None},
    "firebase-admin":         {"db": "Firebase",     "orm": None},
}

# ── Node.js package → DB info ────────────────────────
NODE_DB_PACKAGES = {
    "prisma":                {"db": "Multi (see schema)", "orm": "Prisma"},
    "@prisma/client":        {"db": "Multi (see schema)", "orm": "Prisma"},
    "typeorm":               {"db": "SQL (Generic)",      "orm": "TypeORM"},
    "mongoose":              {"db": "MongoDB",            "orm": "Mongoose"},
    "sequelize":             {"db": "SQL (Generic)",      "orm": "Sequelize"},
    "drizzle-orm":           {"db": "SQL (Generic)",      "orm": "Drizzle ORM"},
    "mikro-orm":             {"db": "SQL (Generic)",      "orm": "MikroORM"},
    "@mikro-orm/core":       {"db": "SQL (Generic)",      "orm": "MikroORM"},
    "pg":                    {"db": "PostgreSQL",         "orm": None},
    "pg-pool":               {"db": "PostgreSQL",         "orm": None},
    "postgres":              {"db": "PostgreSQL",         "orm": None},
    "mysql2":                {"db": "MySQL",              "orm": None},
    "mysql":                 {"db": "MySQL",              "orm": None},
    "mongodb":               {"db": "MongoDB",            "orm": None},
    "ioredis":               {"db": "Redis",              "orm": None},
    "redis":                 {"db": "Redis",              "orm": None},
    "@supabase/supabase-js": {"db": "PostgreSQL",         "orm": "Supabase"},
    "firebase":              {"db": "Firebase",           "orm": None},
    "firebase-admin":        {"db": "Firebase",           "orm": None},
    "better-sqlite3":        {"db": "SQLite",             "orm": None},
    "sqlite3":               {"db": "SQLite",             "orm": None},
    "@elastic/elasticsearch":{"db": "Elasticsearch",      "orm": None},
    "cassandra-driver":      {"db": "Cassandra",          "orm": None},
    "dynamodb":              {"db": "DynamoDB",           "orm": None},
    "@aws-sdk/client-dynamodb":{"db": "DynamoDB",         "orm": None},
    "knex":                  {"db": "SQL (Generic)",      "orm": "Knex.js"},
}

# Prisma provider → human-readable DB name
PRISMA_PROVIDER_MAP = {
    "postgresql": "PostgreSQL",
    "postgres":   "PostgreSQL",
    "mysql":      "MySQL",
    "sqlite":     "SQLite",
    "mongodb":    "MongoDB",
    "sqlserver":  "SQL Server",
    "cockroachdb":"CockroachDB",
}


class DatabaseDetectionService:

    def detect_databases(
        self,
        repo_name: str
    ) -> dict:

        repo_path = Path("repositories") / repo_name

        # db_type → {type, orm, confidence, detected_via}
        databases: dict[str, dict] = {}
        db_models: list[dict] = []

        self._scan_python_requirements(
            repo_path, databases
        )
        self._scan_python_imports(
            repo_name, databases, db_models
        )
        self._scan_package_json(
            repo_path, databases
        )
        self._scan_prisma_schema(
            repo_path, databases, db_models
        )

        return {
            "repository": repo_name,
            "has_database": len(databases) > 0,
            "databases": list(databases.values()),
            "db_models": db_models
        }

    # ──────────────────────────────────────────────────
    # Python: requirements.txt / Pipfile / pyproject.toml
    # ──────────────────────────────────────────────────

    def _scan_python_requirements(
        self,
        repo_path: Path,
        databases: dict
    ):

        req_files = [
            "requirements.txt",
            "requirements-dev.txt",
            "Pipfile",
            "pyproject.toml"
        ]

        for filename in req_files:

            path = repo_path / filename

            if not path.exists():
                continue

            try:
                content = path.read_text(
                    encoding="utf-8",
                    errors="ignore"
                ).lower()

            except Exception:
                continue

            for pkg, info in PYTHON_DB_PACKAGES.items():

                if pkg.lower() in content:

                    self._add_database(
                        databases,
                        info["db"],
                        info["orm"],
                        filename
                    )

    # ──────────────────────────────────────────────────
    # Python: AST import scan
    # ──────────────────────────────────────────────────

    def _scan_python_imports(
        self,
        repo_name: str,
        databases: dict,
        db_models: list
    ):

        try:
            ast_service = ASTService()
            parsed_files = ast_service.parse_repository(
                repo_name
            )
        except Exception:
            return

        for file_data in parsed_files:

            file_path = file_data["file"]

            for imp in file_data.get("imports", []):

                module = (
                    imp.get("module", "").lower()
                )

                for pkg, info in (
                    PYTHON_DB_PACKAGES.items()
                ):

                    if (
                        module == pkg.lower()
                        or module.startswith(
                            pkg.lower() + "."
                        )
                    ):
                        self._add_database(
                            databases,
                            info["db"],
                            info["orm"],
                            "import_scan"
                        )

            # Model detection: classes in models/ dirs
            in_models_dir = (
                "/models/" in file_path
                or "\\models\\" in file_path
                or "/entities/" in file_path
                or "\\entities\\" in file_path
            )

            if in_models_dir:

                for cls in file_data.get(
                    "classes", []
                ):
                    db_models.append({
                        "name": cls["name"],
                        "file": file_path,
                        "type": "model_class"
                    })

    # ──────────────────────────────────────────────────
    # Node.js: package.json
    # ──────────────────────────────────────────────────

    def _scan_package_json(
        self,
        repo_path: Path,
        databases: dict
    ):

        pkg_file = repo_path / "package.json"

        if not pkg_file.exists():
            return

        try:
            pkg = json.loads(
                pkg_file.read_text(
                    encoding="utf-8"
                )
            )

        except Exception:
            return

        all_deps: dict = {}
        all_deps.update(pkg.get("dependencies", {}))
        all_deps.update(pkg.get("devDependencies", {}))

        for pkg_name, info in NODE_DB_PACKAGES.items():

            if pkg_name in all_deps:

                self._add_database(
                    databases,
                    info["db"],
                    info["orm"],
                    "package.json"
                )

    # ──────────────────────────────────────────────────
    # Prisma: schema.prisma
    # ──────────────────────────────────────────────────

    def _scan_prisma_schema(
        self,
        repo_path: Path,
        databases: dict,
        db_models: list
    ):

        schema_path = repo_path / "prisma" / "schema.prisma"

        if not schema_path.exists():
            return

        try:
            content = schema_path.read_text(
                encoding="utf-8",
                errors="ignore"
            )
        except Exception:
            return

        # Extract datasource provider
        provider_match = re.search(
            r'provider\s*=\s*"(\w+)"',
            content
        )

        if provider_match:

            provider = provider_match.group(1).lower()
            db_type = PRISMA_PROVIDER_MAP.get(
                provider, provider.title()
            )

            # Remove generic "Multi (see schema)" entry
            databases.pop("Multi (see schema)", None)

            self._add_database(
                databases,
                db_type,
                "Prisma",
                "prisma/schema.prisma"
            )

        # Extract model names
        models = re.findall(
            r"^model\s+(\w+)\s*\{",
            content,
            re.MULTILINE
        )

        for model_name in models:

            db_models.append({
                "name": model_name,
                "file": str(schema_path),
                "type": "prisma_model"
            })

    # ──────────────────────────────────────────────────
    # Helper
    # ──────────────────────────────────────────────────

    def _add_database(
        self,
        databases: dict,
        db_type: str,
        orm,
        source: str
    ):

        if db_type not in databases:

            databases[db_type] = {
                "type": db_type,
                "orm": orm,
                "confidence": "high",
                "detected_via": [source]
            }

        else:

            existing = databases[db_type]

            if source not in existing["detected_via"]:
                existing["detected_via"].append(source)

            # Upgrade ORM if we now have more info
            if existing["orm"] is None and orm:
                existing["orm"] = orm
