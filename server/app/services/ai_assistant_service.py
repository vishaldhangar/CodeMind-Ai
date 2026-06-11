import os
import re
import json

import ollama

from app.services.context_builder_service import (
    ContextBuilderService
)


# Model preference order — first match that is actually
# available in Ollama wins
MODEL_PREFERENCE = [
    "qwen2.5:14b",
    "qwen3.1:14b",
    "qwen3:14b",
    "qwen2.5:7b",
    "qwen3.1:8b",
    "qwen3:8b",
]

DEFAULT_MODEL = "qwen2.5:14b"


def _get_model() -> str:
    # 1. Explicit env var always wins
    env_model = os.environ.get("OLLAMA_MODEL")
    if env_model:
        return env_model

    # 2. Auto-detect: pick best available Qwen model
    try:
        resp = ollama.list()
        pulled = [
            getattr(m, "model", None) or getattr(m, "name", "")
            for m in resp.models
        ]
        for preferred in MODEL_PREFERENCE:
            if any(
                preferred in p or p.startswith(
                    preferred.split(":")[0]
                )
                for p in pulled
            ):
                return preferred
    except Exception:
        pass

    return DEFAULT_MODEL


# ── Qwen3 thinking tag stripper ───────────────────────
_THINK_RE = re.compile(
    r"<think>.*?</think>",
    re.DOTALL | re.IGNORECASE
)


def _strip_thinking(text: str) -> tuple[str, str]:
    """
    Separate Qwen3's <think>...</think> reasoning
    from the final answer.

    Returns (clean_answer, thinking_content).
    """

    thinking = ""

    match = _THINK_RE.search(text)
    if match:
        thinking = match.group(0)[7:-8].strip()  # strip tags

    clean = _THINK_RE.sub("", text).strip()

    return clean, thinking


