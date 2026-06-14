"""
CommitteeFlowOrchestrator - 投委会流程编排器 V2

编排整个投委会多Agent分析流程，支持SSE事件流式推送。

执行顺序:
    1. secretary      - 秘书Agent: 材料结构化（串行，关键路径）
    2. departments    - 部门Agent: 投资部/资管部/市场部/运营部/财务部/设计部/工程部/成本部/法律部（并行）
    3. master_skill   - 大师Agent: 4位投资大师可多选并行分析
    4. decision_maker - 决策者Agent: 最终投资决策（串行）

SSE事件类型:
    - stage_start         : 大阶段开始
    - stage_progress      : 阶段内进度更新
    - stage_complete      : 大阶段完成，含 result
    - department_started  : 单个部门Agent开始
    - department_complete : 单个部门Agent完成，含 result
    - master_started      : 单个大师Agent开始
    - master_complete     : 单个大师Agent完成，含 result
    - flow_complete       : 整个流程完成，含 final_report
    - error               : 错误事件
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncGenerator

from backend.agents.decision_maker_agent import DecisionMakerAgent
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
from backend.agents.flow_state_manager import FlowStateManager
from backend.agents.master_skill_agent import MASTER_REGISTRY
from backend.agents.secretary_agent import SecretaryAgent

logger = logging.getLogger(__name__)


class CommitteeFlowOrchestrator:
    """投委会流程编排器，按序执行多Agent分析流程并通过SSE事件汇报进度。"""

    STAGE_SECRETARY: str = "secretary"
    STAGE_DEPARTMENTS: str = "departments"
    STAGE_MASTER_SKILL: str = "master_skill"
    STAGE_DECISION_MAKER: str = "decision_maker"

    DEPARTMENT_NAMES: list[str] = [
        "investment",
        "asset_management",
        "market",
        "operation",
        "financial",
        "design",
        "engineering",
        "cost",
        "legal",
    ]

    MASTER_NAMES: list[str] = [
        "buffett",
        "munger",
        "duan_yongping",
        "peter_lynch",
    ]

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        state_manager: FlowStateManager | None = None,
    ) -> None:
        """
        初始化编排器。

        Args:
            api_key: LLM API 密钥。
            api_base: API 基础 URL，默认为 OpenAI 官方端点。
            state_manager: 流程状态管理器，用于持久化中间结果（可选）。
        """
        self.api_key: str = api_key
        self.api_base: str = api_base or "https://api.openai.com/v1"
        self.state_manager: FlowStateManager | None = state_manager
        self.logger: logging.Logger = logging.getLogger(__name__)

    # ------------------------------------------------------------------
    # 公开接口
    # ------------------------------------------------------------------

    async def run_full_flow(
        self,
        materials: list[dict],
        project_type: str,
        api_key: str,
        session_id: str,
        selected_departments: list[str] | None = None,
        selected_masters: list[str] | None = None,
    ) -> AsyncGenerator[dict, None]:
        """
        执行完整的投委会流程，按阶段 yield SSE 事件。

        Args:
            materials: 用户上传的材料列表，每项包含 filename / content 等。
            project_type: 项目类型标识。
            api_key: LLM API 密钥。
            session_id: 当前会话唯一 ID。
            selected_departments: 选中的部门列表，None 或空列表表示全部部门。
            selected_masters: 选中的大师列表，None 或空列表表示全部大师。

        Yields:
            dict: SSE 事件字典，包含 ``type`` 字段标识事件类型。
        """
        self.logger.info(
            "[session=%s] 投委会流程启动 | project_type=%s | materials=%d "
            "| selected_departments=%s | selected_masters=%s",
            session_id,
            project_type,
            len(materials),
            selected_departments,
            selected_masters,
        )

        # 初始化流程元数据
        flow_metadata: dict[str, Any] = {
            "session_id": session_id,
            "project_type": project_type,
            "material_count": len(materials),
            "status": "running",
        }
        if self.state_manager is not None:
            self.state_manager.save_stage_result(
                session_id, "flow_metadata", flow_metadata
            )

        secretary_result: dict | None = None
        department_results: dict[str, dict] = {}
        master_skill_result: dict[str, dict] = {}
        decision_result: dict | None = None

        try:
            # ==============================================================
            # 阶段 1: 秘书Agent — 材料结构化（串行，关键路径，失败即终止）
            # ==============================================================
            yield {
                "type": "stage_start",
                "stage": self.STAGE_SECRETARY,
                "session_id": session_id,
            }

            secretary_result = await self._run_secretary(
                materials, project_type, session_id
            )
            project_name: str = secretary_result.get("project_name", "未命名项目")
            project_slug: str = f"{project_name}_{session_id[:8]}"
            structured_content: str = secretary_result.get("structured_content", "")

            if self.state_manager is not None:
                self.state_manager.ensure_directories(session_id, project_slug)

            yield {
                "type": "stage_complete",
                "stage": self.STAGE_SECRETARY,
                "session_id": session_id,
                "result": secretary_result,
            }

            # ==============================================================
            # 阶段 2: 部门Agent — 投资/资管/市场/运营/财务/设计/工程/成本/法律（并行，容忍单部门失败）
            # ==============================================================
            yield {
                "type": "stage_start",
                "stage": self.STAGE_DEPARTMENTS,
                "session_id": session_id,
            }

            # 使用队列收集部门Agent的实时事件
            dept_event_queue: asyncio.Queue[dict] = asyncio.Queue()

            department_results = await self._run_departments(
                structured_content=structured_content,
                project_type=project_type,
                session_id=session_id,
                event_queue=dept_event_queue,
                selected_departments=selected_departments,
            )

            # 转发队列中收集到的部门事件（department_started / department_complete）
            while not dept_event_queue.empty():
                yield dept_event_queue.get_nowait()

            yield {
                "type": "stage_complete",
                "stage": self.STAGE_DEPARTMENTS,
                "session_id": session_id,
                "result": department_results,
            }

            # ==============================================================
            # 阶段 3: 大师Agent — 4位投资大师可多选并行分析
            # ==============================================================
            master_skill_result = await self._run_master_skill(
                structured_content=structured_content,
                department_results=department_results,
                session_id=session_id,
                selected_masters=selected_masters,
            )

            # 转发大师阶段收集到的所有事件（master_started / master_complete）
            for event in master_skill_result.get("_events", []):
                yield event

            # 清理内部事件标记
            master_results = master_skill_result.get("results", {})

            yield {
                "type": "stage_complete",
                "stage": self.STAGE_MASTER_SKILL,
                "session_id": session_id,
                "result": master_results,
            }

            # ==============================================================
            # 阶段 4: 决策者Agent — 最终投资决策（串行）
            # ==============================================================
            yield {
                "type": "stage_start",
                "stage": self.STAGE_DECISION_MAKER,
                "session_id": session_id,
            }

            decision_result = await self._run_decision_maker(
                structured_content=structured_content,
                department_results=department_results,
                master_skill_output=master_results,
                session_id=session_id,
            )

            yield {
                "type": "stage_complete",
                "stage": self.STAGE_DECISION_MAKER,
                "session_id": session_id,
                "result": decision_result,
            }

            # ==============================================================
            # 流程完成 — 汇总所有结果
            # ==============================================================
            final_report: dict[str, Any] = {
                "session_id": session_id,
                "project_name": project_name,
                "project_type": project_type,
                "project_slug": project_slug,
                "secretary_result": secretary_result,
                "department_results": department_results,
                "master_skill_result": master_results,
                "decision_result": decision_result,
            }

            # 持久化最终结果
            if self.state_manager is not None:
                self.state_manager.save_stage_result(
                    session_id, "analysis", final_report
                )
                flow_metadata["status"] = "completed"
                self.state_manager.save_stage_result(
                    session_id, "flow_metadata", flow_metadata
                )

            yield {
                "type": "flow_complete",
                "session_id": session_id,
                "final_report": final_report,
            }
            self.logger.info("[session=%s] 投委会流程全部完成", session_id)

        except Exception as exc:
            self.logger.exception("[session=%s] 流程执行异常: %s", session_id, exc)

            if self.state_manager is not None:
                flow_metadata["status"] = "error"
                flow_metadata["error"] = str(exc)
                self.state_manager.save_stage_result(
                    session_id, "flow_metadata", flow_metadata
                )

            yield {
                "type": "error",
                "stage": "orchestrator",
                "error": str(exc),
                "session_id": session_id,
            }

    # ------------------------------------------------------------------
    # 私有阶段方法
    # ------------------------------------------------------------------

    async def _run_secretary(
        self,
        materials: list[dict],
        project_type: str,
        session_id: str,
    ) -> dict:
        """
        执行秘书Agent阶段 — 材料结构化。

        这是关键路径阶段，若失败将导致整个流程终止。
        秘书Agent会结合项目类型信息提取相关字段。

        Args:
            materials: 原始材料列表。
            project_type: 项目类型标识，逗号分隔（如 "office_building,hotel"）。
            session_id: 会话 ID。

        Returns:
            dict: 秘书Agent结构化结果，包含 project_name / structured_content 等。

        Raises:
            Exception: 秘书Agent处理失败时抛出。
        """
        self.logger.info(
            "[session=%s] SecretaryAgent 开始处理材料 | project_type=%s",
            session_id,
            project_type,
        )

        agent = SecretaryAgent(api_key=self.api_key, api_base=self.api_base)
        result: dict = await agent.process_materials(materials, project_type)

        if self.state_manager is not None:
            self.state_manager.save_stage_result(
                session_id, self.STAGE_SECRETARY, result
            )
            self.state_manager.mark_stage_complete(session_id, self.STAGE_SECRETARY)

        self.logger.info("[session=%s] SecretaryAgent 完成", session_id)
        return result

    async def _run_departments(
        self,
        structured_content: str,
        project_type: str,
        session_id: str,
        event_queue: asyncio.Queue[dict],
        selected_departments: list[str] | None = None,
    ) -> dict[str, dict]:
        """
        并行执行九个部门Agent — 投资部/资管部/市场部/运营部/财务部/设计部/工程部/成本部/法律部。

        使用 ``asyncio.gather`` 并发启动所有部门。单个部门失败时
        记录错误但继续其他部门。通过 ``event_queue`` 实时推送
        ``department_started`` 和 ``department_complete`` 事件。
        每个部门Agent都会接收到项目类型信息以进行针对性分析。

        Args:
            structured_content: 秘书Agent输出的结构化材料。
            project_type: 项目类型标识，逗号分隔。
            session_id: 会话 ID。
            event_queue: 异步事件队列，用于推送部门级别事件。
            selected_departments: 选中的部门列表，None 或空列表表示全部部门。

        Returns:
            dict[str, dict]: 部门名称 -> 分析结果 的映射。
                失败的部门结果中包含 ``error`` 和 ``status: "failed"`` 字段。
        """
        self.logger.info(
            "[session=%s] 部门Agent阶段开始 | project_type=%s | selected_departments=%s",
            session_id,
            project_type,
            selected_departments,
        )

        all_agents: dict[str, Any] = {
            "investment": InvestmentAgent(api_key=self.api_key, api_base=self.api_base),
            "asset_management": AssetManagementAgent(api_key=self.api_key, api_base=self.api_base),
            "market": MarketAnalystAgent(api_key=self.api_key, api_base=self.api_base),
            "operation": OperationAgent(api_key=self.api_key, api_base=self.api_base),
            "financial": FinancialModelerAgent(api_key=self.api_key, api_base=self.api_base),
            "design": DesignAgent(api_key=self.api_key, api_base=self.api_base),
            "engineering": EngineeringAgent(api_key=self.api_key, api_base=self.api_base),
            "cost": CostAgent(api_key=self.api_key, api_base=self.api_base),
            "legal": LegalAgent(api_key=self.api_key, api_base=self.api_base),
        }

        # 如果指定了 selected_departments，只运行选中的部门
        if selected_departments:
            agents = {name: agent for name, agent in all_agents.items() if name in selected_departments}
        else:
            agents = all_agents

        async def _run_single_department(name: str, agent: Any) -> tuple[str, dict]:
            """
            包装单个部门执行，在起止时向 event_queue 推送事件。

            Args:
                name: 部门名称。
                agent: 部门Agent实例。

            Returns:
                tuple[str, dict]: (部门名称, 分析结果)。

            Raises:
                Exception: 部门Agent执行失败时重新抛出。
            """
            await event_queue.put({
                "type": "department_started",
                "department": name,
                "session_id": session_id,
            })
            try:
                result: dict = await agent.analyze(
                    structured_content, project_type
                )
                await event_queue.put({
                    "type": "department_complete",
                    "department": name,
                    "session_id": session_id,
                    "result": result,
                })
                return name, result
            except Exception as exc:
                error_result = {
                    "department": name,
                    "error": str(exc),
                    "status": "failed",
                }
                await event_queue.put({
                    "type": "department_complete",
                    "department": name,
                    "session_id": session_id,
                    "result": error_result,
                })
                raise

        # 并发启动所有部门任务
        coroutines = [
            _run_single_department(name, agent)
            for name, agent in agents.items()
        ]

        # 使用 gather + return_exceptions=True 容忍单个失败
        gather_results: list[tuple[str, dict] | BaseException] = await asyncio.gather(
            *coroutines, return_exceptions=True
        )

        # 收集结果
        completed_results: dict[str, dict] = {}
        dept_names = list(agents.keys())

        for idx, res in enumerate(gather_results):
            dept_name = dept_names[idx]
            if isinstance(res, BaseException):
                self.logger.error(
                    "[session=%s] 部门Agent异常: %s - %s",
                    session_id,
                    dept_name,
                    res,
                )
                completed_results[dept_name] = {
                    "department": dept_name,
                    "error": str(res),
                    "status": "failed",
                }
            else:
                name, result = res
                completed_results[name] = result

        # 保存阶段结果到状态管理器
        if self.state_manager is not None:
            self.state_manager.save_stage_result(
                session_id, self.STAGE_DEPARTMENTS, completed_results
            )
            self.state_manager.mark_stage_complete(session_id, self.STAGE_DEPARTMENTS)

        self.logger.info(
            "[session=%s] 部门Agent阶段完成 | 结果=%s",
            session_id,
            {k: ("ok" if "error" not in v else "failed") for k, v in completed_results.items()},
        )
        return completed_results

    async def _run_master_skill(
        self,
        structured_content: str,
        department_results: dict[str, dict],
        session_id: str,
        selected_masters: list[str] | None = None,
    ) -> dict:
        """
        执行大师Agent阶段 — 4位投资大师可多选并行分析。

        使用 ``asyncio.gather`` 并发启动所有选中的大师Agent。
        收集 ``master_started`` 和 ``master_complete`` 事件，
        连同大师结果一起返回。不传递 selected_masters 则执行全部4位大师。

        Args:
            structured_content: 结构化材料内容。
            department_results: 所有部门分析结果。
            session_id: 会话 ID。
            selected_masters: 选中的大师列表，None 或空列表表示全部大师。

        Returns:
            dict: 包含以下键：
                - results: {master_id: result} 的大师分析结果字典
                - _events: 收集到的 SSE 事件列表（master_started / master_complete）
        """
        self.logger.info(
            "[session=%s] 大师Agent阶段开始 | selected_masters=%s",
            session_id,
            selected_masters,
        )

        # 从注册表实例化所有大师Agent（32位）
        all_masters: dict[str, Any] = {
            mid: cls(api_key=self.api_key, api_base=self.api_base)
            for mid, cls in MASTER_REGISTRY.items()
        }

        # 根据 selected_masters 筛选
        if selected_masters:
            masters = {
                k: v for k, v in all_masters.items()
                if k in selected_masters
            }
        else:
            masters = all_masters

        if not masters:
            self.logger.warning(
                "[session=%s] 没有选中任何大师，默认使用全部大师",
                session_id,
            )
            masters = all_masters

        # 收集事件的列表
        events: list[dict] = []

        async def _run_single_master(
            master_id: str, master_agent: Any
        ) -> tuple[str, dict]:
            """
            包装单个大师执行，收集 master_started 和 master_complete 事件。

            Args:
                master_id: 大师标识。
                master_agent: 大师Agent实例。

            Returns:
                tuple[str, dict]: (master_id, 分析结果)。

            Raises:
                Exception: 大师Agent执行失败时重新抛出。
            """
            events.append({
                "type": "master_started",
                "master": master_id,
                "master_name": master_agent.master_name,
                "session_id": session_id,
            })
            try:
                result: dict = await master_agent.analyze(
                    structured_content, department_results
                )
                events.append({
                    "type": "master_complete",
                    "master": master_id,
                    "master_name": master_agent.master_name,
                    "session_id": session_id,
                    "result": result,
                })
                return master_id, result
            except Exception as exc:
                error_result = {
                    "master_id": master_id,
                    "master_name": master_agent.master_name,
                    "error": str(exc),
                    "status": "failed",
                    "verdict": "改",
                    "score": 50,
                    "confidence": "low",
                    "key_insights": [],
                    "critical_questions": [f"分析失败: {exc}"],
                    "reasoning": f"大师分析过程中发生错误: {exc}",
                }
                events.append({
                    "type": "master_complete",
                    "master": master_id,
                    "master_name": master_agent.master_name,
                    "session_id": session_id,
                    "result": error_result,
                })
                raise

        # 并发启动所有选中的大师任务
        coroutines = [
            _run_single_master(mid, agent)
            for mid, agent in masters.items()
        ]

        gather_results: list[tuple[str, dict] | BaseException] = await asyncio.gather(
            *coroutines, return_exceptions=True
        )

        # 收集大师结果
        master_results: dict[str, dict] = {}
        master_ids = list(masters.keys())

        for idx, res in enumerate(gather_results):
            mid = master_ids[idx]
            if isinstance(res, BaseException):
                self.logger.error(
                    "[session=%s] 大师Agent异常: %s - %s",
                    session_id,
                    mid,
                    res,
                )
                master_agent = masters[mid]
                master_results[mid] = {
                    "master_id": mid,
                    "master_name": master_agent.master_name,
                    "error": str(res),
                    "status": "failed",
                    "verdict": "改",
                    "score": 50,
                    "confidence": "low",
                    "key_insights": [],
                    "critical_questions": [f"分析失败: {res}"],
                    "reasoning": f"大师分析过程中发生错误: {res}",
                }
            else:
                mid, result = res
                master_results[mid] = result

        # 保存阶段结果到状态管理器
        if self.state_manager is not None:
            self.state_manager.save_stage_result(
                session_id, self.STAGE_MASTER_SKILL, master_results
            )
            self.state_manager.mark_stage_complete(session_id, self.STAGE_MASTER_SKILL)

        self.logger.info(
            "[session=%s] 大师Agent阶段完成 | masters=%s",
            session_id,
            {k: ("ok" if "error" not in v else "failed") for k, v in master_results.items()},
        )

        return {
            "results": master_results,
            "_events": events,
        }

    async def _run_decision_maker(
        self,
        structured_content: str,
        department_results: dict[str, dict],
        master_skill_output: dict[str, dict],
        session_id: str,
    ) -> dict:
        """
        执行决策者Agent阶段 — 最终投资决策。

        Args:
            structured_content: 结构化材料内容。
            department_results: 部门分析结果。
            master_skill_output: 多大师分析结果，{master_id: result} 格式。
            session_id: 会话 ID。

        Returns:
            dict: 最终投资决策结果。
        """
        self.logger.info("[session=%s] DecisionMakerAgent 开始决策", session_id)

        agent = DecisionMakerAgent(api_key=self.api_key, api_base=self.api_base)
        result: dict = await agent.decide(
            structured_content, department_results, master_skill_output
        )

        if self.state_manager is not None:
            self.state_manager.save_stage_result(
                session_id, self.STAGE_DECISION_MAKER, result
            )
            self.state_manager.mark_stage_complete(
                session_id, self.STAGE_DECISION_MAKER
            )

        self.logger.info("[session=%s] DecisionMakerAgent 完成", session_id)
        return result
