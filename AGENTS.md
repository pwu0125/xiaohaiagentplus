# AGENTS.md - 小海Agent 投委会多Agent分析系统

> 本文件面向 AI 编程助手。若你第一次接触本项目，请优先阅读本文件，再动手改代码。

## 项目概述

**小海Agent** 是一个基于多 Agent 串行流程的投资决策分析全栈系统，模拟真实投委会工作流：

```
用户上传材料
  → 秘书Agent（结构化提取）
  → 9个部门Agent并行分析（投资/资管/市场/运营/财务/设计/工程/成本/法律）
  → 32位投资大师Agent并行洞察
  → 决策者Agent（最终投资结论：投 / 改 / 退，评级 A/B+/B/C）
```

后端通过 **SSE（Server-Sent Events）** 实时推送每个阶段/部门/大师的进度与结果，前端以流式界面展示进度条、部门状态、实时日志和最终报告。

此外，后端还包含一个 `quantsmart` 扩展模块，提供 PDF 扫描、知识库（书签/笔记）、多 Agent 对话与圆桌讨论的 API。当前导航栏已预留对应入口，但前端页面（`PdfScan.tsx`、`KnowledgeBase.tsx`、`MultiAgentChat.tsx`）尚未实现。

## 技术栈

### 后端 (`backend/`)

- **语言**：Python 3.12+
- **框架**：FastAPI + Uvicorn
- **HTTP 客户端**：httpx（调用 LLM，带指数退避重试）
- **数据校验**：Pydantic v2
- **环境配置**：python-dotenv + `backend/config.py`
- **LLM**：OpenAI-compatible API（默认 `gpt-4o`，可配置 base URL）
- **PDF 解析**：可选 PyMuPDF（`fitz`），未安装时 PDF 端点不可用
- **临时存储**：内存字典（`quantsmart/memory.py`），重启后数据丢失

### 前端 (`frontend/`)

- **框架**：React 19 + TypeScript
- **构建工具**：Vite 7
- **样式**：Tailwind CSS 3.4 + 深色 slate 主题（`src/index.css`）
- **组件库**：shadcn/ui（`src/components/ui/*`）
- **动画**：Framer Motion
- **图标**：lucide-react
- **路由**：react-router-dom（HashRouter）
- **类型**：严格 TypeScript（`tsconfig.app.json`：`strict: true`、`noUnusedLocals: true` 等）

## 关键配置文件

