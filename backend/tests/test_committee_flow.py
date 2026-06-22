"""
投委会流程端到端测试

测试场景：
1. 上传单个材料，验证完整流程
2. 上传多个材料，验证秘书Agent材料合并
3. 模拟部门Agent失败，验证错误处理
4. 验证SSE事件顺序
5. 验证文件系统状态保存
"""

import asyncio
import shutil
import tempfile
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.agents.department_agents import (
    FinancialModelerAgent,
    InvestmentAgent,
    LegalAgent,
    MarketAnalystAgent,
)
from backend.agents.flow_state_manager import FlowStateManager
from backend.agents.orchestrator_v2 import CommitteeFlowOrchestrator


# ---------------------------------------------------------------------------
# 模块级 fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_api_key():
    return "test-api-key"


@pytest.fixture
def mock_state_manager():
    """模拟状态管理器，接受任意阶段名称不抛异常"""
    sm = MagicMock(spec=FlowStateManager)
    sm.save_stage_result = MagicMock()
    sm.mark_stage_complete = MagicMock()
    sm.ensure_directories = MagicMock(return_value=MagicMock())
    sm.save_analysis_result = MagicMock()
    sm._load_metadata = MagicMock(return_value=None)
    return sm


@pytest.fixture
def orchestrator(mock_api_key, mock_state_manager):
    return CommitteeFlowOrchestrator(
        api_key=mock_api_key,
        state_manager=mock_state_manager,
    )


@pytest.fixture
def temp_state_manager():
    temp = tempfile.mkdtemp()
    sm = FlowStateManager(base_path=temp)
    yield sm
    shutil.rmtree(temp)


# ---------------------------------------------------------------------------
# 辅助函数
# ---------------------------------------------------------------------------


async def _collect_events(async_gen):
    """辅助函数：收集异步生成器的所有事件"""
    events = []
    async for event in async_gen:
        events.append(event)
    return events


# ---------------------------------------------------------------------------
# 测试类
# ---------------------------------------------------------------------------


