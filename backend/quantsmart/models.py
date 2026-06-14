"""quantsmart Pydantic 模型定义

定义PDF扫描、知识库、多Agent对话等模块的请求/响应模型。
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ============================================================================
# PDF 模块模型
# ============================================================================

class PDFExtractResponse(BaseModel):
    """PDF提取响应"""

    text: str = Field(description="提取的文本内容")
    pages: int = Field(description="PDF页数")
    chars: int = Field(description="文本字符数")
    filename: Optional[str] = Field(default=None, description="文件名")


class PDFUrlRequest(BaseModel):
    """PDF URL提取请求"""

    url: str = Field(description="PDF文件的URL")


# ============================================================================
# 知识库模块模型
# ============================================================================

class BookmarkType(str, Enum):
    """书签类型"""

    BOOKMARK = "bookmark"
    NOTE = "note"


class BookmarkCreate(BaseModel):
    """创建书签/笔记请求"""

    title: str = Field(description="标题")
    url: Optional[str] = Field(default=None, description="关联URL")
    content: Optional[str] = Field(default=None, description="笔记内容")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    bookmark_type: BookmarkType = Field(default=BookmarkType.BOOKMARK, description="类型")


class BookmarkUpdate(BaseModel):
    """更新书签/笔记请求"""

    title: Optional[str] = Field(default=None, description="标题")
    url: Optional[str] = Field(default=None, description="关联URL")
    content: Optional[str] = Field(default=None, description="笔记内容")
    tags: Optional[list[str]] = Field(default=None, description="标签列表")
    bookmark_type: Optional[BookmarkType] = Field(default=None, description="类型")


class BookmarkOut(BaseModel):
    """书签/笔记响应"""

    id: str = Field(description="唯一ID")
    title: str = Field(description="标题")
    url: Optional[str] = Field(default=None, description="关联URL")
    content: Optional[str] = Field(default=None, description="笔记内容")
    tags: list[str] = Field(default_factory=list, description="标签列表")
    bookmark_type: BookmarkType = Field(description="类型")
    created_at: str = Field(description="创建时间ISO格式")
    updated_at: str = Field(description="更新时间ISO格式")


class BookmarkSearchRequest(BaseModel):
    """搜索书签请求"""

    keyword: str = Field(description="搜索关键词")
    tags: Optional[list[str]] = Field(default=None, description="按标签筛选")


class BookmarkListResponse(BaseModel):
    """书签列表响应"""

    items: list[BookmarkOut] = Field(description="书签列表")
    total: int = Field(description="总数")
    page: int = Field(default=1, description="当前页")
    page_size: int = Field(default=20, description="每页大小")


# ============================================================================
# 对话模块模型
# ============================================================================

class ChatMessage(BaseModel):
    """聊天消息"""

    role: str = Field(description="角色: user/assistant/system")
    content: str = Field(description="消息内容")
    agent_id: Optional[str] = Field(default=None, description="发送消息的Agent ID")
    agent_name: Optional[str] = Field(default=None, description="发送消息的Agent名称")
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat(), description="时间戳")


class ChatSessionCreate(BaseModel):
    """创建对话Session请求"""

    title: Optional[str] = Field(default=None, description="会话标题")
    system_prompt: Optional[str] = Field(
        default=None, description="系统提示词"
    )


class ChatSessionOut(BaseModel):
    """对话Session响应"""

    id: str = Field(description="Session ID")
    title: Optional[str] = Field(default=None, description="会话标题")
    messages: list[ChatMessage] = Field(default_factory=list, description="消息列表")
    created_at: str = Field(description="创建时间")
    updated_at: str = Field(description="更新时间")


class ChatRequest(BaseModel):
    """发送消息请求"""

    session_id: str = Field(description="Session ID")
    message: str = Field(description="用户消息")


class ChatResponse(BaseModel):
    """聊天响应"""

    session_id: str = Field(description="Session ID")
    message: ChatMessage = Field(description="助手回复消息")


# ============================================================================
# 多Agent讨论模型
# ============================================================================

class AgentDiscussRequest(BaseModel):
    """多Agent圆桌讨论请求"""

    topic: str = Field(description="讨论主题/问题")
    agent_ids: list[str] = Field(description="参与讨论的Agent ID列表")
    context: Optional[str] = Field(default=None, description="额外上下文")


class AgentDiscussResponse(BaseModel):
    """Agent讨论响应"""

    agent_id: str = Field(description="Agent ID")
    agent_name: str = Field(description="Agent名称")
    agent_subtitle: str = Field(description="Agent副标题")
    content: str = Field(description="讨论内容")
    timestamp: str = Field(description="时间戳")


class SSEEvent(BaseModel):
    """SSE事件"""

    type: str = Field(description="事件类型")
    data: dict[str, Any] = Field(description="事件数据")


# ============================================================================
# Agent 管理模型
# ============================================================================

class AgentInfo(BaseModel):
    """Agent信息"""

    id: str = Field(description="Agent ID")
    name: str = Field(description="Agent名称")
    subtitle: str = Field(description="Agent副标题/描述")


class AgentListResponse(BaseModel):
    """Agent列表响应"""

    agents: list[AgentInfo] = Field(description="Agent列表")
    total: int = Field(description="总数")
