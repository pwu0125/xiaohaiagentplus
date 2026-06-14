"""quantsmart 内存管理模块

提供简单的内存存储功能，用于知识库和对话Session的临时存储。
数据仅在应用运行期间保持，重启后重置。

TODO: 如需持久化，可替换为SQLite/Redis实现。
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any, Generic, Optional, TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


class MemoryStore(Generic[T]):
    """通用内存存储

    基于字典的通用存储，支持CRUD操作和按条件筛选。

    Example:
        >>> store = MemoryStore[dict]()
        >>> store.create({"name": "test"})
        'uuid-string'
        >>> store.get('uuid-string')
        {'id': 'uuid-string', 'name': 'test', ...}
    """

    def __init__(self) -> None:
        self._data: dict[str, T] = {}

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create(self, item: T, item_id: Optional[str] = None) -> str:
        """创建条目

        Args:
            item: 要存储的数据对象
            item_id: 可选的指定ID，不指定则自动生成UUID

        Returns:
            条目的唯一ID
        """
        _id = item_id or str(uuid.uuid4())
        if isinstance(item, dict):
            item["id"] = _id
            item.setdefault("created_at", datetime.now().isoformat())
            item.setdefault("updated_at", datetime.now().isoformat())
        self._data[_id] = item
        logger.debug("[MemoryStore] 创建条目: %s", _id)
        return _id

    def get(self, item_id: str) -> Optional[T]:
        """获取条目

        Args:
            item_id: 条目ID

        Returns:
            条目数据，不存在则返回None
        """
        return self._data.get(item_id)

    def update(self, item_id: str, updates: dict[str, Any]) -> Optional[T]:
        """更新条目

        Args:
            item_id: 条目ID
            updates: 要更新的字段字典

        Returns:
            更新后的条目，不存在则返回None
        """
        item = self._data.get(item_id)
        if item is None:
            logger.warning("[MemoryStore] 更新失败，条目不存在: %s", item_id)
            return None
        if isinstance(item, dict):
            item.update(updates)
            item["updated_at"] = datetime.now().isoformat()
        self._data[item_id] = item
        logger.debug("[MemoryStore] 更新条目: %s", item_id)
        return item

    def delete(self, item_id: str) -> bool:
        """删除条目

        Args:
            item_id: 条目ID

        Returns:
            是否成功删除
        """
        if item_id in self._data:
            del self._data[item_id]
            logger.debug("[MemoryStore] 删除条目: %s", item_id)
            return True
        logger.warning("[MemoryStore] 删除失败，条目不存在: %s", item_id)
        return False

    # ------------------------------------------------------------------
    # 查询
    # ------------------------------------------------------------------

    def list_all(
        self,
        page: int = 1,
        page_size: int = 20,
        sort_key: Optional[str] = None,
        reverse: bool = True,
    ) -> tuple[list[T], int]:
        """列出所有条目（支持分页和排序）

        Args:
            page: 页码，从1开始
            page_size: 每页条数
            sort_key: 排序字段名（要求条目为dict）
            reverse: 是否倒序

        Returns:
            (当前页条目列表, 总条目数)
        """
        items = list(self._data.values())
        total = len(items)

        if sort_key and items:
            try:
                items.sort(
                    key=lambda x: (x.get(sort_key, "") if isinstance(x, dict) else ""),
                    reverse=reverse,
                )
            except Exception:
                pass

        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    def filter(
        self,
        predicate: Callable[[T], bool],
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[T], int]:
        """按条件筛选条目

        Args:
            predicate: 筛选函数，返回True表示保留
            page: 页码，从1开始
            page_size: 每页条数

        Returns:
            (当前页条目列表, 总条目数)
        """
        items = [item for item in self._data.values() if predicate(item)]
        total = len(items)
        start = (page - 1) * page_size
        end = start + page_size
        return items[start:end], total

    def search(self, keyword: str, fields: list[str]) -> list[T]:
        """搜索条目

        在指定字段中搜索包含关键字的条目（不区分大小写）。

        Args:
            keyword: 搜索关键词
            fields: 要搜索的字段名列表

        Returns:
            匹配的条目列表
        """
        keyword_lower = keyword.lower()
        results: list[T] = []
        for item in self._data.values():
            if not isinstance(item, dict):
                continue
            for field in fields:
                value = item.get(field)
                if value and keyword_lower in str(value).lower():
                    results.append(item)
                    break
        return results

    def clear(self) -> None:
        """清空所有数据"""
        self._data.clear()
        logger.info("[MemoryStore] 已清空所有数据")


# ============================================================================
# 全局存储实例
# ============================================================================

# 知识库书签存储
bookmark_store: MemoryStore[dict] = MemoryStore()

# 对话Session存储
chat_session_store: MemoryStore[dict] = MemoryStore()
