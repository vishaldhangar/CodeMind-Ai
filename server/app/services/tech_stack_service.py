import json
from pathlib import Path


# ── File extension → language ─────────────────────────
LANGUAGE_MAP: dict[str, str] = {
    ".py":   "Python",
    ".js":   "JavaScript",
    ".ts":   "TypeScript",
    ".jsx":  "JavaScript (React)",
    ".tsx":  "TypeScript (React)",
    ".mjs":  "JavaScript (ESM)",
    ".cjs":  "JavaScript (CJS)",
    ".rb":   "Ruby",
    ".go":   "Go",
    ".java": "Java",
    ".rs":   "Rust",
    ".cs":   "C#",
    ".php":  "PHP",
    ".cpp":  "C++",
    ".c":    "C",
}

# ── Package → category + display name ────────────────
TECH_CLASSIFICATIONS: dict[str, dict[str, str]] = {

    "frameworks": {
        # Python
        "fastapi":       "FastAPI",
        "flask":         "Flask",
        "django":        "Django",
        "starlette":     "Starlette",
        "tornado":       "Tornado",
        "sanic":         "Sanic",
        "litestar":      "Litestar",
        "aiohttp":       "aiohttp",
        "falcon":        "Falcon",
        "bottle":        "Bottle",
        # Node.js
        "express":       "Express.js",
        "koa":           "Koa",
        "fastify":       "Fastify",
        "@nestjs/core":  "NestJS",
        "hapi":          "Hapi.js",
        "@hapi/hapi":    "Hapi.js",
        "restify":       "Restify",
        # React ecosystem
        "react":         "React",
        "next":          "Next.js",
        "gatsby":        "Gatsby",
        "remix":         "Remix",
        "@remix-run/react": "Remix",
        "vite":          "Vite",
        "@tanstack/react-query": "TanStack Query",
        "react-router-dom": "React Router",
        "react-router":  "React Router",
    },

    "databases": {
        # Python
        "sqlalchemy":             "SQLAlchemy",
        "sqlmodel":               "SQLModel",
        "tortoise-orm":           "Tortoise ORM",
        "psycopg2":               "PostgreSQL",
        "psycopg2-binary":        "PostgreSQL",
        "psycopg":                "PostgreSQL",
        "asyncpg":                "PostgreSQL",
        "pymysql":                "MySQL",
        "aiomysql":               "MySQL",
        "pymongo":                "MongoDB",
        "motor":                  "MongoDB",
        "beanie":                 "MongoDB",
        "redis":                  "Redis",
        "aioredis":               "Redis",
        "elasticsearch-py":       "Elasticsearch",
        "elasticsearch":          "Elasticsearch",
        "cassandra-driver":       "Cassandra",
        "boto3":                  "AWS SDK",
        # Node.js
        "prisma":                 "Prisma",
        "@prisma/client":         "Prisma",
        "typeorm":                "TypeORM",
        "mongoose":               "MongoDB",
        "sequelize":              "Sequelize",
        "drizzle-orm":            "Drizzle ORM",
        "pg":                     "PostgreSQL",
        "mysql2":                 "MySQL",
        "ioredis":                "Redis",
        "mongodb":                "MongoDB",
        "@supabase/supabase-js":  "Supabase",
        "firebase":               "Firebase",
        "firebase-admin":         "Firebase",
        "better-sqlite3":         "SQLite",
        "sqlite3":                "SQLite",
        "knex":                   "Knex.js",
        "@elastic/elasticsearch": "Elasticsearch",
        "@aws-sdk/client-dynamodb":"DynamoDB",
    },

    "ai_stack": {
        "openai":                  "OpenAI",
        "anthropic":               "Anthropic",
        "langchain":               "LangChain",
        "langchain-core":          "LangChain",
        "langchain-community":     "LangChain",
        "langgraph":               "LangGraph",
        "llama-index":             "LlamaIndex",
        "llama_index":             "LlamaIndex",
        "transformers":            "HuggingFace Transformers",
        "torch":                   "PyTorch",
        "tensorflow":              "TensorFlow",
        "scikit-learn":            "Scikit-Learn",
        "sentence-transformers":   "Sentence Transformers",
        "chromadb":                "ChromaDB",
        "pinecone-client":         "Pinecone",
        "qdrant-client":           "Qdrant",
        "weaviate-client":         "Weaviate",
        "google-generativeai":     "Google Gemini",
        "cohere":                  "Cohere",
        "mistralai":               "Mistral AI",
        "together":                "Together AI",
        "groq":                    "Groq",
    },

    "testing_tools": {
        # Python
        "pytest":                  "Pytest",
        "pytest-asyncio":          "pytest-asyncio",
        "pytest-cov":              "pytest-cov",
        "hypothesis":              "Hypothesis",
        "factory-boy":             "Factory Boy",
        "faker":                   "Faker",
        # Node.js
        "jest":                    "Jest",
        "vitest":                  "Vitest",
        "cypress":                 "Cypress",
        "playwright":              "Playwright",
        "@playwright/test":        "Playwright",
        "@testing-library/react":  "React Testing Library",
        "mocha":                   "Mocha",
        "chai":                    "Chai",
        "supertest":               "Supertest",
        "@jest/globals":           "Jest",
    },

    "auth": {
        # Python
        "pyjwt":                   "PyJWT",
        "python-jose":             "Jose (JWT)",
        "passlib":                 "Passlib",
        "bcrypt":                  "Bcrypt",
        "authlib":                 "Authlib",
        "fastapi-users":           "FastAPI Users",
        "django-allauth":          "Django AllAuth",
        # Node.js
        "next-auth":               "NextAuth.js",
        "@auth/nextjs":            "NextAuth.js",
        "passport":                "Passport.js",
        "jsonwebtoken":            "JWT",
        "jose":                    "Jose (JWT)",
        "@clerk/nextjs":           "Clerk",
        "@clerk/clerk-sdk-node":   "Clerk",
        "lucia":                   "Lucia Auth",
        "iron-session":            "Iron Session",
    },

    "task_queue": {
        "celery":                  "Celery",
        "dramatiq":                "Dramatiq",
        "rq":                      "RQ",
        "apscheduler":             "APScheduler",
        "bull":                    "Bull",
        "bullmq":                  "BullMQ",
        "bee-queue":               "Bee Queue",
        "agenda":                  "Agenda",
    },

    "http_clients": {
        "httpx":                   "HTTPX",
        "requests":                "Requests",
        "aiohttp":                 "aiohttp",
        "axios":                   "Axios",
        "got":                     "Got",
        "node-fetch":              "node-fetch",
        "undici":                  "Undici",
        "ky":                      "Ky",
    },

    "ui_libraries": {
        # Node.js / React
        "@mui/material":           "Material UI",
        "@chakra-ui/react":        "Chakra UI",
        "antd":                    "Ant Design",
        "@ant-design/react":       "Ant Design",
        "@radix-ui/react-dialog":  "Radix UI",
        "shadcn":                  "shadcn/ui",
        "@headlessui/react":       "Headless UI",
        "tailwindcss":             "Tailwind CSS",
        "styled-components":       "Styled Components",
        "framer-motion":           "Framer Motion",
        "lucide-react":            "Lucide Icons",
        "react-icons":             "React Icons",
        "@heroicons/react":        "Heroicons",
    },
}


