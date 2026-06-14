# SPEC.md - 多Agent串行投委会流程系统

## 项目概述
全栈系统：后端FastAPI + 前端React，实现多Agent串行投委会分析流程。

## 架构图
```
用户上传材料 
  ↓
秘书Agent（提取结构化信息）
  ↓
并行部门Agent（市场/财务/风险）
  ↓
大师Skill Agent
  ↓
决策者Agent
  ↓
返回完整分析报告（SSE流式推送）
```

## 后端模块 (backend/)

### 模块1: flow_state_manager.py
- **职责**: 文件系统状态持久化
- **接口**:
```python
class FlowStateManager:
    def __init__(self, base_path: str = "data/分析结果"): ...
    def save_stage_result(self, session_id: str, stage: str, result: dict) -> None: ...
    def load_stage_result(self, session_id: str, stage: str) -> dict | None: ...
    def mark_stage_complete(self, session_id: str, stage: str) -> None: ...
    def get_flow_status(self, session_id: str) -> dict: ...
    def ensure_directories(self, session_id: str, project_slug: str) -> Path: ...
```
- **状态目录结构**:
```
data/分析结果/{project_slug}/
├── stages/
│   ├── 01_secretary.json
│   ├── 02_departments/
│   │   ├── market.json
│   │   ├── financial.json
│   │   └── risk.json
│   ├── 03_master_skill.json
│   └── 04_decision_maker.json
├── analysis.json
└── flow_metadata.json
```

### 模块2: secretary_agent.py
- **职责**: 提取并结构化用户上传的材料
- **接口**:
```python
class SecretaryAgent:
    def __init__(self, api_key: str, api_base: str = None): ...
    async def process_materials(self, materials: list[dict]) -> dict:
        """返回结构化项目资料"""
        
    async def extract_from_file(self, file_info: dict) -> dict: ...
    def generate_structured_content(self, extracted: dict) -> str: ...
```
- **输出格式**:
```json
{
    "project_name": "项目名称",
    "extracted_fields": {
        "basic_info": {},
        "financial_data": {},
        "operational_data": {},
        "market_context": {}
    },
    "missing_fields": [],
    "material_summary": "",
    "structured_content": ""
}
```

### 模块3: department_agents.py (市场/财务/风险)
- **职责**: 三个独立的部门分析Agent
- **接口**:
```python
class MarketAnalystAgent:
    def __init__(self, api_key: str, api_base: str = None): ...
    async def analyze(self, structured_materials: str) -> dict: ...

class FinancialModelerAgent:
    def __init__(self, api_key: str, api_base: str = None): ...
    async def analyze(self, structured_materials: str) -> dict: ...

class RiskAssessorAgent:
    def __init__(self, api_key: str, api_base: str = None): ...
    async def analyze(self, structured_materials: str) -> dict: ...
```
- **输出格式**:
```json
// market.json
{
    "department": "market",
    "market_overview": "",
    "competitive_landscape": "",
    "demand_analysis": "",
    "pricing_trends": "",
    "key_risks_opportunities": [],
    "score": 75
}

// financial.json
{
    "department": "financial",
    "revenue_projections": {},
    "cost_structure": {},
    "profitability_analysis": {},
    "cash_flow_assessment": {},
    "key_metrics": {},
    "score": 80
}

// risk.json
{
    "department": "risk",
    "risk_categories": [],
    "risk_matrix": [],
    "mitigation_strategies": [],
    "compliance_assessment": "",
    "overall_risk_level": "medium",
    "score": 65
}
```

### 模块4: master_skill_agent.py
- **职责**: 跨部门综合洞察
- **接口**:
```python
class MasterSkillAgent:
    def __init__(self, api_key: str, api_base: str = None): ...
    async def synthesize(
        self,
        structured_materials: str,
        department_results: dict[str, dict]
    ) -> dict: ...
```
- **输出格式**:
```json
{
    "skill_name": "投资大师视角",
    "key_insights": [],
    "critical_questions": [],
    "cross_department_analysis": "",
    "additional_analysis": "",
    "strategic_recommendations": []
}
```

### 模块5: decision_maker_agent.py
- **职责**: 汇总所有分析，形成最终投资决策
- **接口**:
```python
class DecisionMakerAgent:
    def __init__(self, api_key: str, api_base: str = None): ...
    async def decide(
        self,
        structured_materials: str,
        department_results: dict[str, dict],
        master_skill_output: dict
    ) -> dict: ...
```
- **输出格式**:
```json
{
    "typed_conclusion": "投/改/退",
    "rating": "A/B+/B/C",
    "score": 72,
    "summary": "",
    "key_metrics": {},
    "risks": [],
    "recommendations": [],
    "project_type_config": {},
    "report_header": "",
    "department_scores": {},
    "final_assessment": ""
}
```

