"""
配置模块 - 投委会分析系统

集中管理所有环境变量和全局配置项。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class Config:
    """全局配置类

    管理所有Agent和流程所需的配置项，支持从环境变量读取
    和默认值回退。

    Attributes:
        API_KEY: OpenAI API密钥
        API_BASE: OpenAI API基础URL
        MODEL: 使用的LLM模型名称
        DATA_DIR: 分析结果数据存储目录
        MAX_CONCURRENT_DEPTS: 最大并发部门Agent数量
        TIMEOUT_PER_AGENT: 单个Agent超时时间(秒)
    """

    API_KEY: str = field(
        default_factory=lambda: os.getenv("OPENAI_API_KEY", "")
    )
    API_BASE: str = field(
        default_factory=lambda: os.getenv(
            "OPENAI_API_BASE", "https://api.openai.com/v1"
        )
    )
    MODEL: str = field(
        default_factory=lambda: os.getenv("MODEL", "gpt-4o")
    )
    DATA_DIR: str = field(
        default_factory=lambda: os.getenv("DATA_DIR", "data/分析结果")
    )
    MAX_CONCURRENT_DEPTS: int = field(
        default_factory=lambda: int(os.getenv("MAX_CONCURRENT_DEPTS", "3"))
    )
    TIMEOUT_PER_AGENT: int = field(
        default_factory=lambda: int(os.getenv("TIMEOUT_PER_AGENT", "300"))
    )

    @classmethod
    def from_env(cls) -> "Config":
        """从环境变量创建配置实例

        支持的变量：
            - OPENAI_API_KEY      : API 密钥（必需）
            - OPENAI_API_BASE     : API 基础 URL
            - MODEL               : 使用的模型名称
            - DATA_DIR            : 数据持久化目录
            - MAX_CONCURRENT_DEPTS: 最大并发部门数
            - TIMEOUT_PER_AGENT   : 单个 Agent 超时时间（秒）

        Returns:
            Config: 配置实例，环境变量未设置时使用默认值
        """
        return cls()