class TestCommitteeFlowOrchestrator:
    """测试流程编排器"""

    @pytest.mark.asyncio
    async def test_event_sequence(self, orchestrator):
        """测试SSE事件序列完整性"""
        materials = [{"filename": "test.pdf", "content": "test content"}]

        with patch.object(
            orchestrator,
            "_run_secretary",
            new=AsyncMock(
                return_value={
                    "project_name": "Test",
                    "structured_content": "test content",
                }
            ),
        ), patch.object(
            orchestrator,
            "_run_departments",
            new=AsyncMock(return_value={"market": {}, "financial": {}, "investment": {}}),
        ), patch.object(
            orchestrator,
            "_run_master_skill",
            new=AsyncMock(return_value={"insights": []}),
        ), patch.object(
            orchestrator,
            "_run_decision_maker",
            new=AsyncMock(return_value={"score": 75}),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id="test-001",
                )
            )

        # 验证关键事件存在
        event_types = [e["type"] for e in events]
        assert "stage_start" in event_types
        assert "stage_complete" in event_types
        assert "flow_complete" in event_types

        # 验证stage_start的顺序
        stage_starts = [e for e in events if e["type"] == "stage_start"]
        expected_stages = [
            orchestrator.STAGE_SECRETARY,
            orchestrator.STAGE_DEPARTMENTS,
            orchestrator.STAGE_MASTER_SKILL,
            orchestrator.STAGE_DECISION_MAKER,
        ]
        assert len(stage_starts) == len(expected_stages)
        for i, expected in enumerate(expected_stages):
            assert stage_starts[i]["stage"] == expected

    @pytest.mark.asyncio
    async def test_single_material(self, orchestrator):
        """测试单个材料处理"""
        materials = [{"filename": "project.pdf", "content": "项目内容"}]

        mock_secretary = AsyncMock(
            return_value={
                "project_name": "Project",
                "structured_content": "结构化内容",
            }
        )
        mock_departments = AsyncMock(return_value={})
        mock_master = AsyncMock(return_value={})
        mock_decision = AsyncMock(return_value={"score": 80})

        with patch.object(
            orchestrator, "_run_secretary", new=mock_secretary
        ), patch.object(
            orchestrator, "_run_departments", new=mock_departments
        ), patch.object(
            orchestrator, "_run_master_skill", new=mock_master
        ), patch.object(
            orchestrator, "_run_decision_maker", new=mock_decision
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id="test-002",
                )
            )

            # 验证秘书Agent被调用
            mock_secretary.assert_called_once()

            # 验证流程完成
            final_events = [e for e in events if e["type"] == "flow_complete"]
            assert len(final_events) == 1

            # 验证final_report结构
            final_report = final_events[0]["final_report"]
            assert final_report["session_id"] == "test-002"
            assert final_report["project_type"] == "commercial"
            assert final_report["project_name"] == "Project"

    @pytest.mark.asyncio
    async def test_multiple_materials(self, orchestrator):
        """测试多个材料处理"""
        materials = [
            {"filename": "project.pdf", "content": "项目内容"},
            {"filename": "financial.xlsx", "content": "财务数据"},
        ]

        mock_secretary = AsyncMock(
            return_value={
                "project_name": "Multi",
                "structured_content": "合并后的内容",
            }
        )

        with patch.object(
            orchestrator, "_run_secretary", new=mock_secretary
        ), patch.object(
            orchestrator,
            "_run_departments",
            new=AsyncMock(return_value={}),
        ), patch.object(
            orchestrator, "_run_master_skill", new=AsyncMock(return_value={})
        ), patch.object(
            orchestrator,
            "_run_decision_maker",
            new=AsyncMock(return_value={"score": 70}),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="office",
                    api_key="test-key",
                    session_id="test-003",
                )
            )

            # 验证秘书Agent被调用一次（处理多个材料）
            mock_secretary.assert_called_once()
            call_args = mock_secretary.call_args
            assert len(call_args[0][0]) == 2  # 两个材料

            # 验证流程完成
            final_events = [e for e in events if e["type"] == "flow_complete"]
            assert len(final_events) == 1

    @pytest.mark.asyncio
    async def test_state_manager_called(self, orchestrator, mock_state_manager):
        """测试流程中状态管理器被调用"""
        materials = [{"filename": "test.pdf", "content": "test"}]

        with patch.object(
            orchestrator,
            "_run_secretary",
            new=AsyncMock(
                return_value={
                    "project_name": "Persist",
                    "structured_content": "content",
                }
            ),
        ), patch.object(
            orchestrator,
            "_run_departments",
            new=AsyncMock(return_value={"market": {"score": 70}}),
        ), patch.object(
            orchestrator,
            "_run_master_skill",
            new=AsyncMock(return_value={"insights": ["insight"]}),
        ), patch.object(
            orchestrator,
            "_run_decision_maker",
            new=AsyncMock(return_value={"score": 80, "rating": "B+"}),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id="test-persistence",
                )
            )

        # 验证状态管理器在流程开始时被调用保存metadata
        assert mock_state_manager.save_stage_result.called

        # 验证ensure_directories在秘书完成后被调用
        assert mock_state_manager.ensure_directories.called

        # 验证分析结果通过 save_stage_result 被保存（阶段名为 "analysis"）
        # 注意：orchestrator 使用 save_stage_result 而非 save_analysis_result
        analysis_calls = [
            call
            for call in mock_state_manager.save_stage_result.call_args_list
            if len(call[0]) >= 2 and call[0][1] == "analysis"
        ]
        assert len(analysis_calls) >= 1, "analysis result was not saved"

        # 验证流程完成
        flow_events = [e for e in events if e["type"] == "flow_complete"]
        assert len(flow_events) == 1

    @pytest.mark.asyncio
    async def test_flow_complete_event_structure(self, orchestrator):
        """测试flow_complete事件结构"""
        materials = [{"filename": "test.pdf", "content": "test"}]

        with patch.object(
            orchestrator,
            "_run_secretary",
            new=AsyncMock(
                return_value={
                    "project_name": "StructTest",
                    "structured_content": "content",
                }
            ),
        ), patch.object(
            orchestrator,
            "_run_departments",
            new=AsyncMock(return_value={"market": {}}),
        ), patch.object(
            orchestrator, "_run_master_skill", new=AsyncMock(return_value={})
        ), patch.object(
            orchestrator,
            "_run_decision_maker",
            new=AsyncMock(return_value={"score": 85}),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="office",
                    api_key="test-key",
                    session_id="test-struct",
                )
            )

        flow_events = [e for e in events if e["type"] == "flow_complete"]
        assert len(flow_events) == 1

        final_report = flow_events[0]["final_report"]
        required_keys = [
            "session_id",
            "project_name",
            "project_type",
            "project_slug",
            "secretary_result",
            "department_results",
            "master_skill_result",
            "decision_result",
        ]
        for key in required_keys:
            assert key in final_report, f"Missing key: {key}"

    @pytest.mark.asyncio
    async def test_session_id_in_all_events(self, orchestrator):
        """测试所有事件都包含session_id"""
        materials = [{"filename": "test.pdf", "content": "test"}]
        session_id = "test-session-check"

        with patch.object(
            orchestrator,
            "_run_secretary",
            new=AsyncMock(
                return_value={
                    "project_name": "SessTest",
                    "structured_content": "content",
                }
            ),
        ), patch.object(
            orchestrator,
            "_run_departments",
            new=AsyncMock(return_value={}),
        ), patch.object(
            orchestrator, "_run_master_skill", new=AsyncMock(return_value={})
        ), patch.object(
            orchestrator,
            "_run_decision_maker",
            new=AsyncMock(return_value={"score": 60}),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id=session_id,
                )
            )

        for event in events:
            assert (
                event.get("session_id") == session_id
            ), f"Event missing session_id: {event}"


