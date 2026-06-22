# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Map

- [AGENTS.md](AGENTS.md) — comprehensive codebase guide (read first for any non-trivial task)
- [SPEC.md](SPEC.md) — system design and data flow (⚠️ outdated: still describes 3 departments, reality is 9)
- [README.md](README.md) — project overview and feature summary
- [docs/api-committee-flow.md](docs/api-committee-flow.md) — SSE event types and error handling

## Quick Commands

```bash
# Backend — run from project root (not from backend/)
cd backend
pip install -r requirements.txt
cp .env.example .env                # edit OPENAI_API_KEY if needed

# Run from PROJECT ROOT (main.py uses absolute `from backend.xxx` imports):
uvicorn backend.main:app --reload   # runs on :8000, docs at /docs

# Backend tests (pytest + pytest-asyncio)
python -m pytest backend/tests/ -q
python -m pytest backend/tests/test_state_manager.py -q   # single file (28 tests, all pass)

# Frontend
cd frontend
npm install
npm run dev                # runs on :3000, proxies /api to :8000
npm run build              # tsc -b && vite build
npm run preview            # preview production build
```

**Python version note:** The code uses `str | None` union syntax (PEP 604, requires 3.10+). The `from __future__ import annotations` in all `.py` files makes this compatible with 3.8+, but the minimum practical version is 3.10.

## Two Independent Analysis Pipelines + Four UI Tabs

The frontend has **four tabs** (App.tsx), but only two connect to real backend pipelines:

| Tab | Route | Backend | Key Agent |
| --- | --- | --- | --- |
| **模拟投决会** (Committee Flow) | `/` | `POST /api/analyze/stream` | `orchestrator_v2.py` |
| **材料分析** (Material Analysis) | `/pdf` | `POST /api/analyze/material/stream` | `material_analyzer.py` |
| **多Agent对话** (Multi-Agent Chat) | `/chat` | `POST /api/agents/discuss` | `quantsmart/services/agent_service.py` |
| **知识库** (Knowledge Base) | `/knowledge` | `GET /api/knowledge/analysis` | `quantsmart/routers/knowledge.py` |

Both streaming endpoints use SSE with the same event format (`type: stage_start/stage_complete/flow_complete/error`).

## Committee Flow Orchestration

`orchestrator_v2.py` runs 4 sequential stages:

1. **SecretaryAgent** — serial, critical path (failure → abort)
2. **9 DepartmentAgents** — parallel, tolerate individual failure (investment, asset_management, market, operation, financial, design, engineering, cost, legal)
3. **32 MasterAgents** — parallel, user-selectable via `selected_masters` param (defined in `master_skill_agent.py` MASTER_REGISTRY and `frontend/src/data/masters.ts`; both in sync at 32)
4. **DecisionMakerAgent** — serial, final verdict (投/改/退) + rating (A/B+/B/C)

SSE events include intermediate `department_started`/`department_complete` and `master_started`/`master_complete` for real-time progress. Results are persisted via `FlowStateManager` to `DATA_DIR/{session_id}/`.

## Mock Mode

The frontend runs entirely in **mock mode by default** — no backend required. Controlled by:

- `vite.config.ts`: `define: { 'import.meta.env.VITE_USE_MOCK': JSON.stringify('true') }`
- `api.ts`: `USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'`

All four pages (Material Analysis, Committee Flow, Multi-Agent Chat, Knowledge Base) have full mock implementations with realistic streaming delays. To connect to a real backend, change the Vite config or set `VITE_USE_MOCK=false`.

The frontend also supports a `VITE_API_BASE` env var (defaults to `''`, i.e., same-origin — relies on the Vite dev proxy).

## Key Patterns

### Python Backend

- All Agent classes take `api_key, api_base, model="gpt-4o", timeout=300`
- LLM calls use `_call_llm` with httpx + 3 retries (exponential backoff: `2^attempt`)
- JSON extraction via `_parse_json_response`: try direct `json.loads`, then extract ` ```json ``` ` blocks
- Scores validated to 0–100 range with `_validate_score`, fallback to 50 on error
- Files use `from __future__ import annotations` and Chinese module docstrings
- `config.py` uses frozen-style `@dataclass` with `field(default_factory=lambda: os.getenv(...))`
- All imports from `main.py` use absolute `backend.` prefix — run server from project root, not from `backend/`

### TypeScript Frontend

- `@/` path alias → `src/`
- shadcn/ui components in `src/components/ui/`, added via `npx shadcn add`
- All pages are function components + Hooks, default exports
- Tailwind with dark slate theme (`slate-900 → slate-50`), custom CSS variables in `index.css`
- Framer Motion with easings like `[0.16, 1, 0.3, 1]`
- HashRouter (react-router-dom), not BrowserRouter — all routes are hash-based

## Known Issues (Do Not Reintroduce)

1. **`test_committee_flow.py`** — imports `RiskAssessorAgent` which no longer exists (replaced by 9 separate department agents). The test will fail during collection.
2. **`api.ts` uses `axios` without import** — `analyzeMaterial()`, `listAnalysisMaterials()`, `getAnalysisMaterial()`, `searchAnalysisMaterials()` call `axios.*` but `axios` is neither imported in the file nor listed in `package.json`. These calls throw `ReferenceError` at runtime.
3. **`.gitignore` contains `*.json`** — this blocks ALL JSON files including `package.json`, `tsconfig.json`, `components.json`, etc. This is a serious issue that would prevent anyone from committing config files.
