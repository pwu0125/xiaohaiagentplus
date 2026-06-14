"""知识库路由

提供书签/笔记的CRUD、搜索和标签管理功能。

端点：
    POST   /api/knowledge/bookmarks      - 创建书签/笔记
    GET    /api/knowledge/bookmarks      - 列出书签/笔记（支持筛选和分页）
    GET    /api/knowledge/bookmarks/{id} - 获取单个书签/笔记
    PUT    /api/knowledge/bookmarks/{id} - 更新书签/笔记
    DELETE /api/knowledge/bookmarks/{id} - 删除书签/笔记
    POST   /api/knowledge/search         - 搜索书签/笔记
    GET    /api/knowledge/tags           - 获取所有标签
    GET    /api/knowledge/tags/{tag}     - 按标签获取书签
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from backend.quantsmart.services.kb_service import KnowledgeBaseService
from backend.quantsmart.models import (
    BookmarkCreate,
    BookmarkListResponse,
    BookmarkOut,
    BookmarkSearchRequest,
    BookmarkType,
    BookmarkUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge", tags=["Knowledge"])

# 共享知识库服务实例
kb_service = KnowledgeBaseService()


# ------------------------------------------------------------------
# CRUD
# ------------------------------------------------------------------

@router.post("/bookmarks", response_model=BookmarkOut, status_code=201)
async def create_bookmark(data: BookmarkCreate) -> dict[str, Any]:
    """创建书签/笔记

    Args:
        data: 书签创建数据

    Returns:
        创建的书签（含ID和时间戳）
    """
    result = kb_service.create_bookmark(
        title=data.title,
        url=data.url,
        content=data.content,
        tags=data.tags,
        bookmark_type=data.bookmark_type.value,
    )
    logger.info("[Knowledge] 创建书签: %s | %s", result["id"], result["title"])
    return result


@router.get("/bookmarks", response_model=BookmarkListResponse)
async def list_bookmarks(
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页条数"),
    bookmark_type: Optional[str] = Query(default=None, description="类型筛选: bookmark/note"),
    tags: Optional[str] = Query(default=None, description="标签筛选，逗号分隔"),
) -> dict[str, Any]:
    """列出书签/笔记

    支持分页、类型筛选和标签筛选。

    Args:
        page: 页码
        page_size: 每页条数
        bookmark_type: 按类型筛选
        tags: 按标签筛选，逗号分隔

    Returns:
        包含 items(列表), total(总数), page, page_size 的响应
    """
    tag_list: Optional[list[str]] = None
    if tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    result = kb_service.list_bookmarks(
        page=page,
        page_size=page_size,
        bookmark_type=bookmark_type,
        tags=tag_list,
    )
    return result


@router.get("/bookmarks/{bookmark_id}", response_model=BookmarkOut)
async def get_bookmark(bookmark_id: str) -> dict[str, Any]:
    """获取单个书签/笔记

    Args:
        bookmark_id: 书签ID

    Returns:
        书签数据

    Raises:
        HTTPException: 书签不存在
    """
    result = kb_service.get_bookmark(bookmark_id)
    if result is None:
        logger.warning("[Knowledge] 书签不存在: %s", bookmark_id)
        raise HTTPException(status_code=404, detail=f"书签不存在: {bookmark_id}")
    return result


@router.put("/bookmarks/{bookmark_id}", response_model=BookmarkOut)
async def update_bookmark(
    bookmark_id: str,
    data: BookmarkUpdate,
) -> dict[str, Any]:
    """更新书签/笔记

    只更新提供的字段，未提供的字段保持不变。

    Args:
        bookmark_id: 书签ID
        data: 更新数据

    Returns:
        更新后的书签

    Raises:
        HTTPException: 书签不存在
    """
    result = kb_service.update_bookmark(
        bookmark_id=bookmark_id,
        title=data.title,
        url=data.url,
        content=data.content,
        tags=data.tags,
        bookmark_type=data.bookmark_type.value if data.bookmark_type else None,
    )
    if result is None:
        logger.warning("[Knowledge] 更新失败，书签不存在: %s", bookmark_id)
        raise HTTPException(status_code=404, detail=f"书签不存在: {bookmark_id}")
    logger.info("[Knowledge] 更新书签: %s", bookmark_id)
    return result


@router.delete("/bookmarks/{bookmark_id}", status_code=204, response_model=None)
async def delete_bookmark(bookmark_id: str) -> None:
    """删除书签/笔记

    Args:
        bookmark_id: 书签ID

    Raises:
        HTTPException: 书签不存在
    """
    success = kb_service.delete_bookmark(bookmark_id)
    if not success:
        logger.warning("[Knowledge] 删除失败，书签不存在: %s", bookmark_id)
        raise HTTPException(status_code=404, detail=f"书签不存在: {bookmark_id}")
    logger.info("[Knowledge] 删除书签: %s", bookmark_id)
    return None


# ------------------------------------------------------------------
# 搜索
# ------------------------------------------------------------------

@router.post("/search")
async def search_bookmarks(request: BookmarkSearchRequest) -> dict[str, Any]:
    """搜索书签/笔记

    在标题、URL、内容和标签中搜索关键词。

    Args:
        request: 搜索请求，包含keyword和可选的tags

    Returns:
        包含 results(结果列表) 和 count(结果数) 的响应
    """
    results = kb_service.search_bookmarks(request.keyword)

    # 如果指定了标签，进一步筛选
    if request.tags:
        tag_set = set(request.tags)
        results = [
            r for r in results
            if isinstance(r, dict) and any(t in r.get("tags", []) for t in tag_set)
        ]

    logger.info(
        "[Knowledge] 搜索 '%s' 找到 %d 条结果",
        request.keyword,
        len(results),
    )
    return {"results": results, "count": len(results)}


# ------------------------------------------------------------------
# 标签
# ------------------------------------------------------------------

@router.get("/tags")
async def get_all_tags() -> dict[str, Any]:
    """获取所有标签

    Returns:
        包含 tags(去重排序后的标签列表) 的响应
    """
    tags = kb_service.get_all_tags()
    return {"tags": tags}


@router.get("/tags/{tag}")
async def get_bookmarks_by_tag(
    tag: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """按标签获取书签

    Args:
        tag: 标签名
        page: 页码
        page_size: 每页条数

    Returns:
        包含 items(列表), total(总数), page, page_size 的响应
    """
    items = kb_service.get_bookmarks_by_tag(tag)
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
