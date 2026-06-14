"""状态持久化管理模块

管理投委会流程的文件系统状态持久化，支持会话隔离、
断点续传和中文路径处理。
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


class FlowStateManager:
    """流程状态管理器

    负责管理投委会流程中各阶段状态的持久化存储，
    支持会话隔离目录结构和断点续传。

    目录结构::

        data/分析结果/{project_slug}/
        ├── stages/
        │   ├── 01_secretary.json
        │   ├── 02_departments/
        │   │   ├── market.json
        │   │   ├── financial.json
        │   │   └── risk.json
        │   ├── 03_master_skill.json
        │   └── 04_decision_maker.json
        ├── analysis.json
        └── flow_metadata.json

    Args:
        base_path: 数据存储基础路径，默认为 "data/分析结果"

    Example:
        >>> manager = FlowStateManager("data/分析结果")
        >>> manager.ensure_directories("sess_001", "my-project")
        >>> manager.save_stage_result("sess_001", "01_secretary", {"key": "value"})
    """

    # 阶段到文件路径的映射
    STAGE_PATHS: dict[str, str] = {
        "01_secretary": "stages/01_secretary.json",
        "03_master_skill": "stages/03_master_skill.json",
        "04_decision_maker": "stages/04_decision_maker.json",
    }

    # 部门阶段到子目录的映射
    DEPT_STAGE_PATHS: dict[str, str] = {
        "market": "stages/02_departments/market.json",
        "financial": "stages/02_departments/financial.json",
        "risk": "stages/02_departments/risk.json",
    }

    def __init__(self, base_path: str = "data/分析结果") -> None:
        self.base_path = Path(base_path)
        logger.info("FlowStateManager initialized with base_path: %s", self.base_path)

    def _get_session_path(self, session_id: str) -> Path:
        """获取会话目录路径

        Args:
            session_id: 会话ID

        Returns:
            Path: 会话目录路径
        """
        return self.base_path / session_id

    def ensure_directories(
        self, session_id: str, project_slug: str | None = None
    ) -> Path:
        """确保会话目录结构存在

        创建会话所需的完整目录结构，包括阶段目录和子目录。

        Args:
            session_id: 会话ID
            project_slug: 项目slug，可选

        Returns:
            Path: 会话根目录路径

        Raises:
            OSError: 目录创建失败时抛出
        """
        session_path = self._get_session_path(session_id)

        # 创建所有必要的子目录
        dirs_to_create = [
            session_path / "stages",
            session_path / "stages" / "02_departments",
        ]

        for dir_path in dirs_to_create:
            try:
                dir_path.mkdir(parents=True, exist_ok=True)
                logger.debug("Ensured directory exists: %s", dir_path)
            except OSError as e:
                logger.error("Failed to create directory %s: %s", dir_path, e)
                raise

        # 初始化 flow_metadata.json
        metadata_path = session_path / "flow_metadata.json"
        if not metadata_path.exists():
            metadata: dict[str, Any] = {
                "session_id": session_id,
                "project_slug": project_slug or session_id,
                "completed_stages": [],
                "current_stage": None,
                "status": "initialized",
                "department_statuses": {
                    "market": "pending",
                    "financial": "pending",
                    "risk": "pending",
                },
            }
            self._write_json(metadata_path, metadata)
            logger.info(
                "Initialized flow_metadata for session %s", session_id
            )

        logger.info(
            "Directories ensured for session %s at %s", session_id, session_path
        )
        return session_path

    def save_stage_result(
        self, session_id: str, stage: str, result: dict[str, Any]
    ) -> None:
        """保存阶段结果

        将阶段分析结果保存到对应的JSON文件中。

        Args:
            session_id: 会话ID
            stage: 阶段名称，如 "01_secretary", "market" 等
            result: 阶段结果字典

        Raises:
            ValueError: 阶段名称未知时抛出
            OSError: 文件写入失败时抛出
        """
        file_path = self._resolve_stage_path(session_id, stage)

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            self._write_json(file_path, result)
            logger.info(
                "Saved stage result for session %s, stage %s to %s",
                session_id,
                stage,
                file_path,
            )
        except OSError as e:
            logger.error(
                "Failed to save stage result for %s/%s: %s", session_id, stage, e
            )
            raise

    def load_stage_result(
        self, session_id: str, stage: str
    ) -> dict[str, Any] | None:
        """加载阶段结果

        从文件系统读取指定阶段的分析结果。

        Args:
            session_id: 会话ID
            stage: 阶段名称

        Returns:
            dict | None: 阶段结果字典，不存在时返回None
        """
        file_path = self._resolve_stage_path(session_id, stage)

        if not file_path.exists():
            logger.debug(
                "Stage result not found for session %s, stage %s",
                session_id,
                stage,
            )
            return None

        try:
            data = self._read_json(file_path)
            logger.debug(
                "Loaded stage result for session %s, stage %s",
                session_id,
                stage,
            )
            return data
        except (json.JSONDecodeError, OSError) as e:
            logger.error(
                "Failed to load stage result for %s/%s: %s",
                session_id,
                stage,
                e,
            )
            return None

    def mark_stage_complete(self, session_id: str, stage: str) -> None:
        """标记阶段为已完成

        更新flow_metadata中的阶段完成状态。

        Args:
            session_id: 会话ID
            stage: 阶段名称
        """
        metadata = self._load_metadata(session_id)
        if metadata is None:
            logger.warning(
                "Cannot mark stage complete: metadata not found for %s",
                session_id,
            )
            return

        if stage not in metadata["completed_stages"]:
            metadata["completed_stages"].append(stage)

        # 更新部门状态
        if stage in metadata.get("department_statuses", {}):
            metadata["department_statuses"][stage] = "completed"

        # 更新当前阶段
        metadata["current_stage"] = stage

        self._save_metadata(session_id, metadata)
        logger.info("Marked stage %s as complete for session %s", stage, session_id)

    def get_flow_status(self, session_id: str) -> dict[str, Any]:
        """获取流程状态

        返回指定会话的完整流程状态信息。

        Args:
            session_id: 会话ID

        Returns:
            dict: 流程状态字典，包含completed_stages、current_stage等
        """
        metadata = self._load_metadata(session_id)
        if metadata is None:
            return {
                "session_id": session_id,
                "completed_stages": [],
                "current_stage": None,
                "status": "not_found",
                "department_statuses": {
                    "market": "pending",
                    "financial": "pending",
                    "risk": "pending",
                },
            }

        # 检查各阶段的实际文件是否存在
        all_stages = ["01_secretary", "market", "financial", "risk",
                      "03_master_skill", "04_decision_maker"]
        existing_stages = []
        for s in all_stages:
            result = self.load_stage_result(session_id, s)
            if result is not None:
                existing_stages.append(s)

        metadata["existing_stages"] = existing_stages
        metadata["status"] = self._determine_status(metadata)

        return metadata

    def save_analysis_result(
        self, session_id: str, result: dict[str, Any]
    ) -> None:
        """保存最终分析结果

        将所有阶段的分析结果合并保存为analysis.json。

        Args:
            session_id: 会话ID
            result: 完整的分析结果字典
        """
        session_path = self._get_session_path(session_id)
        analysis_path = session_path / "analysis.json"

        try:
            self._write_json(analysis_path, result)
            logger.info(
                "Saved final analysis result for session %s", session_id
            )
        except OSError as e:
            logger.error(
                "Failed to save analysis result for %s: %s", session_id, e
            )
            raise

    def load_analysis_result(
        self, session_id: str
    ) -> dict[str, Any] | None:
        """加载最终分析结果

        Args:
            session_id: 会话ID

        Returns:
            dict | None: 分析结果字典，不存在时返回None
        """
        session_path = self._get_session_path(session_id)
        analysis_path = session_path / "analysis.json"

        if not analysis_path.exists():
            return None

        try:
            return self._read_json(analysis_path)
        except (json.JSONDecodeError, OSError) as e:
            logger.error(
                "Failed to load analysis result for %s: %s", session_id, e
            )
            return None

    def _resolve_stage_path(self, session_id: str, stage: str) -> Path:
        """解析阶段名称到文件路径

        Args:
            session_id: 会话ID
            stage: 阶段名称

        Returns:
            Path: 阶段结果文件路径

        Raises:
            ValueError: 阶段名称未知时抛出
        """
        session_path = self._get_session_path(session_id)

        if stage in self.STAGE_PATHS:
            relative_path = self.STAGE_PATHS[stage]
        elif stage in self.DEPT_STAGE_PATHS:
            relative_path = self.DEPT_STAGE_PATHS[stage]
        else:
            raise ValueError(
                f"Unknown stage: {stage}. Available stages: "
                f"{list(self.STAGE_PATHS.keys()) + list(self.DEPT_STAGE_PATHS.keys())}"
            )

        return session_path / relative_path

    def _load_metadata(self, session_id: str) -> dict[str, Any] | None:
        """加载流程元数据

        Args:
            session_id: 会话ID

        Returns:
            dict | None: 元数据字典，不存在时返回None
        """
        session_path = self._get_session_path(session_id)
        metadata_path = session_path / "flow_metadata.json"

        if not metadata_path.exists():
            return None

        try:
            return self._read_json(metadata_path)
        except (json.JSONDecodeError, OSError) as e:
            logger.error(
                "Failed to load metadata for session %s: %s", session_id, e
            )
            return None

    def _save_metadata(
        self, session_id: str, metadata: dict[str, Any]
    ) -> None:
        """保存流程元数据

        Args:
            session_id: 会话ID
            metadata: 元数据字典
        """
        session_path = self._get_session_path(session_id)
        metadata_path = session_path / "flow_metadata.json"
        self._write_json(metadata_path, metadata)

    @staticmethod
    def _write_json(file_path: Path, data: dict[str, Any]) -> None:
        """写入JSON文件，确保中文正确编码

        Args:
            file_path: 目标文件路径
            data: 要写入的数据
        """
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    @staticmethod
    def _read_json(file_path: Path) -> dict[str, Any]:
        """读取JSON文件

        Args:
            file_path: 源文件路径

        Returns:
            dict: 读取的数据
        """
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _determine_status(metadata: dict[str, Any]) -> str:
        """根据元数据确定流程状态

        Args:
            metadata: 流程元数据

        Returns:
            str: 流程状态字符串
        """
        completed = metadata.get("completed_stages", [])
        all_stages = ["01_secretary", "market", "financial", "risk",
                      "03_master_skill", "04_decision_maker"]

        if not completed:
            return "initialized"
        if all(s in completed for s in all_stages):
            return "completed"
        if "04_decision_maker" in completed:
            return "decided"
        if "01_secretary" not in completed:
            return "initialized"
        return "in_progress"