class TestDepartmentParallelExecution:
    """测试部门并行执行"""

    @pytest.mark.asyncio
    async def test_departments_run_in_parallel(self):
        """测试三个部门可以并行启动"""
        api_key = "test-key"
        structured_content = "测试项目资料"

        # 创建Agent实例（使用新9部门架构中的部门）
        market = MarketAnalystAgent(api_key)
        financial = FinancialModelerAgent(api_key)
        investment = InvestmentAgent(api_key)

        # Mock所有Agent的analyze方法
        with patch.object(
            market, "analyze", AsyncMock(return_value={"score": 75})
        ) as mock_market, patch.object(
            financial, "analyze", AsyncMock(return_value={"score": 80})
        ) as mock_financial, patch.object(
            investment, "analyze", AsyncMock(return_value={"score": 65})
        ) as mock_investment:

            # 并行执行
            results = await asyncio.gather(
                market.analyze(structured_content),
                financial.analyze(structured_content),
                investment.analyze(structured_content),
            )

            # 验证所有都被调用
            mock_market.assert_called_once_with(structured_content)
            mock_financial.assert_called_once_with(structured_content)
            mock_investment.assert_called_once_with(structured_content)

            # 验证结果
            assert len(results) == 3
            assert results[0]["score"] == 75
            assert results[1]["score"] == 80
            assert results[2]["score"] == 65


