# CodeMind AI — Codebase Intelligence Platform

CodeMind AI is an AI-powered code analysis platform that lets you deeply understand any repository in minutes. Import a GitHub repo, and instantly get architecture analysis, dependency graphs, workflow traces, impact analysis, and an AI assistant that can answer questions about your codebase.

---

## Features

| Feature | Description |
|---|---|
| **Overview Dashboard** | Repository health, top languages, architecture pattern, key files, and recent activity at a glance |
| **Architecture Analysis** | Detects patterns (MVC, Layered, Microservices), identifies core modules, tech stack, and architectural layers |
| **Workflow Tracing** | Maps end-to-end request flows from HTTP routes through the call graph to database calls |
| **Dependency Graph** | Interactive visualization of module dependencies with internal/external breakdown and coupling metrics |
| **Knowledge Graph** | Full code structure map — files, functions, classes and their relationships — with full-text search |
| **APIs & Routes** | Discovers all HTTP endpoints across frameworks, with method, handler, and auth detection |
| **Database Intelligence** | Detects databases, ORMs, models/schemas, and raw queries automatically |
| **Impact Analysis** | Calculates blast radius of any file or function change — direct, transitive, and workflow impact |
| **AI Assistant** | Streaming chat powered by OpenAI or Gemini to ask anything about your codebase |

---

## Tech Stack

**Frontend**
- React 19 + Vite
- React Flow (interactive graph visualization)
- CSS custom properties with dark/light theme

**Backend**
- FastAPI + Uvicorn (async Python)
- NetworkX (graph analysis)
- GitPython (repository cloning)
- OpenAI SDK / Google GenAI SDK
- Regex-based AST parsers for Python and JavaScript/TypeScript

---

## Project Structure

```
CodeMind-Ai/
├── client/                         # React frontend
│   └── src/
│       ├── pages/                  # One file per feature page
│       ├── components/             # Shared UI components
│       ├── api.js                  # Backend API client
│       ├── AppContext.jsx          # Global state
│       └── App.jsx                 # App shell + routing
│
└── server/                         # FastAPI backend
    ├── app/
    │   ├── main.py                 # App entry point + router registration
    │   ├── api/                    # HTTP route handlers
    │   ├── services/               # Business logic layer
    │   ├── graph/                  # Graph builders (dependency, call, knowledge)
    │   ├── parsers/                # Language parsers (Python, JS/TS, routes)
    │   └── schemas/                # Pydantic models
    ├── repositories/               # Cloned repos stored here
    ├── requirements.txt
    └── .env                        # Environment config
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.9+
- **Git**
- An **OpenAI** or **Google Gemini** API key

### 1. Clone the repository

```bash
git clone https://github.com/your-username/CodeMind-Ai.git
cd CodeMind-Ai
```

### 2. Backend setup

```bash
cd server

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys (see Configuration section)

# Start the server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend runs at **http://localhost:8000**  
Interactive API docs at **http://localhost:8000/docs**

### 3. Frontend setup

```bash
cd client

npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

---

## Configuration

Create `server/.env` with the following:

```env
# Choose your AI provider: "openai" or "gemini"
AI_PROVIDER=gemini

# OpenAI (if AI_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Google Gemini (if AI_PROVIDER=gemini)
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-flash
```

Only one provider needs to be configured. The `AI_PROVIDER` variable selects which one is active.

---

## Usage

### Importing a repository

1. Click **+ Import Repository** in the sidebar
2. Paste a GitHub URL (e.g. `https://github.com/vercel/next.js`)
3. Wait for cloning and indexing to complete
4. Select the repo from the sidebar to start exploring

### Impact Analysis

Navigate to **💥 Impact Analysis**, enter a file path relative to the repo root (e.g. `lib/prisma.js`) or switch to **Function** mode and enter a function name. Click **Analyze** to see:

- Blast radius classification (none / low / medium / high / critical)
- Direct and transitive dependents
- Affected architectural layers and workflows

### AI Assistant

The AI panel on the right side of the screen allows you to:

- Ask free-form questions about the codebase
- Get file-level explanations
- Trace how specific features are implemented
- Chat history is saved per repository in your browser

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/repo/import` | Import a GitHub repository |
| `GET` | `/repo/list` | List all imported repositories |
| `GET` | `/architecture/{repo}` | Architecture analysis |
| `GET` | `/dependencies/{repo}` | Dependency graph |
| `GET` | `/callgraph/{repo}` | Function call graph |
| `GET` | `/workflow/{repo}` | Workflow traces |
| `GET` | `/routes/{repo}` | Detected API routes |
| `GET` | `/database/{repo}` | Database & model detection |
| `GET` | `/knowledge/{repo}/search?q=` | Knowledge graph search |
| `GET` | `/impact/{repo}/file?path=` | File impact analysis |
| `GET` | `/impact/{repo}/function/{name}` | Function impact analysis |
| `POST` | `/assistant/{repo}/chat/stream` | Streaming AI chat |

Full interactive documentation: **http://localhost:8000/docs**

---

## Supported Languages

| Language | AST Parsing | Dependencies | Call Graph | Routes |
|---|---|---|---|---|
| Python | ✅ | ✅ | ✅ | ✅ FastAPI / Django / Flask |
| JavaScript | ✅ | ✅ | ✅ | ✅ Express / Next.js |
| TypeScript | ✅ | ✅ | ✅ | ✅ NestJS / Next.js |
| JSX / TSX | ✅ | ✅ | ✅ | ✅ Next.js App Router |

---

## Deployment

CodeMind AI has two independently deployable parts:

| Part | Recommended Platform | Notes |
|---|---|---|
| **Frontend** | Vercel / Netlify | Static build via `npm run build` |
| **Backend** | Railway / Render / Fly.io | Needs persistent disk for `repositories/` folder |

### Deploy backend to Railway

1. Push the `server/` directory to a GitHub repo
2. Create a new Railway project → **Deploy from GitHub**
3. Set environment variables (`AI_PROVIDER`, `GEMINI_API_KEY` or `OPENAI_API_KEY`)
4. Add a persistent volume mounted at `/app/repositories`

> **Important:** Do not deploy the backend to Vercel — it requires a persistent filesystem and long-running processes, which serverless platforms do not support.

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `AI_PROVIDER` | Yes | `gemini` | AI backend: `openai` or `gemini` |
| `OPENAI_API_KEY` | If using OpenAI | — | OpenAI secret key |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI model name |
| `GEMINI_API_KEY` | If using Gemini | — | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | Gemini model name |

---

## License

MIT
