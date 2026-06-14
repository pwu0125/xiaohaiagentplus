# 投委会分析流程 API 文档

## 端点概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/analyze/stream | SSE流式分析（推荐） |
| POST | /api/analyze | 非流式分析（向后兼容） |
| GET | /api/status/{session_id} | 查询分析状态 |
| GET | /health | 健康检查 |

## POST /api/analyze/stream

流式分析端点，通过SSE（Server-Sent Events）实时推送分析进度。

### 请求

Content-Type: multipart/form-data

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| files | File[] | 是 | 上传的分析材料（PDF/Excel/TXT等） |
| project_type | string | 是 | 项目类型 |

### SSE 事件类型

#### stage_start
阶段开始事件。
```json
{
  "type": "stage_start",
  "stage": "secretary",
  "session_id": "uuid"
}
```

#### stage_complete
阶段完成事件。
```json
{
  "type": "stage_complete",
  "stage": "secretary",
  "result": { ... },
  "session_id": "uuid"
}
```

#### department_started / department_complete
部门Agent事件。
```json
{
  "type": "department_complete",
  "department": "market",
  "result": { "score": 75, ... },
  "session_id": "uuid"
}
```

#### flow_complete
流程完成事件。
```json
{
  "type": "flow_complete",
  "final_report": {
    "typed_conclusion": "投",
    "rating": "B+",
    "score": 75,
    "summary": "..."
  },
  "session_id": "uuid"
}
```

#### error
错误事件。
```json
{
  "type": "error",
  "stage": "departments",
  "error": "错误信息",
  "session_id": "uuid"
}
```

## 前端接入示例

```typescript
const eventSource = new EventSource('/api/analyze/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data);

  if (data.type === 'flow_complete') {
    console.log('Final report:', data.final_report);
    eventSource.close();
  }
};

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

## 错误处理

- 秘书Agent失败 → 流程终止，返回error事件
- 单个部门Agent失败 → 继续其他部门，该部门result中记录error
- 决策者Agent失败 → 返回已完成的分析结果

## 配置环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| OPENAI_API_KEY | "" | LLM API密钥 |
| OPENAI_API_BASE | https://api.openai.com/v1 | API基础URL |
| MODEL | gpt-4o | 使用模型 |
| DATA_DIR | data/分析结果 | 数据存储目录 |
