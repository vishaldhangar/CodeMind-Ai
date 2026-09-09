import os
import json
import asyncio

from app.services.context_builder_service import ContextBuilderService


# ── Provider selection ────────────────────────────────
# Set AI_PROVIDER=gemini  to use Google Gemini
# Set AI_PROVIDER=openai  to use OpenAI  (default)
AI_PROVIDER = os.environ.get("AI_PROVIDER", "gemini").lower()

OPENAI_API_KEY  = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODEL    = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

GEMINI_API_KEY  = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL    = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")


def _get_openai_client():
    from openai import OpenAI
    return OpenAI(api_key=OPENAI_API_KEY)


def _get_gemini_client():
    from google import genai
    return genai.Client(api_key=GEMINI_API_KEY)


# ── Shared chat caller ────────────────────────────────

def _call_ai(system_prompt: str, user_message: str) -> tuple[str, str]:
    """
    Call the configured AI provider.
    Returns (answer, model_name).
    """
    if AI_PROVIDER == "gemini":
        return _call_gemini(system_prompt, user_message)
    return _call_openai(system_prompt, user_message)


def _call_openai(system_prompt: str, user_message: str) -> tuple[str, str]:
    client = _get_openai_client()
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message}
        ],
        temperature=0.2
    )
    return response.choices[0].message.content, OPENAI_MODEL


def _call_gemini(system_prompt: str, user_message: str) -> tuple[str, str]:
    from google.genai import types
    client = _get_gemini_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2
        )
    )
    return response.text, GEMINI_MODEL


# ── Streaming helpers ─────────────────────────────────

