import re
from pathlib import Path


# ── Compiled patterns ─────────────────────────────────

# Named function declarations (handles generics like foo<T>)
_FN_DECL = re.compile(
    r'^[^\S\n]*(?:export\s+)?(?:default\s+)?(?:async\s+)?'
    r'function\s*\*?\s+(\w+)\s*[(<]',
    re.MULTILINE
)

# Function expressions & arrow functions assigned to a variable
_FN_EXPR = re.compile(
    r'^[^\S\n]*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*='
    r'\s*(?:async\s+)?(?:function[\s(*]|\([^)]*\)\s*=>|\w+\s*=>)',
    re.MULTILINE
)

# Class declarations (handles generics like class Foo<T>)
_CLASS_DECL = re.compile(
    r'(?:^[^\S\n]*)?(?:export\s+)?(?:default\s+)?class\s+(\w+)'
    r'(?:\s+extends\s+([\w.]+))?',
    re.MULTILINE
)

# Method definition inside a class body (indented, various modifiers)
_METHOD_DEF = re.compile(
    r'^[ \t]{2,}'
    r'(?:(?:static|async|get|set|public|private|protected|'
    r'readonly|override|abstract|declare)\s+)*'
    r'(?:#)?(\w+)\s*[(<]',
    re.MULTILINE
)

# ES module imports (handles multi-line with DOTALL)
_IMPORT_ES = re.compile(
    r'import\s+(?:type\s+)?'
    r'(?:'
    r'\*\s+as\s+(\w+)'                        # group 1: * as name
    r'|\{([^}]*)\}'                            # group 2: { named }
    r'|(\w+)(?:\s*,\s*\{([^}]*)\})?'          # group 3: default [, group 4: named]
    r')'
    r'\s+from\s+[\'"]([^\'"]+)[\'"]',          # group 5: module path
    re.DOTALL
)

# Side-effect only import: import 'module'
_IMPORT_SIDE = re.compile(r"import\s+['\"]([^'\"]+)['\"]")

# CommonJS require
_REQUIRE = re.compile(
    r'(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*='
    r'\s*require\s*\([\'"]([^\'"]+)[\'"]\)'
)

# Function call: identifier(  —  we capture the identifier
_CALL = re.compile(r'\b(\w+)\s*\(')

# JS/TS keywords and built-ins to skip when collecting calls
_SKIP_CALLS = frozenset({
    'if', 'for', 'while', 'switch', 'catch', 'function',
    'return', 'typeof', 'instanceof', 'new', 'delete', 'void',
    'throw', 'await', 'yield', 'async', 'class', 'extends',
    'import', 'export', 'from', 'of', 'in', 'let', 'const', 'var',
    'true', 'false', 'null', 'undefined', 'this', 'super',
    'console', 'Math', 'Object', 'Array', 'String', 'Number',
    'Boolean', 'Promise', 'Error', 'Date', 'JSON', 'Symbol',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'RegExp', 'window',
    'document', 'process', 'module', 'exports', 'global',
    'parseInt', 'parseFloat', 'isNaN', 'isFinite',
    'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'require', 'describe', 'it', 'test', 'expect',
    'beforeEach', 'afterEach', 'beforeAll', 'afterAll',
    'vi', 'jest', 'constructor', 'get', 'set', 'static',
    'React', 'useState', 'useEffect', 'useRef', 'useMemo',
    'useCallback', 'useContext', 'useReducer',
})

# Method names that are syntactic noise, not real methods
_SKIP_METHODS = frozenset({
    'if', 'for', 'while', 'switch', 'catch', 'return',
    'constructor', 'get', 'set', 'static', 'async',
    'public', 'private', 'protected', 'else', 'try',
})


