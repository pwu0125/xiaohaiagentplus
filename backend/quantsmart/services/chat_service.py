"""对话服务

提供对话Session管理和消息发送功能。
支持单轮对话和多Agent圆桌讨论。
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any, Optional

import httpx

from backend.quantsmart.memory import chat_session_store
from backend.config import Config

logger = logging.getLogger(__name__)


class ChatServiceError(Exception):
    """对话服务异常"""

    pass


class ChatService:
    """对话服务

    管理对话Session的创建、消息发送和多Agent讨论。

    Example:
        >>> service = ChatService(config)
        >>> session = service.create_session("投资讨论")
        >>> response = await service.send_message(session["id"], "分析这个项目")
    """

    def __init__(self, config: Config) -> None:
        self.config = config

    # ------------------------------------------------------------------
    # Session 管理
    # ------------------------------------------------------------------

    def create_session(
        self,
        title: Optional[str] = None,
        system_prompt: Optional[str] = None,
    ) -> dict[str, Any]:
        """创建对话Session

        Args:
            title: 会话标题
            system_prompt: 系统提示词

        Returns:
            创建的Session数据
        """
        import uuid
        from datetime import datetime

        session_id = str(uuid.uuid4())
        session = {
            "id": session_id,
            "title": title or f"会话 {session_id[:8]}",
            "system_prompt": system_prompt,
            "messages": [],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
        }
        chat_session_store._data[session_id] = session
        logger.info("[ChatService] 创建Session: %s | %s", session_id, session["title"])
        return session

    def get_session(self, session_id: str) -> Optional[dict[str, Any]]:
        """获取Session

        Args:
            session_id: Session ID

        Returns:
            Session数据，不存在返回None
        """
        return chat_session_store.get(session_id)

    def list_sessions(
        self,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """列出所有Session

        Args:
            page: 页码
            page_size: 每页条数

        Returns:
            包含items, total, page, page_size的字典
        """
        items, total = chat_session_store.list_all(
            page=page,
            page_size=page_size,
            sort_key="updated_at",
            reverse=True,
        )
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def delete_session(self, session_id: str) -> bool:
        """删除Session

        Args:
            session_id: Session ID

        Returns:
            是否成功删除
        """
        success = chat_session_store.delete(session_id)
        if success:
            logger.info("[ChatService] 删除Session: %s", session_id)
        return success

    # ------------------------------------------------------------------
    # 消息管理
    # ------------------------------------------------------------------

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        agent_id: Optional[str] = None,
        agent_name: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """向Session添加消息

        Args:
            session_id: Session ID
            role: 角色(user/assistant/system)
            content: 消息内容
            agent_id: Agent ID（可选）
            agent_name: Agent名称（可选）

        Returns:
            添加的消息，Session不存在返回None
        """
        session = chat_session_store.get(session_id)
        if session is None:
            logger.warning(
                "[ChatService] 添加消息失败，Session不存在: %s",
                session_id,
            )
            return None

        from datetime import datetime

        message = {
            "role": role,
            "content": content,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "timestamp": datetime.now().isoformat(),
        }
        session["messages"].append(message)
        session["updated_at"] = datetime.now().isoformat()
        chat_session_store._data[session_id] = session
        return message

    def get_messages(self, session_id: str) -> list[dict[str, Any]]:
        """获取Session的所有消息

        Args:
            session_id: Session ID

        Returns:
            消息列表，Session不存在返回空列表
        """
        session = chat_session_store.get(session_id)
        if session is None:
            return []
        return session.get("messages", [])

    def clear_messages(self, session_id: str) -> bool:
        """清空Session的消息

        Args:
            session_id: Session ID

        Returns:
            是否成功清空
        """
        session = chat_session_store.get(session_id)
        if session is None:
            return False
        session["messages"] = []
        from datetime import datetime

        session["updated_at"] = datetime.now().isoformat()
        chat_session_store._data[session_id] = session
        logger.info("[ChatService] 清空消息: %s", session_id)
        return True

    # ------------------------------------------------------------------
    # LLM 调用
    # ------------------------------------------------------------------

    async def call_llm(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """调用LLM获取回复

        直接使用小海Agent的API配置。

        Args:
            messages: 消息列表，每项包含role和content
            temperature: 温度参数
            max_tokens: 最大token数

        Returns:
            LLM回复文本

        Raises:
            ChatServiceError: LLM调用失败
        """
        api_key = self.config.API_KEY
        api_base = self.config.API_BASE.rstrip("/")
        model = self.config.MODEL

        if not api_key:
            raise ChatServiceError("API_KEY 未配置")

        max_retries = 3
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=300.0) as client:
                    response = await client.post(
                        f"{api_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model,
                            "messages": messages,
                            "temperature": temperature,
                            "max_tokens": max_tokens,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
            except (httpx.HTTPStatusError, httpx.HTTPError) as e:
                last_error = e
                logger.warning(
                    "[ChatService] LLM调用失败(第%d次): %s",
                    attempt,
                    e,
                )
                if attempt < max_retries:
                    await asyncio.sleep(2**attempt)
                else:
                    break
            except Exception as e:
                last_error = e
                logger.error("[ChatService] LLM调用异常: %s", e)
                break

        raise ChatServiceError(
            f"LLM调用失败（重试{max_retries}次）: {last_error}"
        ) from last_error

    # ------------------------------------------------------------------
    # 对话接口
    # ------------------------------------------------------------------

    async def send_message(
        self,
        session_id: str,
        message: str,
    ) -> dict[str, Any]:
        """发送消息并获取LLM回复

        Args:
            session_id: Session ID
            message: 用户消息

        Returns:
            包含session_id和assistant回复的字典

        Raises:
            ChatServiceError: Session不存在或LLM调用失败
        """
        session = chat_session_store.get(session_id)
        if session is None:
            raise ChatServiceError(f"Session不存在: {session_id}")

        # 添加用户消息
        self.add_message(session_id, "user", message)

        # 构建消息列表
        messages: list[dict[str, str]] = []
        if session.get("system_prompt"):
            messages.append({"role": "system", "content": session["system_prompt"]})
        for msg in session["messages"]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

        # 调用LLM
        assistant_content = await self.call_llm(messages)

        # 添加助手回复
        assistant_msg = self.add_message(
            session_id,
            "assistant",
            assistant_content,
        )

        return {
            "session_id": session_id,
            "message": assistant_msg,
        }

    # ------------------------------------------------------------------
    # SSE 流式对话
    # ------------------------------------------------------------------

    async def send_message_stream(
        self,
        session_id: str,
        message: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """发送消息并以SSE流式获取LLM回复

        Args:
            session_id: Session ID
            message: 用户消息

        Yields:
            流式事件字典，格式: {"type": "...", "data": {...}}
        """
        session = chat_session_store.get(session_id)
        if session is None:
            yield {
                "type": "error",
                "data": {"error": f"Session不存在: {session_id}"},
            }
            return

        # 添加用户消息
        self.add_message(session_id, "user", message)
        yield {
            "type": "user_message",
            "data": {"role": "user", "content": message},
        }

        # 构建消息列表
        messages: list[dict[str, str]] = []
        if session.get("system_prompt"):
            messages.append({"role": "system", "content": session["system_prompt"]})
        for msg in session["messages"]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"],
            })

        # 调用LLM获取完整回复
        try:
            yield {"type": "thinking", "data": {"status": "calling_llm"}}
            assistant_content = await self.call_llm(messages)

            # 添加助手回复
            assistant_msg = self.add_message(
                session_id,
                "assistant",
                assistant_content,
            )

            yield {
                "type": "assistant_message",
                "data": assistant_msg,
            }
            yield {"type": "done", "data": {}}

        except Exception as exc:
            logger.error("[ChatService] 流式对话异常: %s", exc)
            yield {
                "type": "error",
                "data": {"error": str(exc)},
            }

    # ------------------------------------------------------------------
    # 多Agent讨论
    # ------------------------------------------------------------------

    async def discuss_with_agents(
        self,
        topic: str,
        agent_configs: list[dict[str, str]],
        context: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """多Agent圆桌讨论（非流式）

        并行调用多个Agent的LLM，获取各自的观点。

        Args:
            topic: 讨论主题
            agent_configs: Agent配置列表，每项包含id, name, subtitle
            context: 额外上下文

        Returns:
            各Agent的讨论结果列表
        """
        if not agent_configs:
            return []

        system_prompt_base = (
            "你是一位投资大师，请以你的投资哲学和决策框架，"
            "对以下主题发表你的观点和分析。保持简洁，200字以内。"
        )
        if context:
            user_prompt = f"主题: {topic}\n\n背景信息:\n{context}"
        else:
            user_prompt = f"主题: {topic}"

        async def _call_agent(agent: dict[str, str]) -> dict[str, Any]:
            """调用单个Agent"""
            from datetime import datetime

            agent_id = agent["id"]
            agent_name = agent["name"]
            agent_subtitle = agent.get("subtitle", "")

            try:
                messages = [
                    {
                        "role": "system",
                        "content": (
                            f"你是{agent_name}（{agent_subtitle}）。"
                            f"{system_prompt_base}"
                        ),
                    },
                    {"role": "user", "content": user_prompt},
                ]
                content = await self.call_llm(
                    messages,
                    temperature=0.7,
                    max_tokens=500,
                )
                return {
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "agent_subtitle": agent_subtitle,
                    "content": content,
                    "timestamp": datetime.now().isoformat(),
                }
            except Exception as exc:
                logger.error(
                    "[ChatService] Agent %s 讨论失败: %s",
                    agent_name,
                    exc,
                )
                return {
                    "agent_id": agent_id,
                    "agent_name": agent_name,
                    "agent_subtitle": agent_subtitle,
                    "content": f"[{agent_name}分析失败: {exc}]",
                    "timestamp": datetime.now().isoformat(),
                    "error": str(exc),
                }

        # 并行调用所有Agent
        tasks = [_call_agent(agent) for agent in agent_configs]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理异常结果
        processed_results: list[dict[str, Any]] = []
        from datetime import datetime

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                agent = agent_configs[i]
                processed_results.append({
                    "agent_id": agent["id"],
                    "agent_name": agent["name"],
                    "agent_subtitle": agent.get("subtitle", ""),
                    "content": f"[{agent['name']}分析失败: {result}]",
                    "timestamp": datetime.now().isoformat(),
                    "error": str(result),
                })
            else:
                processed_results.append(result)

        return processed_results

    async def discuss_with_agents_stream(
        self,
        topic: str,
        agent_configs: list[dict[str, str]],
        context: Optional[str] = None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """多Agent圆桌讨论（SSE流式）

        依次流式返回各Agent的观点。

        Args:
            topic: 讨论主题
            agent_configs: Agent配置列表
            context: 额外上下文

        Yields:
            流式事件字典
        """
        if not agent_configs:
            yield {
                "type": "error",
                "data": {"error": "未选择任何Agent"},
            }
            return

        yield {
            "type": "discussion_start",
            "data": {
                "topic": topic,
                "agent_count": len(agent_configs),
                "agents": [
                    {"id": a["id"], "name": a["name"]} for a in agent_configs
                ],
            },
        }

        system_prompt_base = (
            "你是一位投资大师，请以你的投资哲学和决策框架，"
            "对以下主题发表你的观点和分析。保持简洁，200字以内。"
        )
        if context:
            user_prompt = f"主题: {topic}\n\n背景信息:\n{context}"
        else:
            user_prompt = f"主题: {topic}"

        for agent in agent_configs:
            agent_id = agent["id"]
            agent_name = agent["name"]
            agent_subtitle = agent.get("subtitle", "")

            try:
                yield {
                    "type": "agent_thinking",
                    "data": {"agent_id": agent_id, "agent_name": agent_name},
                }

                messages = [
                    {
                        "role": "system",
                        "content": (
                            f"你是{agent_name}（{agent_subtitle}）。"
                            f"{system_prompt_base}"
                        ),
                    },
                    {"role": "user", "content": user_prompt},
                ]
                content = await self.call_llm(
                    messages,
                    temperature=0.7,
                    max_tokens=500,
                )

                yield {
                    "type": "agent_message",
                    "data": {
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "agent_subtitle": agent_subtitle,
                        "content": content,
                    },
                }

            except Exception as exc:
                logger.error(
                    "[ChatService] Agent %s 流式讨论失败: %s",
                    agent_name,
                    exc,
                )
                yield {
                    "type": "agent_error",
                    "data": {
                        "agent_id": agent_id,
                        "agent_name": agent_name,
                        "error": str(exc),
                    },
                }

        yield {"type": "discussion_complete", "data": {}}
