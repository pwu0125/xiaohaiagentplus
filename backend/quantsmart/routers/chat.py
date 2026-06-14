"""多Agent对话路由

提供对话Session管理和消息发送功能。
支持普通对话和SSE流式对话。

端点：
    POST   /api/chat/sessions       - 创建Session
    GET    /api/chat/sessions       - 列出Session
    GET    /api/chat/sessions/{id}  - 获取Session
    DELETE /api/chat/sessions/{id}  - 删除Session
    GET    /api/chat/sessions/{id}/messages - 获取消息列表
    DELETE /api/chat/sessions/{id}/messages - 清空消息
    POST   /api/chat/send           - 发送消息（非流式）
    POST   /api/chat/send-stream    - 发送消息（SSE流式）
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.quantsmart.services.chat_service import ChatService, ChatServiceError
from backend.quantsmart.models import (
    ChatRequest,
    ChatResponse,
    ChatSessionCreate,
    ChatSessionOut,
)
from backend.config import Config

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chat"])

# 配置实例 - 从环境变量加载
_config = Config.from_env()

# 共享对话服务实例
chat_service = ChatService(config=_config)


# ------------------------------------------------------------------
# Session 管理
# ------------------------------------------------------------------

@router.post("/sessions", response_model=ChatSessionOut, status_code=201)
async def create_session(data: ChatSessionCreate) -> dict[str, Any]:
    """创建对话Session

    Args:
        data: Session创建数据

    Returns:
        创建的Session数据
    """
    result = chat_service.create_session(
        title=data.title,
        system_prompt=data.system_prompt,
    )
    logger.info("[Chat] 创建Session: %s | %s", result["id"], result.get("title"))
    return result


@router.get("/sessions")
async def list_sessions(
    page: int = 1,
    page_size: int = 20,
) -> dict[str, Any]:
    """列出所有Session

    按更新时间倒序排列。

    Args:
        page: 页码
        page_size: 每页条数

    Returns:
        包含items, total, page, page_size的响应
    """
    return chat_service.list_sessions(page=page, page_size=page_size)


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
async def get_session(session_id: str) -> dict[str, Any]:
    """获取Session

    Args:
        session_id: Session ID

    Returns:
        Session数据

    Raises:
        HTTPException: Session不存在
    """
    result = chat_service.get_session(session_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Session不存在: {session_id}")
    return result


@router.delete("/sessions/{session_id}", status_code=204, response_model=None)
async def delete_session(session_id: str) -> None:
    """删除Session

    Args:
        session_id: Session ID

    Raises:
        HTTPException: Session不存在
    """
    success = chat_service.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session不存在: {session_id}")
    logger.info("[Chat] 删除Session: %s", session_id)


# ------------------------------------------------------------------
# 消息管理
# ------------------------------------------------------------------

@router.get("/sessions/{session_id}/messages")
async def get_messages(session_id: str) -> dict[str, Any]:
    """获取Session的消息列表

    Args:
        session_id: Session ID

    Returns:
        包含 messages(消息列表) 的响应

    Raises:
        HTTPException: Session不存在
    """
    session = chat_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session不存在: {session_id}")
    return {"messages": session.get("messages", [])}


@router.delete("/sessions/{session_id}/messages", status_code=204, response_model=None)
async def clear_messages(session_id: str) -> None:
    """清空Session的消息

    Args:
        session_id: Session ID

    Raises:
        HTTPException: Session不存在
    """
    session = chat_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session不存在: {session_id}")
    chat_service.clear_messages(session_id)
    logger.info("[Chat] 清空消息: %s", session_id)


# ------------------------------------------------------------------
# 对话接口
# ------------------------------------------------------------------

@router.post("/send", response_model=ChatResponse)
async def send_message(request: ChatRequest) -> dict[str, Any]:
    """发送消息并获取回复（非流式）

    向指定Session发送用户消息，等待LLM回复后一并返回。

    Args:
        request: 包含session_id和message的请求

    Returns:
        包含session_id和assistant回复消息的字典

    Raises:
        HTTPException: Session不存在或LLM调用失败
    """
    try:
        result = await chat_service.send_message(
            session_id=request.session_id,
            message=request.message,
        )
        return result
    except ChatServiceError as exc:
        logger.error("[Chat] 发送消息失败: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[Chat] 发送消息异常: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"对话异常: {exc}",
        ) from exc


@router.post("/send-stream")
async def send_message_stream(request: ChatRequest) -> StreamingResponse:
    """发送消息并以SSE流式获取回复

    向指定Session发送用户消息，通过SSE流式返回处理进度和结果。

    事件序列:
        1. user_message      -> 用户消息确认
        2. thinking          -> 开始调用LLM
        3. assistant_message -> 助手回复
        4. done              -> 完成
        5. error             -> 错误（如有）

    Args:
        request: 包含session_id和message的请求

    Returns:
        StreamingResponse: SSE流
    """
    logger.info(
        "[Chat] 流式消息 | session=%s | message=%s",
        request.session_id,
        request.message[:50],
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        """SSE事件生成器"""
        try:
            async for event in chat_service.send_message_stream(
                session_id=request.session_id,
                message=request.message,
            ):
                yield (
                    f"event: {event['type']}\n"
                    f"data: {json.dumps(event['data'], ensure_ascii=False)}\n\n"
                )
        except Exception as exc:
            logger.error("[Chat] 流式对话异常: %s", exc)
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