class JsTsParser:
    """
    Regex + brace-matching parser for JS/TS/JSX/TSX files.
    Produces the same symbol structure as PythonParser so all
    downstream graph builders work without modification.
    """

    def extract_symbols(self, file_path: str) -> dict:
        text = Path(file_path).read_text(
            encoding='utf-8', errors='ignore'
        )

        functions: list[dict]         = []
        classes:   list[dict]         = []
        imports:   list[dict]         = []
        fn_calls:  dict[str, list]    = {}

        # ── 1. Classes ────────────────────────────────
        class_spans: list[tuple] = []

        for m in _CLASS_DECL.finditer(text):
            cname = m.group(1)
            bases = [m.group(2)] if m.group(2) else []
            start = m.start()
            end   = self._find_block_end(text, start)
            class_spans.append((start, end, cname, bases))

        class_method_names: set[str] = set()

        for start, end, cname, bases in class_spans:
            body  = text[start:end + 1]
            line  = text[:start].count('\n') + 1
            methods: list[str] = []

            for mm in _METHOD_DEF.finditer(body):
                mname = mm.group(1)
                if mname not in _SKIP_METHODS:
                    methods.append(mname)
                    class_method_names.add(mname)
                    # Add method to functions list (same as PythonParser does)
                    mline = line + body[:mm.start()].count('\n')
                    mbody_end = self._find_block_end(body, mm.start())
                    mbody = body[mm.start():mbody_end + 1]
                    functions.append({
                        'name':      mname,
                        'line':      mline,
                        'is_method': True,
                    })
                    fn_calls[mname] = self._extract_calls(mbody, mname)

            classes.append({
                'name':    cname,
                'line':    line,
                'bases':   bases,
                'methods': methods,
            })

        # ── 2. Functions ──────────────────────────────
        fn_spans: list[tuple] = []  # (char_start, char_end, name)

        for m in _FN_DECL.finditer(text):
            end = self._find_block_end(text, m.start())
            fn_spans.append((m.start(), end, m.group(1)))

        for m in _FN_EXPR.finditer(text):
            end = self._find_block_end(text, m.start())
            fn_spans.append((m.start(), end, m.group(1)))

        # Deduplicate by name (keep first occurrence)
        seen_fns: set[str] = set()
        for start, end, fname in fn_spans:
            if fname in seen_fns:
                continue
            seen_fns.add(fname)

            line      = text[:start].count('\n') + 1
            is_method = fname in class_method_names
            functions.append({
                'name':      fname,
                'line':      line,
                'is_method': is_method,
            })

            body = text[start:end + 1]
            fn_calls[fname] = self._extract_calls(body, fname)

        # ── 3. Imports ────────────────────────────────

        # ES module imports
        for m in _IMPORT_ES.finditer(text):
            module = m.group(5) or ''

            if m.group(1):  # * as name
                imports.append({
                    'module':        module,
                    'imported_name': m.group(1),
                    'full_import':   f'{module}.{m.group(1)}',
                })

            for raw_group in (m.group(2), m.group(4)):  # { named }
                if not raw_group:
                    continue
                for part in re.split(r'\s*,\s*', raw_group):
                    name = part.strip().split(' as ')[-1].strip()
                    if name:
                        imports.append({
                            'module':        module,
                            'imported_name': name,
                            'full_import':   f'{module}.{name}',
                        })

            if m.group(3):  # default import
                imports.append({
                    'module':        module,
                    'imported_name': m.group(3),
                    'full_import':   f'{module}.{m.group(3)}',
                })

        # Side-effect imports (no ES named match on same line)
        es_positions = {m.start() for m in _IMPORT_ES.finditer(text)}
        for m in _IMPORT_SIDE.finditer(text):
            if m.start() not in es_positions:
                imports.append({'module': m.group(1)})

        # CommonJS require
        for m in _REQUIRE.finditer(text):
            module = m.group(3) or ''
            if m.group(1):  # destructured { a, b }
                for part in re.split(r'\s*,\s*', m.group(1)):
                    name = part.strip()
                    if name:
                        imports.append({
                            'module':        module,
                            'imported_name': name,
                            'full_import':   f'{module}.{name}',
                        })
            elif m.group(2):
                imports.append({
                    'module':        module,
                    'imported_name': m.group(2),
                    'full_import':   f'{module}.{m.group(2)}',
                })

        return {
            'functions':      functions,
            'classes':        classes,
            'imports':        imports,
            'function_calls': fn_calls,
        }

    # ── Helpers ───────────────────────────────────────

    def _find_block_end(self, text: str, start: int) -> int:
        """
        Find the index of the closing } that ends the brace-block
        starting at or after `start`. Skips string literals so
        braces inside strings are ignored.
        """
        depth    = 0
        opened   = False
        in_str   = False
        str_char = ''
        i        = start

        while i < len(text):
            ch = text[i]

            if in_str:
                if ch == '\\':
                    i += 2
                    continue
                if ch == str_char:
                    in_str = False
            elif ch in ('"', "'", '`'):
                in_str   = True
                str_char = ch
            elif ch == '{':
                depth  += 1
                opened  = True
            elif ch == '}':
                depth -= 1
                if opened and depth == 0:
                    return i
            i += 1

        # Fallback: return a reasonable end (50 lines ahead)
        newlines = 0
        i = start
        while i < len(text) and newlines < 50:
            if text[i] == '\n':
                newlines += 1
            i += 1
        return min(i, len(text) - 1)

    def _extract_calls(self, body: str, own_name: str) -> list[str]:
        """
        Find all function call names inside `body`,
        skipping JS keywords and the function's own name.
        """
        seen:  set[str]  = set()
        calls: list[str] = []

        for m in _CALL.finditer(body):
            name = m.group(1)
            if name in _SKIP_CALLS or name == own_name or name in seen:
                continue
            seen.add(name)
            calls.append(name)

        return calls