class TechStackService:
    """
    Universally detects the tech stack of a repository.

    Detection sources (Python + Node.js/React/Next.js):
      1. File extensions from Scanner → languages
      2. requirements.txt / Pipfile / pyproject.toml
      3. package.json (parsed as JSON)
      4. Config file presence (next.config.js, etc.)
    """

    def get_tech_stack(
        self,
        repo_name: str
    ) -> dict:

        repo_path = Path("repositories") / repo_name

        result: dict[str, list] = {
            "languages":     [],
            "frameworks":    [],
            "databases":     [],
            "ai_stack":      [],
            "testing_tools": [],
            "auth":          [],
            "task_queue":    [],
            "http_clients":  [],
            "ui_libraries":  [],
        }

        all_packages: set[str] = set()

        # 1. Languages from file extensions
        detected_languages = self._detect_languages(
            repo_path
        )
        result["languages"] = sorted(detected_languages)

        # 2. Python dependency files
        self._parse_python_deps(
            repo_path, all_packages
        )

        # 3. Node.js package.json
        self._parse_package_json(
            repo_path, all_packages, result
        )

        # 4. Classify all packages
        for category, mapping in (
            TECH_CLASSIFICATIONS.items()
        ):
            for pkg, display_name in mapping.items():

                if pkg.lower() in all_packages:

                    if display_name not in result[
                        category
                    ]:
                        result[category].append(
                            display_name
                        )

        # 5. Deduplicate and sort
        for key in result:
            if isinstance(result[key], list):
                result[key] = sorted(set(result[key]))

        return result

    # ──────────────────────────────────────────────────
    # Language detection
    # ──────────────────────────────────────────────────

    def _detect_languages(
        self,
        repo_path: Path
    ) -> set[str]:

        skip_dirs = {
            "node_modules", ".git", ".next",
            "dist", "build", "__pycache__",
            ".venv", "venv", "env"
        }

        detected: set[str] = set()

        for f in repo_path.rglob("*"):

            if not f.is_file():
                continue

            if any(p in skip_dirs for p in f.parts):
                continue

            lang = LANGUAGE_MAP.get(
                f.suffix.lower()
            )

            if lang:
                detected.add(lang)

        return detected

    # ──────────────────────────────────────────────────
    # Python dependency file parsing
    # ──────────────────────────────────────────────────

    def _parse_python_deps(
        self,
        repo_path: Path,
        all_packages: set
    ):

        dep_files = [
            "requirements.txt",
            "requirements-dev.txt",
            "requirements-test.txt",
            "Pipfile",
            "pyproject.toml"
        ]

        for filename in dep_files:

            path = repo_path / filename

            if not path.exists():
                continue

            try:
                content = path.read_text(
                    encoding="utf-8",
                    errors="ignore"
                )
            except Exception:
                continue

            for line in content.splitlines():

                line = line.strip()

                # Skip comments and blank lines
                if not line or line.startswith(
                    ("#", "-", ".", "[")
                ):
                    continue

                # Normalize: strip version specifiers
                pkg = (
                    line.split("==")[0]
                        .split(">=")[0]
                        .split("<=")[0]
                        .split("~=")[0]
                        .split(">")[0]
                        .split("<")[0]
                        .split("[")[0]
                        .split(";")[0]
                        .strip()
                        .lower()
                )

                if pkg:
                    all_packages.add(pkg)

    # ──────────────────────────────────────────────────
    # Node.js package.json parsing
    # ──────────────────────────────────────────────────

    def _parse_package_json(
        self,
        repo_path: Path,
        all_packages: set,
        result: dict
    ):

        pkg_file = repo_path / "package.json"

        if not pkg_file.exists():
            return

        try:
            pkg = json.loads(
                pkg_file.read_text(encoding="utf-8")
            )
        except Exception:
            return

        all_deps: dict = {}
        all_deps.update(pkg.get("dependencies", {}))
        all_deps.update(
            pkg.get("devDependencies", {})
        )

        for dep in all_deps:
            all_packages.add(dep.lower())

        # Config file signals for framework detection
        config_checks = [
            (
                ["next.config.js", "next.config.ts",
                 "next.config.mjs"],
                "Next.js", "frameworks"
            ),
            (
                ["vite.config.js", "vite.config.ts",
                 "vite.config.mjs"],
                "Vite", "frameworks"
            ),
            (
                ["astro.config.mjs", "astro.config.js"],
                "Astro", "frameworks"
            ),
        ]

        for config_files, display_name, category in (
            config_checks
        ):

            for cfg in config_files:

                if (repo_path / cfg).exists():

                    if display_name not in result[
                        category
                    ]:
                        result[category].append(
                            display_name
                        )
                    break
