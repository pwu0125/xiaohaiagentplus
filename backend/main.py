"""
FastAPI 主应用 - 投委会分析系统 V2 + quantsmart 功能

提供分析端点：
    - POST /api/analyze/stream         : SSE 流式分析
    - POST /api/analyze                : 非流式分析（向后兼容）
    - GET  /api/status/{session_id}    : 查询流程状态
    - GET  /health                     : 健康检查
    - POST /api/analyze/material       : 材料分析（非流式）
    - POST /api/analyze/material/stream: 材料分析（SSE流式）

quantsmart 功能端点：
    - POST /api/pdf/extract-url        : PDF URL提取文本
    - POST /api/pdf/upload             : PDF上传提取文本
    - POST /api/pdf/extract-images-url : PDF URL提取图片
    - POST /api/knowledge/bookmarks    : 创建书签/笔记
    - GET  /api/knowledge/bookmarks    : 列出书签/笔记
    - POST /api/knowledge/search       : 搜索书签/笔记
    - POST /api/chat/sessions          : 创建对话Session
    - POST /api/chat/send              : 发送消息
    - POST /api/chat/send-stream       : SSE流式对话
    - GET  /api/agents                 : 列出所有Agent
    - POST /api/agents/discuss         : 多Agent圆桌讨论
    - POST /api/agents/discuss-stream  : SSE流式多Agent讨论
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.agents.flow_state_manager import FlowStateManager
from backend.agents.orchestrator_v2 import CommitteeFlowOrchestrator
from backend.config import Config

# quantsmart 路由
from backend.quantsmart.routers import pdf, knowledge, chat, agent

# 材料分析器
from backend.agents.material_analyzer import MaterialAnalyzer

# ---------------------------------------------------------------------------
# 日志配置
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI 应用实例
# ---------------------------------------------------------------------------
app = FastAPI(
    title="投委会分析系统",
    description="基于多Agent的投委会材料分析与决策支持系统",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS 中间件
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 全局配置与状态管理器（应用生命周期内单例）
# ---------------------------------------------------------------------------
config: Config = Config.from_env()
state_manager: FlowStateManager = FlowStateManager(base_path=config.DATA_DIR)

logger.info(
    "应用启动 | DATA_DIR=%s | MODEL=%s | API_BASE=%s",
    config.DATA_DIR,
    config.MODEL,
    config.API_BASE,
)

# ---------------------------------------------------------------------------
# 注册 quantsmart 路由
# ---------------------------------------------------------------------------
app.include_router(pdf.router)
app.include_router(knowledge.router)
app.include_router(chat.router)
app.include_router(agent.router)

logger.info("quantsmart 路由已注册 | PDF /api/pdf | Knowledge /api/knowledge | Chat /api/chat | Agents /api/agents")


# ============================================================================
# 端点定义
# ============================================================================

@app.post("/api/analyze/stream")
async def analyze_stream(
    files: list[UploadFile] = File(default=[]),
    project_type: str = Form(...),
    selected_departments: str = Form(default=""),
    selected_masters: str = Form(default=""),
) -> StreamingResponse:
    """
    流式分析端点，通过 SSE 推送进度和结果。

    支持多项目类型，以逗号分隔（如 "office_building,hotel"）。
    支持多选投资大师，以逗号分隔（如 "buffett,munger"）。

    事件序列:
        1. stage_start(secretary)               -> 秘书Agent开始
        2. stage_complete(secretary)            -> 秘书Agent完成
        3. stage_start(departments)             -> 部门Agent阶段开始
        4. department_started(investment)       -> 投资部开始
        5. department_started(asset_management) -> 资管部开始
        6. department_started(market)           -> 市场部开始
        7. department_started(operation)        -> 运营部开始
        8. department_started(financial)        -> 财务部开始
        9. department_started(design)           -> 设计部开始
        10. department_started(engineering)     -> 工程部开始
        11. department_started(cost)            -> 成本部开始
        12. department_started(legal)           -> 法律部开始
        13. stage_complete(departments)         -> 部门阶段完成
        14. master_started(buffett)             -> 巴菲特分析开始
        15. master_started(munger)              -> 芒格分析开始
        16. master_started(duan_yongping)       -> 段永平分析开始
        17. master_started(peter_lynch)         -> 彼得·林奇分析开始
        18. master_complete(...)                -> 各大师分析完成
        19. stage_complete(master_skill)
        20. stage_start(decision_maker)         -> 决策者Agent开始
        21. stage_complete(decision_maker)
        22. flow_complete                       -> 全部完成

    Args:
        files: 用户上传的材料文件列表（可选）。
        project_type: 项目类型，必填。支持多选，逗号分隔（如 "office_building,hotel"）。
        selected_departments: 选中的部门列表，逗号分隔（如 "investment,market,financial"）。
        selected_masters: 选中的投资大师列表，逗号分隔（如 "buffett,munger,peter_lynch"）。

    Returns:
        StreamingResponse: SSE 流，media_type 为 ``text/event-stream``。
    """
    session_id: str = str(uuid.uuid4())
    api_key: str = config.API_KEY

    # 解析逗号分隔的部门列表
    dept_list: list[str] | None = None
    if selected_departments:
        dept_list = [d.strip() for d in selected_departments.split(",") if d.strip()]
        if not dept_list:
            dept_list = None

    # 解析逗号分隔的大师列表
    master_list: list[str] | None = None
    if selected_masters:
        master_list = [m.strip() for m in selected_masters.split(",") if m.strip()]
        if not master_list:
            master_list = None

    logger.info(
        "[session=%s] 收到流式分析请求 | project_type=%s | files=%d "
        "| selected_departments=%s | selected_masters=%s",
        session_id,
        project_type,
        len(files),
        dept_list,
        master_list,
    )

    # 读取并准备材料
    materials: list[dict] = []
    for file in files:
        try:
            content: bytes = await file.read()
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": content.decode("utf-8", errors="replace"),
                "size": len(content),
            })
        except Exception as exc:
            logger.warning(
                "[session=%s] 读取文件 %s 失败: %s",
                session_id,
                file.filename,
                exc,
            )
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": f"[读取失败: {exc}]",
                "size": 0,
                "read_error": str(exc),
            })

    async def event_generator() -> AsyncGenerator[str, None]:
        """SSE 事件字符串生成器。"""
        orchestrator = CommitteeFlowOrchestrator(
            api_key=api_key,
            api_base=config.API_BASE,
            state_manager=state_manager,
        )
        try:
            async for event in orchestrator.run_full_flow(
                materials=materials,
                project_type=project_type,
                api_key=api_key,
                session_id=session_id,
                selected_departments=dept_list,
                selected_masters=master_list,
            ):
                # SSE 格式: event: <type>\ndata: <json>\n\n
                yield (
                    f"event: {event['type']}\n"
                    f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                )
        except Exception as exc:
            logger.exception("[session=%s] 流式处理异常: %s", session_id, exc)
            error_payload = json.dumps(
                {
                    "type": "error",
                    "error": str(exc),
                    "session_id": session_id,
                },
                ensure_ascii=False,
            )
            yield f"event: error\ndata: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )


@app.post("/api/analyze")
async def analyze(
    files: list[UploadFile] = File(default=[]),
    project_type: str = Form(...),
    selected_departments: str = Form(default=""),
    selected_masters: str = Form(default=""),
) -> dict:
    """
    向后兼容的非流式分析端点。

    内部调用编排器，收集所有事件后一次性返回最终结果。
    若流程中发生错误则抛出 HTTPException(500)。
    支持多项目类型，以逗号分隔（如 "office_building,hotel"）。
    支持多选投资大师，以逗号分隔（如 "buffett,munger"）。

    Args:
        files: 用户上传的材料文件列表（可选）。
        project_type: 项目类型，必填。支持多选，逗号分隔。
        selected_departments: 选中的部门列表，逗号分隔。
        selected_masters: 选中的投资大师列表，逗号分隔。

    Returns:
        dict: 包含 ``success``、``session_id``、``result`` 的响应。

    Raises:
        HTTPException: 分析过程中发生错误或未完成时抛出。
    """
    session_id: str = str(uuid.uuid4())
    api_key: str = config.API_KEY

    # 解析逗号分隔的部门列表
    dept_list: list[str] | None = None
    if selected_departments:
        dept_list = [d.strip() for d in selected_departments.split(",") if d.strip()]
        if not dept_list:
            dept_list = None

    # 解析逗号分隔的大师列表
    master_list: list[str] | None = None
    if selected_masters:
        master_list = [m.strip() for m in selected_masters.split(",") if m.strip()]
        if not master_list:
            master_list = None

    logger.info(
        "[session=%s] 收到非流式分析请求 | project_type=%s | files=%d "
        "| selected_departments=%s | selected_masters=%s",
        session_id,
        project_type,
        len(files),
        dept_list,
        master_list,
    )

    # 读取并准备材料
    materials: list[dict] = []
    for file in files:
        try:
            content: bytes = await file.read()
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": content.decode("utf-8", errors="replace"),
                "size": len(content),
            })
        except Exception as exc:
            logger.warning(
                "[session=%s] 读取文件 %s 失败: %s",
                session_id,
                file.filename,
                exc,
            )
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": f"[读取失败: {exc}]",
                "size": 0,
                "read_error": str(exc),
            })

    orchestrator = CommitteeFlowOrchestrator(
        api_key=api_key,
        api_base=config.API_BASE,
        state_manager=state_manager,
    )

    final_result: dict | None = None
    async for event in orchestrator.run_full_flow(
        materials=materials,
        project_type=project_type,
        api_key=api_key,
        session_id=session_id,
        selected_departments=dept_list,
        selected_masters=master_list,
    ):
        if event["type"] == "flow_complete":
            final_result = event["final_report"]
        elif event["type"] == "error":
            raise HTTPException(
                status_code=500,
                detail=event.get("error", "分析过程发生错误"),
            )

    if final_result is None:
        logger.error(
            "[session=%s] 分析未完成, 未收到 flow_complete 事件",
            session_id,
        )
        raise HTTPException(status_code=500, detail="分析未完成，未收到最终结果")

    logger.info("[session=%s] 非流式分析完成", session_id)
    return {
        "success": True,
        "session_id": session_id,
        "result": final_result,
    }


@app.get("/api/status/{session_id}")
async def get_status(session_id: str) -> dict:
    """
    获取指定 session 的流程状态。

    Args:
        session_id: 分析会话 ID。

    Returns:
        dict: 包含 ``session_id`` 和 ``status`` 的响应。

    Raises:
        HTTPException: Session 不存在或查询失败时抛出 404。
    """
    try:
        status = state_manager.get_flow_status(session_id)
        logger.debug("[session=%s] 状态查询成功", session_id)
        return {"session_id": session_id, "status": status}
    except FileNotFoundError:
        logger.warning("[session=%s] Session 不存在", session_id)
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {session_id}",
        )
    except Exception as exc:
        logger.error("[session=%s] 状态查询失败: %s", session_id, exc)
        raise HTTPException(
            status_code=404,
            detail=f"Session not found: {str(exc)}",
        )


# ---------------------------------------------------------------------------
# 材料分析端点
# ---------------------------------------------------------------------------

@app.post("/api/analyze/material")
async def analyze_material(
    files: List[UploadFile] = File(default=[]),
    project_type: str = Form(...),
) -> dict:
    """材料分析端点（非流式）

    接收multipart文件上传，逐个读取文件内容，
    调用MaterialAnalyzer生成投资分析报告并保存到知识库。

    Args:
        files: 用户上传的材料文件列表（PDF/Excel/CSV/TXT等）
        project_type: 项目类型，必填

    Returns:
        dict: 包含 success, session_id, result(报告), kb_id 的响应

    Raises:
        HTTPException: 分析过程中发生错误
    """
    session_id: str = str(uuid.uuid4())
    api_key: str = config.API_KEY

    logger.info(
        "[session=%s] 收到材料分析请求 | project_type=%s | files=%d",
        session_id,
        project_type,
        len(files),
    )

    # 读取并准备材料
    materials: list[dict[str, Any]] = []
    for file in files:
        try:
            content: bytes = await file.read()
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": content,
                "size": len(content),
            })
        except Exception as exc:
            logger.warning(
                "[session=%s] 读取文件 %s 失败: %s",
                session_id,
                file.filename,
                exc,
            )
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": b"",
                "size": 0,
                "read_error": str(exc),
            })

    try:
        analyzer = MaterialAnalyzer(
            api_key=api_key,
            api_base=config.API_BASE,
            model=config.MODEL,
        )
        result = await analyzer.analyze(materials, project_type)

        logger.info(
            "[session=%s] 材料分析完成 | kb_id=%s",
            session_id,
            result.get("kb_id", ""),
        )
        return {
            "success": True,
            "session_id": session_id,
            "result": result["report"],
            "kb_id": result.get("kb_id", ""),
        }
    except Exception as exc:
        logger.exception("[session=%s] 材料分析失败: %s", session_id, exc)
        raise HTTPException(
            status_code=500,
            detail=f"材料分析失败: {exc}",
        )


@app.post("/api/analyze/material/stream")
async def analyze_material_stream(
    files: List[UploadFile] = File(default=[]),
    project_type: str = Form(...),
) -> StreamingResponse:
    """材料分析端点（SSE流式）

    接收multipart文件上传，通过SSE推送各阶段进度和最终报告。

    SSE事件序列:
        1. stage_start(extraction)          -> 文件提取开始
        2. stage_progress(extraction, ...)  -> 文件提取进度
        3. stage_complete(extraction)       -> 文件提取完成
        4. stage_start(secretary)           -> 秘书Agent开始
        5. stage_complete(secretary)        -> 秘书Agent完成
        6. stage_start(report_builder)      -> 报告生成开始
        7. stage_progress(report_builder)   -> 报告生成进度
        8. stage_complete(report_builder)   -> 报告生成完成
        9. flow_complete                    -> 全部完成
        10. error                            -> 错误事件

    Args:
        files: 用户上传的材料文件列表
        project_type: 项目类型，必填

    Returns:
        StreamingResponse: SSE流，media_type为text/event-stream
    """
    session_id: str = str(uuid.uuid4())
    api_key: str = config.API_KEY

    logger.info(
        "[session=%s] 收到材料流式分析请求 | project_type=%s | files=%d",
        session_id,
        project_type,
        len(files),
    )

    # 读取并准备材料
    materials: list[dict[str, Any]] = []
    for file in files:
        try:
            content: bytes = await file.read()
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": content,
                "size": len(content),
            })
        except Exception as exc:
            logger.warning(
                "[session=%s] 读取文件 %s 失败: %s",
                session_id,
                file.filename,
                exc,
            )
            materials.append({
                "filename": file.filename,
                "content_type": file.content_type,
                "content": b"",
                "size": 0,
                "read_error": str(exc),
            })

    async def event_generator() -> AsyncGenerator[str, None]:
        """SSE事件字符串生成器。"""
        analyzer = MaterialAnalyzer(
            api_key=api_key,
            api_base=config.API_BASE,
            model=config.MODEL,
        )
        try:
            async for event in analyzer.analyze_stream(
                materials=materials,
                project_type=project_type,
                session_id=session_id,
            ):
                yield (
                    f"event: {event['type']}\n"
                    f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                )
        except Exception as exc:
            logger.exception("[session=%s] 材料流式分析异常: %s", session_id, exc)
            error_payload = json.dumps(
                {
                    "type": "error",
                    "error": str(exc),
                    "session_id": session_id,
                },
                ensure_ascii=False,
            )
            yield f"event: error\ndata: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        },
    )


@app.get("/health")
async def health_check() -> dict:
    """
    健康检查端点。

    Returns:
        dict: 包含 ``status`` 和 ``version`` 的健康状态。
    """
    return {"status": "healthy", "version": "2.1.0"}


# ============================================================================
# 入口
# ============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