class AIAssistantService:
    """
    Phase 5: AI Assistant powered by Qwen3.1:14b via Ollama.

    Uses ContextBuilderService to gather targeted codebase
    intelligence, then sends it to the model as rich
    system context.

    Qwen3 specific:
      - Thinking is enabled by default (better quality)
      - <think>...</think> blocks are stripped from the
        public answer but optionally returned separately
    """

    # ──────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────

    def chat(
        self,
        repo_name: str,
        question: str,
        show_thinking: bool = False
    ) -> dict:
        """
        Answer a natural language question about
        the repository using codebase intelligence
        as context.
        """

        model = _get_model()

        context = ContextBuilderService().build(
            repo_name, question
        )

        system_prompt = self._build_system_prompt(
            context
        )

        raw = self._call_ollama(
            model, system_prompt, question
        )

        answer, thinking = _strip_thinking(raw)

        result = {
            "repository":       repo_name,
            "question":         question,
            "answer":           answer,
            "model":            model,
            "intents_detected": context.get(
                "intents_detected", []
            )
        }

        if show_thinking and thinking:
            result["thinking"] = thinking

        return result

    def explain_file(
        self,
        repo_name: str,
        file_path: str,
        show_thinking: bool = False
    ) -> dict:
        """
        Explain what a file does, its role in the
        codebase, what it imports, and what imports it.
        """

        model = _get_model()

        context = ContextBuilderService().build_for_file(
            repo_name, file_path
        )

        system_prompt = self._build_file_system_prompt(
            context
        )

        question = (
            f"Explain what `{file_path}` does, "
            f"its role in the codebase architecture, "
            f"what it provides, and how it fits with "
            f"the other components."
        )

        raw = self._call_ollama(
            model, system_prompt, question
        )

        answer, thinking = _strip_thinking(raw)

        result = {
            "repository": repo_name,
            "file":       file_path,
            "explanation": answer,
            "model":       model
        }

        if show_thinking and thinking:
            result["thinking"] = thinking

        return result

    def explain_function(
        self,
        repo_name: str,
        function_name: str,
        show_thinking: bool = False
    ) -> dict:
        """
        Explain what a function does, what it calls,
        who calls it, and which workflows it belongs to.
        """

        model = _get_model()

        context = ContextBuilderService(
        ).build_for_function(
            repo_name, function_name
        )

        system_prompt = self._build_fn_system_prompt(
            context
        )

        question = (
            f"Explain what the function "
            f"`{function_name}()` does, its purpose, "
            f"inputs/outputs, what it calls, who calls "
            f"it, and its role in the system."
        )

        raw = self._call_ollama(
            model, system_prompt, question
        )

        answer, thinking = _strip_thinking(raw)

        result = {
            "repository":  repo_name,
            "function":    function_name,
            "explanation": answer,
            "model":       model
        }

        if show_thinking and thinking:
            result["thinking"] = thinking

        return result

    def health_check(self) -> dict:
        """
        Verify Ollama is running and the model is loaded.
        """

        model = _get_model()

        try:
            models_resp = ollama.list()

            # ollama.list() returns a ListResponse object
            # with a .models attribute
            model_names = []
            for m in models_resp.models:
                name = getattr(m, "model", None) or getattr(m, "name", None)
                if name:
                    model_names.append(name)

            model_available = any(
                model in name or name.startswith(model.split(":")[0])
                for name in model_names
            )

            return {
                "ollama_running":   True,
                "model":            model,
                "model_available":  model_available,
                "available_models": model_names
            }

        except Exception as e:
            return {
                "ollama_running":  False,
                "model":           model,
                "model_available": False,
                "error":           str(e),
                "hint": (
                    "Make sure Ollama is running: "
                    "`ollama serve`"
                )
            }

    # ──────────────────────────────────────────────────
    # Ollama caller
    # ──────────────────────────────────────────────────

    def _call_ollama(
        self,
        model: str,
        system_prompt: str,
        user_message: str
    ) -> str:
        """
        Call Ollama using the native ollama package.
        Returns the raw response text (may contain
        <think> tags for Qwen3).
        """

        response = ollama.chat(
            model=model,
            messages=[
                {
                    "role":    "system",
                    "content": system_prompt
                },
                {
                    "role":    "user",
                    "content": user_message
                }
            ],
            options={
                "temperature": 0.2,
                "num_ctx":     8192
            }
        )

        return response.message.content

    # ──────────────────────────────────────────────────
    # System prompt builders
    # ──────────────────────────────────────────────────

    def _build_system_prompt(
        self,
        context: dict
    ) -> str:

        repo = context.get("repository", "unknown")
        lines = [
            f"You are CodeMind AI — an expert software "
            f"architect and code intelligence assistant "
            f"with deep knowledge of the `{repo}` "
            f"repository.",
            "",
            "The following intelligence was automatically "
            "extracted from the codebase using static "
            "analysis. Use it to answer questions "
            "accurately and specifically.",
            ""
        ]

        # Architecture
        arch = context.get("architecture", {})
        if arch:
            lines += [
                "## Architecture",
                f"Pattern   : {arch.get('pattern', 'Unknown')}",
                f"Confidence: {arch.get('confidence', '')}",
                f"Layers    : {', '.join(arch.get('detected_layers', []))}",
                f"Summary   : {arch.get('summary', '')}",
                ""
            ]

            ts = arch.get("tech_stack", {})
            if ts:
                lines.append("Tech Stack:")
                for category, items in ts.items():
                    if items:
                        lines.append(
                            f"  {category}: "
                            f"{', '.join(items)}"
                        )
                lines.append("")

            core = arch.get("core_modules", [])
            if core:
                lines.append("Core Modules:")
                for m in core:
                    lines.append(
                        f"  - {m.get('module')} "
                        f"(calls: {m.get('call_count', 0)})"
                    )
                lines.append("")

        # Workflows
        wf = context.get("workflows", {})
        if wf:
            lines += [
                "## Execution Workflows",
                f"Total: {wf.get('total', 0)}",
                "Sample:"
            ]
            for w in wf.get("sample", []):
                db = " [DB]" if w.get("touches_db") else ""
                lines.append(
                    f"  {w['name']}"
                    f"  depth={w.get('depth', 0)}"
                    f"  steps={w.get('steps', 0)}"
                    f"{db}"
                )
            lines.append("")

        # Database
        db_ctx = context.get("database", {})
        if db_ctx:
            lines += [
                "## Database",
                f"Has DB: {db_ctx.get('has_database', False)}"
            ]
            for db in db_ctx.get("databases", []):
                orm = (
                    f" via {db['orm']}"
                    if db.get("orm") else ""
                )
                lines.append(
                    f"  - {db['type']}{orm} "
                    f"(detected via: "
                    f"{', '.join(db.get('detected_via', []))})"
                )
            models = db_ctx.get("db_models", [])
            if models:
                names = [m["name"] for m in models[:10]]
                lines.append(
                    f"  Models: {', '.join(names)}"
                )
            lines.append("")

        # Routes
        routes = context.get("routes", {})
        if routes:
            lines += [
                "## API Routes",
                f"Total: {routes.get('total', 0)}  "
                f"API: {routes.get('api_routes', 0)}  "
                f"Pages: {routes.get('page_routes', 0)}",
                f"Frameworks: "
                f"{', '.join(routes.get('frameworks', []))}",
                "Sample:"
            ]
            for r in routes.get("sample", [])[:15]:
                lines.append(
                    f"  {r['method']:6s} {r['path']}"
                    + (
                        f"  → {r['handler']}"
                        if r.get("handler") else ""
                    )
                )
            lines.append("")

        # Knowledge graph stats
        kg = context.get("knowledge_graph", {})
        if kg:
            nt = kg.get("node_types", {})
            et = kg.get("edge_types", {})
            lines += [
                "## Knowledge Graph",
                f"Nodes: {kg.get('total_nodes', 0)}  "
                f"Edges: {kg.get('total_edges', 0)}",
                f"  files={nt.get('file', 0)}  "
                f"classes={nt.get('class', 0)}  "
                f"functions={nt.get('function', 0)}",
                f"  imports={et.get('imports', 0)}  "
                f"calls={et.get('calls', 0)}  "
                f"inherits={et.get('inherits', 0)}",
                ""
            ]

        lines += [
            "## Instructions",
            "- Be specific. Reference actual file names, "
            "class names, and function names.",
            "- If something is unclear from the analysis, "
            "say so rather than guessing.",
            "- Keep answers focused and actionable.",
            "- Use markdown formatting in your response."
        ]

        return "\n".join(lines)

    def _build_file_system_prompt(
        self,
        context: dict
    ) -> str:

        repo   = context.get("repository", "")
        f_path = context.get("target_file", "")
        arch   = context.get("architecture", {})
        fc     = context.get("file_context", {})
        source = context.get("file_source", "")

        lines = [
            f"You are CodeMind AI analyzing the file "
            f"`{f_path}` in the `{repo}` repository.",
            ""
        ]

        if arch:
            lines += [
                f"Repository pattern : "
                f"{arch.get('pattern', 'Unknown')}",
                f"Repository layers  : "
                f"{', '.join(arch.get('detected_layers', []))}",
                ""
            ]

        if fc:
            lines += ["## File's role in the graph"]
            if fc.get("contains"):
                lines.append(
                    "  Defines: "
                    + ", ".join(fc["contains"][:15])
                )
            if fc.get("imports"):
                lines.append(
                    "  Imports: "
                    + ", ".join(fc["imports"][:15])
                )
            if fc.get("imported_by"):
                lines.append(
                    "  Imported by: "
                    + ", ".join(fc["imported_by"][:10])
                )
            lines.append("")

        if source:
            lines += [
                "## File Source",
                "```python",
                source,
                "```",
                ""
            ]

        lines += [
            "Explain this file clearly and specifically.",
            "Reference actual class/function names.",
            "Use markdown formatting."
        ]

        return "\n".join(lines)

    def _build_fn_system_prompt(
        self,
        context: dict
    ) -> str:

        repo  = context.get("repository", "")
        fn    = context.get("target_function", "")
        arch  = context.get("architecture", {})
        calls = context.get("outgoing_calls", {})
        callers = context.get("callers", {})
        wf_membership = context.get(
            "workflow_membership", []
        )

        lines = [
            f"You are CodeMind AI analyzing the function "
            f"`{fn}()` in the `{repo}` repository.",
            ""
        ]

        if arch:
            lines += [
                f"Architecture: {arch.get('pattern', '')}",
                ""
            ]

        # Outgoing calls
        call_edges = calls.get("calls", [])
        if call_edges:
            lines += ["## What it calls"]
            for e in call_edges[:15]:
                lines.append(
                    f"  → {e.get('callee', '')}"
                    f"  [{e.get('resolution', '')}]"
                )
            lines.append("")

        # Callers
        caller_edges = callers.get("called_by", [])
        if caller_edges:
            lines += ["## Who calls it"]
            for e in caller_edges[:15]:
                lines.append(
                    f"  ← {e.get('caller', '')}"
                )
            lines.append("")

        # Workflow membership
        if wf_membership:
            lines += ["## Part of workflows"]
            for wf in wf_membership[:8]:
                lines.append(
                    f"  {wf['method']} {wf['path']}"
                )
            lines.append("")

        lines += [
            "Explain this function clearly.",
            "Reference actual callers and callees by name.",
            "Use markdown formatting."
        ]

        return "\n".join(lines)
