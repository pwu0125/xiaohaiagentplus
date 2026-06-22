# 小海Agent Plus v7.0.0

投委会多Agent分析系统 — 材料分析 + 模拟投决会 + 多Agent对话 + 知识库。

## 架构

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  材料分析     │  │ 模拟投决会   │  │ 多Agent对话  │  │   知识库     │
│   /pdf        │  │    /          │  │   /chat      │  │  /knowledge  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │                 │
       ▼                 ▼                 │                 ▼
┌──────────────┐  ┌──────────────┐        │    ┌──────────────┐
│  后端分析     │  │  后端投决会  │        │    │  知识库服务  │
│  Material     │  │  Committee  │        │    │  Knowledge   │
│  Analyzer     │  │  Flow       │        │    │  Base        │
└──────────────┘  └──────────────┘        │    └──────────────┘
                                           │
                    ┌──────────────────────┘
                    ▼
          ┌──────────────────┐
          │   LLM API        │
          │   (OpenAI)       │
          └──────────────────┘
```

## 功能特性

### 材料分析
- 上传 PDF / Excel / CSV / TXT，AI 生成完整投资分析报告
- 12章节报告：结论/指标/三情景/风险/宏观/行业/城市/财务
- 流式SSE进度展示，Recharts 图表渲染

### 模拟投决会
- 秘书Agent → 9部门并行 → 24位大师 → 决策者
- 流式实时展示各阶段进度
- 完整投决会报告（结论/评级/评分/风险/建议）

### 多Agent对话
- 选择投资大师，输入讨论主题
- 大师逐条流式回复，每条800-1400ms延迟
- 12位大师各3条特色回复

### 知识库
- 分析结果自动归档（ai-product / committee）
- 标签筛选 + 关键词搜索
- 9条预设项目笔记

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 添加你的 OPENAI_API_KEY（可选，Mock模式可用）
uvicorn main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:3000
```

### 生产构建

```bash
cd frontend
npm install
npm run build
# 构建产物在 frontend/dist/
```

## 技术栈

- **后端**: Python, FastAPI, SSE, httpx, PyMuPDF, pandas
- **前端**: React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Recharts
- **AI**: OpenAI-compatible API (gpt-4o)

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/analyze/material | 材料分析（非流式） |
| POST | /api/analyze/material/stream | 材料分析（SSE流式） |
| POST | /api/analyze/stream | 投决会分析（SSE流式） |
| GET | /api/agents | 列出投资大师 |
| POST | /api/agents/discuss | 多Agent讨论 |
| GET | /api/knowledge/analysis | 列出分析材料 |
| GET | /api/health | 健康检查 |

## 文档

- [CHANGELOG](CHANGELOG.md) — 版本更新日志
- [API文档](docs/api-committee-flow.md)
- [系统设计](SPEC.md)
- [代理定义](AGENTS.md)

## License
MIT