async def _stream_openai(system_prompt: str, user_message: str):
    """Async generator yielding (token, model) tuples."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    stream = await client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_message}
        ],
        temperature=0.2,
        stream=True
    )
    async for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        if token:
            yield token, OPENAI_MODEL


async def _stream_gemini(system_prompt: str, user_message: str):
    """Async generator yielding (token, model) tuples."""
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=GEMINI_API_KEY)

    def _sync_stream():
        return client.models.generate_content_stream(
            model=GEMINI_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2
            )
        )
    chunks = await asyncio.to_thread(_sync_stream)
    for chunk in chunks:
        token = chunk.text or ""
        if token:
            yield token, GEMINI_MODEL


async def _stream_ai(system_prompt: str, user_message: str):
    if AI_PROVIDER == "gemini":
        async for token, model in _stream_gemini(system_prompt, user_message):
            yield token, model
    else:
        async for token, model in _stream_openai(system_prompt, user_message):
            yield token, model


# ── Service ───────────────────────────────────────────

class AIAssistantService:

    def chat(
        self,
        repo_name: str,
        question: str,
        show_thinking: bool = False
    ) -> dict:
        context = ContextBuilderService().build(repo_name, question)
        system_prompt = self._build_system_prompt(context)
        answer, model = _call_ai(system_prompt, question)

        return {
            "repository":       repo_name,
            "question":         question,
            "answer":           answer,
            "model":            model,
            "provider":         AI_PROVIDER,
            "intents_detected": context.get("intents_detected", [])
        }

    async def stream_chat(self, repo_name: str, question: str):
        context = await asyncio.to_thread(
            ContextBuilderService().build, repo_name, question
        )
        system_prompt = self._build_system_prompt(context)

        model_name = OPENAI_MODEL if AI_PROVIDER == "openai" else GEMINI_MODEL

        try:
            async for token, model_name in _stream_ai(system_prompt, question):
                yield f"data: {json.dumps({'token': token})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

        yield f"data: {json.dumps({'done': True, 'model': model_name, 'provider': AI_PROVIDER, 'question': question, 'intents': context.get('intents_detected', [])})}\n\n"

    def explain_file(
        self,
        repo_name: str,
        file_path: str,
        show_thinking: bool = False
    ) -> dict:
        context = ContextBuilderService().build_for_file(repo_name, file_path)
        system_prompt = self._build_file_system_prompt(context)
        question = (
            f"Explain what `{file_path}` does, "
            f"its role in the codebase architecture, "
            f"what it provides, and how it fits with the other components."
        )
        answer, model = _call_ai(system_prompt, question)

        return {
            "repository":  repo_name,
            "file":        file_path,
            "explanation": answer,
            "model":       model,
            "provider":    AI_PROVIDER
        }

    def explain_function(
        self,
        repo_name: str,
        function_name: str,
        show_thinking: bool = False
    ) -> dict:
        context = ContextBuilderService().build_for_function(repo_name, function_name)
        system_prompt = self._build_fn_system_prompt(context)
        question = (
            f"Explain what the function `{function_name}()` does, its purpose, "
            f"inputs/outputs, what it calls, who calls it, and its role in the system."
        )
        answer, model = _call_ai(system_prompt, question)

        return {
            "repository":  repo_name,
            "function":    function_name,
            "explanation": answer,
            "model":       model,
            "provider":    AI_PROVIDER
        }

    def health_check(self) -> dict:
        try:
            if AI_PROVIDER == "gemini":
                if not GEMINI_API_KEY:
                    raise ValueError("GEMINI_API_KEY is not set")
                from google import genai
                client = genai.Client(api_key=GEMINI_API_KEY)
                models = [m.name for m in client.models.list()]
                return {
                    "provider":        "gemini",
                    "model":           GEMINI_MODEL,
                    "api_key_set":     True,
                    "available_models": models[:10]
                }
            else:
                if not OPENAI_API_KEY:
                    raise ValueError("OPENAI_API_KEY is not set")
                from openai import OpenAI
                client = OpenAI(api_key=OPENAI_API_KEY)
                models = [m.id for m in client.models.list().data]
                return {
                    "provider":        "openai",
                    "model":           OPENAI_MODEL,
                    "api_key_set":     True,
                    "available_models": sorted(models)[:10]
                }
        except Exception as e:
            return {
                "provider":    AI_PROVIDER,
                "api_key_set": bool(OPENAI_API_KEY or GEMINI_API_KEY),
                "error":       str(e),
                "hint": (
                    "Set OPENAI_API_KEY and AI_PROVIDER=openai, "
                    "or GEMINI_API_KEY and AI_PROVIDER=gemini in your .env file."
                )
            }

    # ── System prompt builders (unchanged) ───────────

    def _build_system_prompt(self, context: dict) -> str:
        repo = context.get("repository", "unknown")
        lines = [
            f"You are CodeMind AI — an expert software architect and code intelligence assistant "
            f"with deep knowledge of the `{repo}` repository.",
            "",
            "The following intelligence was automatically extracted from the codebase using static "
            "analysis. Use it to answer questions accurately and specifically.",
            ""
        ]

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
                        lines.append(f"  {category}: {', '.join(items)}")
                lines.append("")
            core = arch.get("core_modules", [])
            if core:
                lines.append("Core Modules:")
                for m in core:
                    lines.append(f"  - {m.get('module')} (calls: {m.get('call_count', 0)})")
                lines.append("")

        wf = context.get("workflows", {})
        if wf:
            lines += ["## Execution Workflows", f"Total: {wf.get('total', 0)}", "Sample:"]
            for w in wf.get("sample", []):
                db = " [DB]" if w.get("touches_db") else ""
                lines.append(f"  {w['name']}  depth={w.get('depth', 0)}  steps={w.get('steps', 0)}{db}")
            lines.append("")

        db_ctx = context.get("database", {})
        if db_ctx:
            lines += ["## Database", f"Has DB: {db_ctx.get('has_database', False)}"]
            for db in db_ctx.get("databases", []):
                orm = f" via {db['orm']}" if db.get("orm") else ""
                lines.append(f"  - {db['type']}{orm} (detected via: {', '.join(db.get('detected_via', []))})")
            models = db_ctx.get("db_models", [])
            if models:
                lines.append(f"  Models: {', '.join(m['name'] for m in models[:10])}")
            lines.append("")

        routes = context.get("routes", {})
        if routes:
            lines += [
                "## API Routes",
                f"Total: {routes.get('total', 0)}  API: {routes.get('api_routes', 0)}  Pages: {routes.get('page_routes', 0)}",
                f"Frameworks: {', '.join(routes.get('frameworks', []))}",
                "Sample:"
            ]
            for r in routes.get("sample", [])[:15]:
                lines.append(
                    f"  {r['method']:6s} {r['path']}"
                    + (f"  → {r['handler']}" if r.get("handler") else "")
                )
            lines.append("")

        kg = context.get("knowledge_graph", {})
        if kg:
            nt = kg.get("node_types", {})
            et = kg.get("edge_types", {})
            lines += [
                "## Knowledge Graph",
                f"Nodes: {kg.get('total_nodes', 0)}  Edges: {kg.get('total_edges', 0)}",
                f"  files={nt.get('file', 0)}  classes={nt.get('class', 0)}  functions={nt.get('function', 0)}",
                f"  imports={et.get('imports', 0)}  calls={et.get('calls', 0)}  inherits={et.get('inherits', 0)}",
                ""
            ]

        lines += [
            "## Instructions",
            "- Be specific. Reference actual file names, class names, and function names.",
            "- If something is unclear from the analysis, say so rather than guessing.",
            "- Keep answers focused and actionable.",
            "- Use markdown formatting in your response."
        ]
        return "\n".join(lines)

    def _build_file_system_prompt(self, context: dict) -> str:
        repo   = context.get("repository", "")
        f_path = context.get("target_file", "")
        arch   = context.get("architecture", {})
        fc     = context.get("file_context", {})
        source = context.get("file_source", "")

        lines = [f"You are CodeMind AI analyzing the file `{f_path}` in the `{repo}` repository.", ""]

        if arch:
            lines += [
                f"Repository pattern : {arch.get('pattern', 'Unknown')}",
                f"Repository layers  : {', '.join(arch.get('detected_layers', []))}",
                ""
            ]
        if fc:
            lines += ["## File's role in the graph"]
            if fc.get("contains"):
                lines.append("  Defines: " + ", ".join(fc["contains"][:15]))
            if fc.get("imports"):
                lines.append("  Imports: " + ", ".join(fc["imports"][:15]))
            if fc.get("imported_by"):
                lines.append("  Imported by: " + ", ".join(fc["imported_by"][:10]))
            lines.append("")
        if source:
            lines += ["## File Source", "```python", source, "```", ""]

        lines += ["Explain this file clearly and specifically.", "Reference actual class/function names.", "Use markdown formatting."]
        return "\n".join(lines)

    def _build_fn_system_prompt(self, context: dict) -> str:
        repo    = context.get("repository", "")
        fn      = context.get("target_function", "")
        arch    = context.get("architecture", {})
        calls   = context.get("outgoing_calls", {})
        callers = context.get("callers", {})
        wf_membership = context.get("workflow_membership", [])

        lines = [f"You are CodeMind AI analyzing the function `{fn}()` in the `{repo}` repository.", ""]

        if arch:
            lines += [f"Architecture: {arch.get('pattern', '')}", ""]

        call_edges = calls.get("calls", [])
        if call_edges:
            lines += ["## What it calls"]
            for e in call_edges[:15]:
                lines.append(f"  → {e.get('callee', '')}  [{e.get('resolution', '')}]")
            lines.append("")

        caller_edges = callers.get("called_by", [])
        if caller_edges:
            lines += ["## Who calls it"]
            for e in caller_edges[:15]:
                lines.append(f"  ← {e.get('caller', '')}")
            lines.append("")

        if wf_membership:
            lines += ["## Part of workflows"]
            for wf in wf_membership[:8]:
                lines.append(f"  {wf['method']} {wf['path']}")
            lines.append("")

        lines += ["Explain this function clearly.", "Reference actual callers and callees by name.", "Use markdown formatting."]
        return "\n".join(lines)