| 文件 | 说明 |
|------|------|
| `backend/requirements.txt` | Python 依赖，包含 fastapi、uvicorn、httpx、pydantic、pytest 等 |
| `backend/.env.example` | 环境变量模板：OPENAI_API_KEY、OPENAI_API_BASE、MODEL、DATA_DIR |
| `backend/config.py` | `Config` dataclass，集中读取环境变量与默认值 |
| `frontend/package.json` | npm 脚本与依赖 |
| `frontend/vite.config.ts` | Vite 配置，`@/` 别名指向 `./src` |
| `frontend/tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | TypeScript 工程引用配置 |
| `frontend/tailwind.config.js` | Tailwind 主题扩展与 CSS 变量 |
| `frontend/components.json` | shadcn/ui 配置（style: new-york，CSS 变量，iconLibrary: lucide） |

> 注意：项目**没有** `pyproject.toml`、`setup.py`、`Dockerfile`、CI/CD 配置或 ESLint 配置文件。

## 代码组织

```
backend/
├── main.py                          FastAPI 入口，注册 quantsmart 路由，定义 /api/analyze/*、/api/status/*、/health
├── config.py                        全局配置 Config
├── requirements.txt
├── .env.example
├── agents/                          投委会核心 Agent
│   ├── flow_state_manager.py        文件系统状态持久化
│   ├── secretary_agent.py           秘书Agent：材料结构化
│   ├── department_agents.py         9个部门Agent（BaseDepartmentAgent 基类）
│   ├── master_skill_agent.py        32位投资大师Agent + MASTER_REGISTRY
│   ├── decision_maker_agent.py      决策者Agent：加权评分与最终结论
│   └── orchestrator_v2.py           CommitteeFlowOrchestrator：编排 SSE 流程
├── quantsmart/                      扩展功能
│   ├── models.py                    Pydantic 请求/响应模型
│   ├── memory.py                    内存存储 MemoryStore（书签、Session）
│   ├── routers/                     FastAPI 路由（pdf、knowledge、chat、agent）
│   └── services/                    业务逻辑（pdf_service、kb_service、chat_service、agent_service）
└── tests/                           pytest 测试
    ├── test_state_manager.py
    └── test_committee_flow.py

frontend/
├── src/
│   ├── main.tsx                     React 根渲染
│   ├── App.tsx                      HashRouter + 顶部导航 + 路由配置
│   ├── index.css                    Tailwind 入口 + 深色主题 CSS 变量
│   ├── pages/
│   │   └── Home.tsx                 投资分析主页面
│   ├── lib/
│   │   ├── api.ts                   SSE 流式/非流式 API 客户端 + Mock 实现
│   │   └── utils.ts                 cn 工具函数
│   ├── hooks/
│   │   └── useCommitteeFlow.ts      流程状态管理 Hook
│   ├── types/
│   │   └── index.ts                 TypeScript 类型定义
│   ├── components/                  业务组件（FlowProgress、FinalReport、FileUpload 等）
│   └── components/ui/               shadcn/ui 组件库
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── components.json
```

## 构建与运行

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 OPENAI_API_KEY
uvicorn main:app --reload
```

默认端口 `8000`，自动文档见 `http://localhost:8000/docs`。

如需启用 PDF 解析，额外安装：

```bash
pip install pymupdf
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

开发服务器默认端口 `3000`。

生产构建：

```bash
npm run build
npm run preview
```

> 当前 `frontend/node_modules` 中缺少 `typescript`，首次构建前请先执行 `npm install`。
> 此外 `App.tsx` 引用了 `PdfScan.tsx`、`KnowledgeBase.tsx`、`MultiAgentChat.tsx`，但这三个页面文件不存在，构建/类型检查会因此报错。

## 测试

后端使用 **pytest** + **pytest-asyncio**。

```bash
cd backend
python -m pytest tests/ -q
```

当前状态：

- `tests/test_state_manager.py`：28 条测试全部通过。
- `tests/test_committee_flow.py`：因导入不存在的 `RiskAssessorAgent` 导致收集阶段失败（当前部门 Agent 已重构为 9 个：investment、asset_management、market、operation、financial、design、engineering、cost、legal，没有 risk 部门）。

前端目前没有测试脚本（`package.json` 无 test 命令）。

## 代码风格与约定

### Python

- 文件头使用中文模块 docstring 说明职责。
- 统一 `from __future__ import annotations`。
- 使用类型注解（`str | None`、`list[dict]` 等）。
- Agent 类统一接收 `api_key`、`api_base`、`model`、`timeout` 参数，默认模型 `gpt-4o`，默认超时 300 秒。
- LLM 调用封装在 `_call_llm` 中，使用 httpx + 3 次指数退避重试（`2^attempt`）。
- LLM 返回的 JSON 通过 `_parse_json_response` 解析：先直接解析，再尝试 ` ```json ` 代码块。
- 评分统一通过 `_validate_score` 限制到 `0-100`，缺失或非法时回退默认值（50 或加权评分）。
- 中文内容写入 JSON 时不转义（`ensure_ascii=False`）。
- 日志使用 `logging.getLogger(__name__)`，格式含 session_id 便于追踪。

### TypeScript / React

- 函数组件 + Hooks，默认导出组件。
- 使用 `@/` 路径别名引用 `src/` 下模块。
- 样式以 Tailwind 工具类为主，主题色使用 slate/blue/green/amber/red。
- 动画使用 `framer-motion`，常见缓动函数 `[0.16, 1, 0.3, 1]`。
- 图标来自 `lucide-react`。
- shadcn/ui 组件位于 `src/components/ui/`，通过 `npx shadcn add <component>` 管理。

## 数据流与状态持久化

1. 用户上传文件 → `POST /api/analyze/stream`。
2. 后端生成 `session_id` 与 `project_slug`。
3. 秘书 Agent 处理材料 → 保存到 `DATA_DIR/{session_id}/stages/01_secretary.json`。
4. 9 个部门 Agent 并发运行 → 保存到 `stages/02_departments/{department}.json`。
5. 选中的投资大师 Agent 并发运行 → 保存到 `stages/03_master_skill.json`。
6. 决策者 Agent 汇总 → 保存到 `stages/04_decision_maker.json`。
7. 最终完整报告保存为 `{session_id}/analysis.json`。
8. 状态元数据写入 `flow_metadata.json`，支持 `/api/status/{session_id}` 查询。

`FlowStateManager` 默认数据目录为 `data/分析结果`，已被 `.gitignore` 排除。

## API 端点

### 投委会流程

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/analyze/stream` | SSE 流式分析（推荐） |
| POST | `/api/analyze` | 非流式分析（向后兼容） |
| GET | `/api/status/{session_id}` | 查询流程状态 |
| GET | `/health` | 健康检查 |

### quantsmart 扩展

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/pdf/extract-url` | 从 URL 下载 PDF 提取文本 |
| POST | `/api/pdf/upload` | 上传 PDF 提取文本 |
| POST | `/api/pdf/extract-images-url` | 从 URL 下载 PDF 提取图片 |
| POST/GET/PUT/DELETE | `/api/knowledge/bookmarks*` | 书签/笔记 CRUD |
| POST | `/api/knowledge/search` | 搜索书签 |
| POST/GET/DELETE | `/api/chat/sessions*` | 对话 Session 管理 |
| POST | `/api/chat/send` / `/api/chat/send-stream` | 单轮/SSE 对话 |
| GET | `/api/agents` / `/api/agents/{id}` | 列出/查询大师 Agent |
| POST | `/api/agents/discuss` / `/api/agents/discuss-stream` | 多 Agent 圆桌讨论 |

## 安全与运行注意事项

- **API 密钥**：`OPENAI_API_KEY` 通过 `.env` 注入，`.env` 已加入 `.gitignore`，请勿硬编码。
- **CORS**：`main.py` 中 `allow_origins=["*"]`，生产环境应收紧为具体域名。
- **文件上传**：后端将上传文件内容按 UTF-8 解码（`errors="replace"`），不验证文件类型，依赖前端/LLM 处理。
- **PDF URL 下载**：`/api/pdf/extract-url` 会请求任意用户提供的 URL，存在 SSRF 风险，生产环境应加白名单或沙箱。
- **认证**：当前系统无用户认证/授权，所有端点公开访问。
- **数据持久化**：`quantsmart` 的书签和对话 Session 仅存内存，进程重启即丢失；投委会流程结果持久化到本地文件系统，未加密。
- **依赖安全**：`frontend` 的 `plugin-inspect-react-code` 是一个开发期 React 源码检查插件，注意其来源可信度。

## 已知问题

1. `backend/tests/test_committee_flow.py` 无法运行：导入已移除的 `RiskAssessorAgent`。
2. `frontend/src/App.tsx` 引用了三个不存在的前端页面，导致 TypeScript 类型检查和 Vite 构建失败。
3. `frontend/src/lib/api.ts` 中 `USE_MOCK = true`，默认前端使用本地 Mock 数据，不会连接后端。
4. `frontend` 当前 `node_modules` 缺少 `typescript`，需要先 `npm install` 才能构建。
