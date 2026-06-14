# 投委会多Agent分析系统 v2.0

基于多Agent串行流程的投资决策分析系统，模拟真实投委会工作流。

## 架构

```
秘书Agent → 并行部门Agent（市场/财务/风险） → 大师Agent → 决策者Agent
```

## 快速开始

### 后端

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 添加你的 OPENAI_API_KEY
uvicorn main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 技术栈

- **后端**: Python, FastAPI, SSE, httpx
- **前端**: React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion
- **AI**: OpenAI-compatible API

## API 端点

| 端点 | 说明 |
|------|------|
| POST /api/analyze/stream | SSE流式分析 |
| POST /api/analyze | 非流式分析（向后兼容） |
| GET /api/status/{session_id} | 查询状态 |

## 文档

- [API文档](docs/api-committee-flow.md)
- [系统设计](SPEC.md)

## License
MIT