### 模块6: orchestrator_v2.py
- **职责**: 编排整个投委会流程
- **接口**:
```python
class CommitteeFlowOrchestrator:
    def __init__(self, api_key: str, state_manager: FlowStateManager = None): ...
    
    async def run_full_flow(
        self,
        materials: list[dict],
        project_type: str,
        api_key: str,
        session_id: str,
    ) -> AsyncGenerator[dict, None]: ...
    
    async def _run_secretary(self, materials: list[dict]) -> dict: ...
    async def _run_departments(self, structured_content: str) -> dict[str, dict]: ...
    async def _run_master_skill(
        self, structured_content: str, dept_results: dict
    ) -> dict: ...
    async def _run_decision_maker(
        self, structured_content: str, dept_results: dict, master_output: dict
    ) -> dict: ...
```
- **SSE事件类型**:
  - `stage_start`: 阶段开始
  - `stage_progress`: 阶段内进度
  - `stage_complete`: 阶段完成
  - `department_started`: 部门Agent开始
  - `department_complete`: 部门Agent完成
  - `flow_complete`: 整个流程完成
  - `error`: 错误事件

### 模块7: main.py (FastAPI应用)
- **端点**:
```python
@app.post("/api/analyze/stream")
async def analyze_stream(
    files: list[UploadFile] = File(default=[]),
    project_type: str = Form(...),
): ...

@app.post("/api/analyze")  # 向后兼容
async def analyze(...): ...

@app.get("/api/status/{session_id}")
async def get_status(session_id: str): ...
```

## 前端模块 (frontend/)

### API客户端 (src/lib/api.ts)
```typescript
export interface StreamEvent {
  type: 'stage_start' | 'stage_complete' | 'department_started' | 
        'department_complete' | 'stage_progress' | 'flow_complete' | 'error';
  stage?: string;
  department?: string;
  result?: any;
  progress?: number;
  error?: string;
  message?: string;
}

export async function analyzeProjectStream(
  files: File[],
  projectType: string,
  onProgress: (event: StreamEvent) => void
): Promise<void>;
```

### 状态管理
```typescript
interface FlowStatus {
  currentStage: string;
  completedStages: string[];
  departmentStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
  intermediateResults: Record<string, any>;
  finalReport: any | null;
  error: string | null;
  isConnected: boolean;
}
```

### 组件
- `CommitteeFlowProgress.tsx`: 整体流程进度
- `StageIndicator.tsx`: 阶段指示器
- `DepartmentGrid.tsx`: 部门Agent状态卡片
- `CollapsibleSection.tsx`: 可折叠的中间结果
- `TerminalLog.tsx`: 实时日志输出
- `FinalReport.tsx`: 最终报告展示

## 数据流
1. 用户上传文件 → `/api/analyze/stream`
2. 生成session_id和project_slug
3. 秘书Agent处理材料 → 保存到 `stages/01_secretary.json`
4. 并行启动3个部门Agent → 保存到 `stages/02_departments/`
5. 大师Agent综合分析 → 保存到 `stages/03_master_skill.json`
6. 决策者Agent形成结论 → 保存到 `stages/04_decision_maker.json`
7. 合并所有结果为 `analysis.json`
8. 通过SSE推送每个步骤的事件

## 错误处理
- 单个部门Agent失败：记录错误，继续其他部门
- 秘书Agent失败：整个流程终止
- 决策者Agent失败：返回已完成的分析结果
- SSE断开：客户端可重连，服务端支持从状态文件恢复

## 配置
```python
# backend/config.py
class Config:
    API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    API_BASE: str = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
    MODEL: str = os.getenv("MODEL", "gpt-4o")
    DATA_DIR: str = os.getenv("DATA_DIR", "data/分析结果")
    MAX_CONCURRENT_DEPTS: int = 3
    TIMEOUT_PER_AGENT: int = 300  # seconds
```

## 依赖
### 后端
```
fastapi>=0.104.0
uvicorn>=0.24.0
python-multipart>=0.0.6
httpx>=0.25.0
aiofiles>=23.2.0
pydantic>=2.5.0
python-dotenv>=1.0.0
```

### 前端
```
react 19 + typescript
tailwindcss v3.4.19
vite v7.2.4
lucide-react
```
