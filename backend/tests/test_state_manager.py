"""
FlowStateManager 专项测试

测试范围：
1. 目录创建与结构验证
2. 阶段结果的保存与加载
3. 阶段完成标记
4. 流程状态查询
5. 元数据管理
6. 异常场景处理
"""

import json
import shutil
import tempfile
from pathlib import Path

import pytest

from backend.agents.flow_state_manager import FlowStateManager


class TestFlowStateManager:
    """测试状态管理器"""

    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp = tempfile.mkdtemp()
        yield temp
        shutil.rmtree(temp)

    @pytest.fixture
    def state_manager(self, temp_dir):
        return FlowStateManager(base_path=temp_dir)

    @pytest.fixture
    def session_id(self):
        return "test-session-001"

    @pytest.fixture
    def project_slug(self):
        return "test-project"

    def test_init_default_path(self):
        """测试默认初始化路径"""
        manager = FlowStateManager()
        assert manager.base_path == Path("data/分析结果")

    def test_init_custom_path(self, temp_dir):
        """测试自定义路径初始化"""
        manager = FlowStateManager(base_path=temp_dir)
        assert manager.base_path == Path(temp_dir)

    def test_ensure_directories(self, state_manager, session_id, project_slug):
        """测试目录创建"""
        path = state_manager.ensure_directories(session_id, project_slug)

        assert path.exists()
        assert path == state_manager._get_session_path(session_id)
        assert (path / "stages").exists()
        assert (path / "stages" / "02_departments").exists()

    def test_ensure_directories_creates_metadata(self, state_manager, session_id, project_slug):
        """测试目录创建时初始化元数据"""
        path = state_manager.ensure_directories(session_id, project_slug)
        metadata_path = path / "flow_metadata.json"

        assert metadata_path.exists()

        with open(metadata_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)

        assert metadata["session_id"] == session_id
        assert metadata["project_slug"] == project_slug
        assert metadata["completed_stages"] == []
        assert metadata["current_stage"] is None
        assert metadata["status"] == "initialized"
        assert metadata["department_statuses"]["market"] == "pending"
        assert metadata["department_statuses"]["financial"] == "pending"
        assert metadata["department_statuses"]["risk"] == "pending"

    def test_ensure_directories_idempotent(self, state_manager, session_id):
        """测试重复调用ensure_directories不会报错"""
        path1 = state_manager.ensure_directories(session_id, "project-1")
        path2 = state_manager.ensure_directories(session_id, "project-1")
        assert path1 == path2

    def test_save_and_load_stage_result(self, state_manager, session_id):
        """测试保存和读取阶段结果"""
        state_manager.ensure_directories(session_id, "test-project")
        result = {"test": "data", "number": 42}

        state_manager.save_stage_result(session_id, "01_secretary", result)
        loaded = state_manager.load_stage_result(session_id, "01_secretary")

        assert loaded == result

    def test_save_and_load_department_result(self, state_manager, session_id):
        """测试保存和读取部门阶段结果"""
        state_manager.ensure_directories(session_id, "test-project")

        market_result = {"department": "market", "score": 75}
        financial_result = {"department": "financial", "score": 80}

        state_manager.save_stage_result(session_id, "market", market_result)
        state_manager.save_stage_result(session_id, "financial", financial_result)

        loaded_market = state_manager.load_stage_result(session_id, "market")
        loaded_financial = state_manager.load_stage_result(session_id, "financial")

        assert loaded_market == market_result
        assert loaded_financial == financial_result

    def test_load_nonexistent_stage(self, state_manager, session_id):
        """测试读取尚未保存的阶段"""
        state_manager.ensure_directories(session_id, "test-project")
        # 使用有效的阶段名，但该阶段尚未保存数据
        result = state_manager.load_stage_result(session_id, "01_secretary")
        assert result is None

    def test_load_without_ensure_directories(self, state_manager, session_id):
        """测试未创建目录时读取返回None"""
        result = state_manager.load_stage_result(session_id, "01_secretary")
        assert result is None

    def test_mark_stage_complete(self, state_manager, session_id):
        """测试标记阶段完成"""
        state_manager.ensure_directories(session_id, "test-project")
        state_manager.mark_stage_complete(session_id, "01_secretary")

        status = state_manager.get_flow_status(session_id)
        assert "01_secretary" in status.get("completed_stages", [])

    def test_mark_multiple_stages_complete(self, state_manager, session_id):
        """测试标记多个阶段完成"""
        state_manager.ensure_directories(session_id, "test-project")

        stages = ["01_secretary", "market", "financial", "risk"]
        for stage in stages:
            state_manager.mark_stage_complete(session_id, stage)

        status = state_manager.get_flow_status(session_id)
        completed = status.get("completed_stages", [])

        for stage in stages:
            assert stage in completed

    def test_mark_stage_complete_idempotent(self, state_manager, session_id):
        """测试重复标记同一阶段不会重复添加"""
        state_manager.ensure_directories(session_id, "test-project")

        state_manager.mark_stage_complete(session_id, "01_secretary")
        state_manager.mark_stage_complete(session_id, "01_secretary")

        status = state_manager.get_flow_status(session_id)
        completed = status.get("completed_stages", [])

        assert completed.count("01_secretary") == 1

    def test_mark_department_stage_complete(self, state_manager, session_id):
        """测试标记部门阶段完成会更新department_statuses"""
        state_manager.ensure_directories(session_id, "test-project")
        state_manager.mark_stage_complete(session_id, "market")

        metadata = state_manager._load_metadata(session_id)
        assert metadata["department_statuses"]["market"] == "completed"

    def test_get_flow_status_empty(self, state_manager, session_id):
        """测试获取空流程状态"""
        state_manager.ensure_directories(session_id, "test-project")
        status = state_manager.get_flow_status(session_id)

        assert isinstance(status, dict)
        assert status.get("session_id") == session_id
        assert status.get("status") == "initialized"
        assert status.get("completed_stages") == []

    def test_get_flow_status_not_found(self, state_manager):
        """测试获取不存在会话的状态"""
        status = state_manager.get_flow_status("nonexistent-session")

        assert isinstance(status, dict)
        assert status["session_id"] == "nonexistent-session"
        assert status["status"] == "not_found"
        assert status["completed_stages"] == []

    def test_save_stage_result_uses_correct_path(self, state_manager, session_id):
        """测试阶段结果保存到正确路径"""
        state_manager.ensure_directories(session_id, "test-project")

        result = {"key": "value"}
        state_manager.save_stage_result(session_id, "03_master_skill", result)

        expected_path = (
            state_manager._get_session_path(session_id)
            / "stages"
            / "03_master_skill.json"
        )
        assert expected_path.exists()

    def test_save_analysis_result(self, state_manager, session_id):
        """测试保存最终分析结果"""
        state_manager.ensure_directories(session_id, "test-project")

        analysis = {"final": "report", "score": 85}
        state_manager.save_analysis_result(session_id, analysis)

        loaded = state_manager.load_analysis_result(session_id)
        assert loaded == analysis

    def test_load_analysis_result_not_found(self, state_manager, session_id):
        """测试读取不存在的分析结果"""
        result = state_manager.load_analysis_result(session_id)
        assert result is None

    def test_save_stage_result_unknown_stage(self, state_manager, session_id):
        """测试保存到未知阶段时抛出ValueError"""
        state_manager.ensure_directories(session_id, "test-project")

        with pytest.raises(ValueError, match="Unknown stage"):
            state_manager.save_stage_result(session_id, "unknown_stage", {"test": "data"})

    def test_load_stage_result_invalid_json(self, state_manager, session_id):
        """测试读取损坏的JSON文件时返回None"""
        state_manager.ensure_directories(session_id, "test-project")

        # 手动写入无效的JSON
        invalid_path = (
            state_manager._get_session_path(session_id)
            / "stages"
            / "01_secretary.json"
        )
        invalid_path.write_text("not valid json{{{")

        result = state_manager.load_stage_result(session_id, "01_secretary")
        assert result is None

    def test_stage_paths_mapping(self):
        """测试阶段路径映射完整性"""
        manager = FlowStateManager()

        expected_stages = [
            "01_secretary",
            "03_master_skill",
            "04_decision_maker",
        ]
        for stage in expected_stages:
            assert stage in manager.STAGE_PATHS

        expected_depts = ["market", "financial", "risk"]
        for dept in expected_depts:
            assert dept in manager.DEPT_STAGE_PATHS

    def test_determine_status_initialized(self, state_manager):
        """测试状态判断：initialized"""
        metadata = {"completed_stages": []}
        assert state_manager._determine_status(metadata) == "initialized"

    def test_determine_status_in_progress(self, state_manager):
        """测试状态判断：in_progress"""
        metadata = {"completed_stages": ["01_secretary", "market"]}
        assert state_manager._determine_status(metadata) == "in_progress"

    def test_determine_status_completed(self, state_manager):
        """测试状态判断：completed"""
        metadata = {
            "completed_stages": [
                "01_secretary",
                "market",
                "financial",
                "risk",
                "03_master_skill",
                "04_decision_maker",
            ]
        }
        assert state_manager._determine_status(metadata) == "completed"

    def test_determine_status_decided(self, state_manager):
        """测试状态判断：decided（决策阶段完成但其他未完成）"""
        metadata = {"completed_stages": ["04_decision_maker"]}
        assert state_manager._determine_status(metadata) == "decided"

    def test_write_json_ensure_ascii_false(self, state_manager, session_id):
        """测试JSON写入中文不转义"""
        state_manager.ensure_directories(session_id, "test-project")

        result = {"项目": "名称", "评分": 85}
        state_manager.save_stage_result(session_id, "01_secretary", result)

        file_path = (
            state_manager._get_session_path(session_id)
            / "stages"
            / "01_secretary.json"
        )
        raw_content = file_path.read_text(encoding="utf-8")

        # 验证中文字符没有被转义
        assert "项目" in raw_content
        assert "名称" in raw_content

    def test_flow_status_with_existing_stages(self, state_manager, session_id):
        """测试流程状态正确反映已存在的阶段文件"""
        state_manager.ensure_directories(session_id, "test-project")

        # 保存几个阶段的结果
        state_manager.save_stage_result(session_id, "01_secretary", {"ok": True})
        state_manager.save_stage_result(session_id, "market", {"score": 75})
        state_manager.mark_stage_complete(session_id, "01_secretary")
        state_manager.mark_stage_complete(session_id, "market")

        status = state_manager.get_flow_status(session_id)

        assert "01_secretary" in status["existing_stages"]
        assert "market" in status["existing_stages"]
        assert status["status"] == "in_progress"

    def test_mark_stage_complete_without_metadata(self, state_manager, session_id, caplog):
        """测试标记阶段完成但元数据不存在时不报错"""
        # 不调用 ensure_directories，所以没有 metadata 文件
        state_manager.mark_stage_complete(session_id, "01_secretary")

        # 应该只是记录警告日志，不抛出异常
        assert "metadata not found" in caplog.text
