"""知识库服务（内存版）

提供书签和笔记的CRUD、搜索和标签管理功能。
数据存储在内存中，应用重启后重置。
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Optional

from backend.quantsmart.memory import bookmark_store

logger = logging.getLogger(__name__)


class KnowledgeBaseService:
    """知识库服务

    管理书签和笔记的CRUD操作，支持标签筛选和全文搜索。
    所有数据存储在内存中。

    Example:
        >>> kb = KnowledgeBaseService()
        >>> bid = kb.create_bookmark(title="FastAPI", url="https://fastapi.io")
        >>> bookmark = kb.get_bookmark(bid)
        >>> results = kb.search("FastAPI")
    """

    # ------------------------------------------------------------------
    # 书签/笔记 CRUD
    # ------------------------------------------------------------------

    def create_bookmark(
        self,
        title: str,
        url: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[list[str]] = None,
        bookmark_type: str = "bookmark",
    ) -> dict[str, Any]:
        """创建书签/笔记

        Args:
            title: 标题
            url: 关联URL（可选）
            content: 笔记内容（可选）
            tags: 标签列表（可选）
            bookmark_type: 类型，bookmark 或 note

        Returns:
            创建的书条目（含ID和时间戳）
        """
        item = {
            "title": title,
            "url": url,
            "content": content,
            "tags": tags or [],
            "bookmark_type": bookmark_type,
        }
        item_id = bookmark_store.create(item)
        logger.info("[KBService] 创建书签: %s | %s", item_id, title)
        return bookmark_store.get(item_id) or item

    def get_bookmark(self, bookmark_id: str) -> Optional[dict[str, Any]]:
        """获取书签/笔记

        Args:
            bookmark_id: 书签ID

        Returns:
            书签数据，不存在返回None
        """
        return bookmark_store.get(bookmark_id)

    def update_bookmark(
        self,
        bookmark_id: str,
        title: Optional[str] = None,
        url: Optional[str] = None,
        content: Optional[str] = None,
        tags: Optional[list[str]] = None,
        bookmark_type: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """更新书签/笔记

        Args:
            bookmark_id: 书签ID
            title: 新标题（可选）
            url: 新URL（可选）
            content: 新内容（可选）
            tags: 新标签列表（可选）
            bookmark_type: 新类型（可选）

        Returns:
            更新后的书签，不存在返回None
        """
        updates: dict[str, Any] = {}
        if title is not None:
            updates["title"] = title
        if url is not None:
            updates["url"] = url
        if content is not None:
            updates["content"] = content
        if tags is not None:
            updates["tags"] = tags
        if bookmark_type is not None:
            updates["bookmark_type"] = bookmark_type

        if not updates:
            return bookmark_store.get(bookmark_id)

        result = bookmark_store.update(bookmark_id, updates)
        if result:
            logger.info("[KBService] 更新书签: %s", bookmark_id)
        return result

    def delete_bookmark(self, bookmark_id: str) -> bool:
        """删除书签/笔记

        Args:
            bookmark_id: 书签ID

        Returns:
            是否成功删除
        """
        success = bookmark_store.delete(bookmark_id)
        if success:
            logger.info("[KBService] 删除书签: %s", bookmark_id)
        return success

    # ------------------------------------------------------------------
    # 列表与搜索
    # ------------------------------------------------------------------

    def list_bookmarks(
        self,
        page: int = 1,
        page_size: int = 20,
        bookmark_type: Optional[str] = None,
        tags: Optional[list[str]] = None,
    ) -> dict[str, Any]:
        """列出书签/笔记（支持筛选和分页）

        Args:
            page: 页码
            page_size: 每页条数
            bookmark_type: 按类型筛选
            tags: 按标签筛选（包含任一指定标签）

        Returns:
            包含 items, total, page, page_size 的字典
        """

        def predicate(item: Any) -> bool:
            if not isinstance(item, dict):
                return False
            if bookmark_type and item.get("bookmark_type") != bookmark_type:
                return False
            if tags:
                item_tags = set(item.get("tags", []))
                if not any(tag in item_tags for tag in tags):
                    return False
            return True

        items, total = bookmark_store.filter(predicate, page=page, page_size=page_size)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def search_bookmarks(self, keyword: str) -> list[dict[str, Any]]:
        """搜索书签/笔记

        在标题、URL、内容和标签中搜索关键词。

        Args:
            keyword: 搜索关键词

        Returns:
            匹配的书签列表
        """
        results = bookmark_store.search(
            keyword,
            fields=["title", "url", "content", "tags"],
        )
        logger.info(
            "[KBService] 搜索 '%s' 找到 %d 条结果",
            keyword,
            len(results),
        )
        return results

    # ------------------------------------------------------------------
    # 标签管理
    # ------------------------------------------------------------------

    def get_all_tags(self) -> list[str]:
        """获取所有标签（去重并按字母排序）

        Returns:
            标签列表
        """
        tag_set: set[str] = set()
        for item in bookmark_store._data.values():
            if isinstance(item, dict):
                tag_set.update(item.get("tags", []))
        return sorted(tag_set)

    def get_bookmarks_by_tag(self, tag: str) -> list[dict[str, Any]]:
        """获取指定标签的所有书签

        Args:
            tag: 标签名

        Returns:
            书签列表
        """
        results: list[dict[str, Any]] = []
        for item in bookmark_store._data.values():
            if isinstance(item, dict) and tag in item.get("tags", []):
                results.append(item)
        return results

    # ------------------------------------------------------------------
    # 分析报告存储
    # ------------------------------------------------------------------

    def save_analysis(
        self,
        title: str,
        analysis_type: str,
        project_name: str,
        project_type: str,
        session_id: str,
        content: str,
        tags: Optional[list[str]] = None,
    ) -> str:
        """保存分析结果到知识库

        使用bookmark_store.create()保存分析报告，支持自动标签插入。

        Args:
            title: 分析报告标题
            analysis_type: 分析类型标识（如 material_analysis, ai-product 等）
            project_name: 项目名称
            project_type: 项目类型
            session_id: 会话ID
            content: JSON字符串，包含完整报告内容
            tags: 标签列表（可选），analysis_type会自动插入

        Returns:
            str: 书签/知识库条目ID
        """
        # 确保analysis_type在tags中
        merged_tags: list[str] = list(tags) if tags else []
        if analysis_type not in merged_tags:
            merged_tags.append(analysis_type)

        item: dict[str, Any] = {
            "title": title,
            "url": None,
            "content": content,
            "tags": merged_tags,
            "bookmark_type": "analysis",
            "analysis_type": analysis_type,
            "project_name": project_name,
            "project_type": project_type,
            "session_id": session_id,
        }

        bookmark_id = bookmark_store.create(item)
        logger.info(
            "[KBService] 保存分析结果: %s | title=%s | type=%s",
            bookmark_id,
            title,
            analysis_type,
        )
        return bookmark_id

    def search_analysis(
        self,
        keyword: Optional[str] = None,
        analysis_type: Optional[str] = None,
        project_type: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """搜索分析结果

        遍历bookmark_store._data.values()，支持多维度筛选。

        Args:
            keyword: 关键词，匹配标题和内容（不区分大小写）
            analysis_type: 按analysis_type标签筛选
            project_type: 按project_type元数据筛选

        Returns:
            带_meta字段的结果列表
        """
        results: list[dict[str, Any]] = []

        for item in bookmark_store._data.values():
            if not isinstance(item, dict):
                continue

            # 只筛选bookmark_type为analysis的条目
            if item.get("bookmark_type") != "analysis":
                continue

            # 按analysis_type筛选
            if analysis_type is not None:
                item_tags = item.get("tags", [])
                if analysis_type not in item_tags:
                    continue

            # 按project_type元数据筛选
            if project_type is not None:
                if item.get("project_type") != project_type:
                    continue

            # 按关键词筛选（匹配标题和内容）
            if keyword:
                keyword_lower = keyword.lower()
                title = item.get("title", "")
                content = item.get("content", "")
                if (
                    keyword_lower not in title.lower()
                    and keyword_lower not in str(content).lower()
                ):
                    continue

            # 添加_meta字段
            enriched = dict(item)
            enriched["_meta"] = {
                "match_reason": "all"
                if not keyword
                else f"keyword_match: {keyword}",
                "filters": {
                    "analysis_type": analysis_type,
                    "project_type": project_type,
                },
            }
            results.append(enriched)

        logger.info(
            "[KBService] 搜索分析结果: keyword=%s, analysis_type=%s, project_type=%s, count=%d",
            keyword,
            analysis_type,
            project_type,
            len(results),
        )
        return results
