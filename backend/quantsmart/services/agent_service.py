"""Agent服务

提供Agent信息查询和管理功能。
复用小海Agent现有的32位投资大师。
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from backend.agents.master_skill_agent import MASTER_REGISTRY

logger = logging.getLogger(__name__)


class AgentService:
    """Agent服务

    封装对小海Agent现有32位投资大师的查询和管理。

    Example:
        >>> service = AgentService()
        >>> agents = service.list_agents()
        >>> buffett = service.get_agent("buffett")
    """

    # ------------------------------------------------------------------
    # Agent 查询
    # ------------------------------------------------------------------

    def list_agents(self) -> list[dict[str, str]]:
        """列出所有可用的Agent

        Returns:
            Agent信息列表，每项包含 id, name, subtitle
        """
        agents: list[dict[str, str]] = []
        for agent_id, agent_cls in MASTER_REGISTRY.items():
            agents.append({
                "id": agent_id,
                "name": getattr(agent_cls, "master_name", agent_id),
                "subtitle": getattr(agent_cls, "master_subtitle", ""),
            })
        # 按名称排序
        agents.sort(key=lambda x: x["name"])
        return agents

    def get_agent(self, agent_id: str) -> Optional[dict[str, str]]:
        """获取单个Agent信息

        Args:
            agent_id: Agent ID

        Returns:
            Agent信息，不存在返回None
        """
        agent_cls = MASTER_REGISTRY.get(agent_id)
        if agent_cls is None:
            return None
        return {
            "id": agent_id,
            "name": getattr(agent_cls, "master_name", agent_id),
            "subtitle": getattr(agent_cls, "master_subtitle", ""),
        }

    def get_agents_by_ids(self, agent_ids: list[str]) -> list[dict[str, str]]:
        """批量获取Agent信息

        Args:
            agent_ids: Agent ID列表

        Returns:
            存在的Agent信息列表
        """
        results: list[dict[str, str]] = []
        for agent_id in agent_ids:
            agent = self.get_agent(agent_id)
            if agent:
                results.append(agent)
            else:
                logger.warning(
                    "[AgentService] Agent不存在，跳过: %s",
                    agent_id,
                )
        return results

    def validate_agent_ids(self, agent_ids: list[str]) -> tuple[list[str], list[str]]:
        """验证Agent ID列表

        Args:
            agent_ids: Agent ID列表

        Returns:
            (有效的ID列表, 无效的ID列表)
        """
        valid: list[str] = []
        invalid: list[str] = []
        for agent_id in agent_ids:
            if agent_id in MASTER_REGISTRY:
                valid.append(agent_id)
            else:
                invalid.append(agent_id)
        return valid, invalid

    def get_agent_count(self) -> int:
        """获取Agent总数

        Returns:
            可用Agent数量
        """
        return len(MASTER_REGISTRY)