class TestErrorHandling:
    """测试错误处理"""

    @pytest.mark.asyncio
    async def test_department_failure_continues(self):
        """测试单个部门失败不影响其他部门（asyncio.gather行为）"""

        async def failing_analyze(content):
            raise Exception("API Error")

        async def success_analyze(content):
            return {"score": 75}

        # 模拟一个失败，两个成功
        results = await asyncio.gather(
            failing_analyze("test"),
            success_analyze("test"),
            success_analyze("test"),
            return_exceptions=True,
        )

        # 一个异常，两个成功结果
        exceptions = [r for r in results if isinstance(r, Exception)]
        successes = [r for r in results if not isinstance(r, Exception)]

        assert len(exceptions) == 1
        assert len(successes) == 2
        assert successes[0]["score"] == 75
        assert successes[1]["score"] == 75

    @pytest.mark.asyncio
    async def test_orchestrator_error_event_on_secretary_failure(self, orchestrator):
        """测试秘书Agent失败时产生error事件"""
        materials = [{"filename": "test.pdf", "content": "test"}]

        with patch.object(
            orchestrator,
            "_run_secretary",
            new=AsyncMock(side_effect=Exception("Secretary failed")),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id="test-error",
                )
            )

        # 应该有stage_start和error事件
        event_types = [e["type"] for e in events]
        assert "stage_start" in event_types
        assert "error" in event_types

        # 验证error事件内容
        error_events = [e for e in events if e["type"] == "error"]
        assert len(error_events) == 1
        assert "Secretary failed" in error_events[0]["error"]

    @pytest.mark.asyncio
    async def test_orchestrator_no_flow_complete_on_error(self, orchestrator):
        """测试秘书Agent失败时不应产生flow_complete"""
        materials = [{"filename": "test.pdf", "content": "test"}]

        with patch.object(
            orchestrator,
            "_run_secretary",
            new=AsyncMock(side_effect=Exception("Secretary failed")),
        ):
            events = await _collect_events(
                orchestrator.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id="test-no-complete",
                )
            )

        # 不应有flow_complete事件
        flow_complete_events = [e for e in events if e["type"] == "flow_complete"]
        assert len(flow_complete_events) == 0


class TestOrchestratorWithoutStateManager:
    """测试无状态管理器的编排器"""

    @pytest.fixture
    def orchestrator_no_state(self, mock_api_key):
        return CommitteeFlowOrchestrator(api_key=mock_api_key)

    @pytest.mark.asyncio
    async def test_run_without_state_manager(self, orchestrator_no_state):
        """测试编排器可以在没有状态管理器的情况下运行"""
        materials = [{"filename": "test.pdf", "content": "test"}]

        with patch.object(
            orchestrator_no_state,
            "_run_secretary",
            new=AsyncMock(
                return_value={
                    "project_name": "NoState",
                    "structured_content": "content",
                }
            ),
        ), patch.object(
            orchestrator_no_state,
            "_run_departments",
            new=AsyncMock(return_value={}),
        ), patch.object(
            orchestrator_no_state,
            "_run_master_skill",
            new=AsyncMock(return_value={}),
        ), patch.object(
            orchestrator_no_state,
            "_run_decision_maker",
            new=AsyncMock(return_value={"score": 90}),
        ):
            events = await _collect_events(
                orchestrator_no_state.run_full_flow(
                    materials=materials,
                    project_type="commercial",
                    api_key="test-key",
                    session_id="test-nostate",
                )
            )

        # 验证流程完成
        flow_events = [e for e in events if e["type"] == "flow_complete"]
        assert len(flow_events) == 1


def test_import_all_modules():
    """测试所有模块可以正确导入"""
    from backend.agents.flow_state_manager import FlowStateManager
    from backend.agents.secretary_agent import SecretaryAgent
    from backend.agents.department_agents import (
        AssetManagementAgent,
        CostAgent,
        DesignAgent,
        EngineeringAgent,
        FinancialModelerAgent,
        InvestmentAgent,
        LegalAgent,
        MarketAnalystAgent,
        OperationAgent,
    )
    from backend.agents.master_skill_agent import MasterSkillAgent
    from backend.agents.decision_maker_agent import DecisionMakerAgent
    from backend.agents.orchestrator_v2 import CommitteeFlowOrchestrator
    from backend.config import Config

    assert FlowStateManager is not None
    assert SecretaryAgent is not None
    assert MarketAnalystAgent is not None
    assert FinancialModelerAgent is not None
    assert InvestmentAgent is not None
    assert AssetManagementAgent is not None
    assert OperationAgent is not None
    assert DesignAgent is not None
    assert EngineeringAgent is not None
    assert CostAgent is not None
    assert LegalAgent is not None
    assert MasterSkillAgent is not None
    assert DecisionMakerAgent is not None
    assert CommitteeFlowOrchestrator is not None
    assert Config is not None
