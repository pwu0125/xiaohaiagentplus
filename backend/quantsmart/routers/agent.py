"""Agent管理路由 + 多Agent圆桌讨论

提供Agent信息查询和多Agent讨论功能。
复用小海Agent现有的32位投资大师。

端点：
    GET  /api/agents           - 列出所有Agent
    GET  /api/agents/{id}      - 获取单个Agent
    POST /api/agents/discuss   - 多Agent圆桌讨论（非流式）
    POST /api/agents/discuss-stream - 多Agent圆桌讨论（SSE流式）
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.quantsmart.services.agent_service import AgentService
from backend.quantsmart.services.chat_service import ChatService, ChatServiceError
from backend.quantsmart.models import AgentDiscussRequest, AgentListResponse
from backend.config import Config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/agents", tags=["Agents"])

# 配置实例
_config = Config.from_env()

# 共享服务实例
agent_service = AgentService()
chat_service = ChatService(config=_config)


# ------------------------------------------------------------------
# Agent 查询
# ------------------------------------------------------------------

@router.get("", response_model=AgentListResponse)
async def list_agents() -> dict[str, Any]:
    """列出所有可用的Agent

    返回系统中注册的32位投资大师列表。

    Returns:
        包含 agents(列表) 和 total(总数) 的响应
    """
    agents = agent_service.list_agents()
    return {
        "agents": agents,
        "total": len(agents),
    }


@router.get("/{agent_id}")
async def get_agent(agent_id: str) -> dict[str, Any]:
    """获取单个Agent信息

    Args:
        agent_id: Agent ID（如 buffett, munger 等）

    Returns:
        Agent信息，包含 id, name, subtitle

    Raises:
        HTTPException: Agent不存在
    """
    result = agent_service.get_agent(agent_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Agent不存在: {agent_id}")
    return result


# ------------------------------------------------------------------
# 多Agent讨论
# ------------------------------------------------------------------

@router.post("/discuss")
async def discuss(request: AgentDiscussRequest) -> dict[str, Any]:
    """多Agent圆桌讨论（非流式）

    选择多个投资大师Agent，并行调用LLM获取各自观点。

    Args:
        request: 包含topic, agent_ids(Agent ID列表), context(可选上下文)

    Returns:
        包含 topic, results(各Agent观点列表) 的响应

    Raises:
        HTTPException: Agent ID无效或LLM调用失败
    """
    # 验证Agent IDs
    valid_ids, invalid_ids = agent_service.validate_agent_ids(request.agent_ids)
    if not valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"未提供有效的Agent ID，无效的ID: {invalid_ids}",
        )
    if invalid_ids:
        logger.warning(
            "[Agents] 讨论请求包含无效Agent ID: %s",
            invalid_ids,
        )

    # 获取Agent配置
    agent_configs = agent_service.get_agents_by_ids(valid_ids)
    logger.info(
        "[Agents] 开始圆桌讨论 | topic=%s | agents=%s",
        request.topic[:50],
        [a["id"] for a in agent_configs],
    )

    try:
        results = await chat_service.discuss_with_agents(
            topic=request.topic,
            agent_configs=agent_configs,
            context=request.context,
        )
        logger.info(
            "[Agents] 圆桌讨论完成 | topic=%s | results=%d",
            request.topic[:50],
            len(results),
        )
        return {
            "topic": request.topic,
            "results": results,
            "total": len(results),
        }
    except ChatServiceError as exc:
        logger.error("[Agents] 圆桌讨论失败: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[Agents] 圆桌讨论异常: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"圆桌讨论异常: {exc}",
        ) from exc


@router.post("/discuss-stream")
async def discuss_stream(request: AgentDiscussRequest) -> StreamingResponse:
    """多Agent圆桌讨论（SSE流式）

    选择多个投资大师Agent，SSE流式返回各Agent的观点。
    每位Agent一个事件，客户端可实时显示。

    事件序列:
        1. discussion_start  -> 讨论开始，包含topic和agent列表
        2. agent_thinking    -> 某Agent开始思考
        3. agent_message     -> 某Agent的观点
        4. agent_error       -> 某Agent出错（如有）
        5. discussion_complete -> 讨论完成

    Args:
        request: 包含topic, agent_ids(Agent ID列表), context(可选上下文)

    Returns:
        StreamingResponse: SSE流
    """
    # 验证Agent IDs
    valid_ids, invalid_ids = agent_service.validate_agent_ids(request.agent_ids)
    if not valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"未提供有效的Agent ID，无效的ID: {invalid_ids}",
        )

    agent_configs = agent_service.get_agents_by_ids(valid_ids)
    logger.info(
        "[Agents] 流式圆桌讨论 | topic=%s | agents=%s",
        request.topic[:50],
        [a["id"] for a in agent_configs],
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        """SSE事件生成器"""
        try:
            async for event in chat_service.discuss_with_agents_stream(
                topic=request.topic,
                agent_configs=agent_configs,
                context=request.context,
            ):
                yield (
                    f"event: {event['type']}\n"
                    f"data: {json.dumps(event['data'], ensure_ascii=False)}\n\n"
                )
        except Exception as exc:
            logger.error("[Agents] 流式讨论异常: %s", exc)
            error_payload = json.dumps(
                {"error": str(exc)},
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
