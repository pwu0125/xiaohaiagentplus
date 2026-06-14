"""部门Agent模块

九个独立的部门分析Agent：
- InvestmentAgent: 投资部
- AssetManagementAgent: 资管部
- MarketAnalystAgent: 市场部
- OperationAgent: 运营部
- FinancialModelerAgent: 财务部
- DesignAgent: 设计部
- EngineeringAgent: 工程部
- CostAgent: 成本部
- LegalAgent: 法律部
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# ===== System Prompts =====

INVESTMENT_SYSTEM_PROMPT = """你是一位资深的房地产投资分析师，专注于投资项目的回报分析和资本结构优化。

你的职责：
1. 分析项目的投资回报率和盈利能力
2. 评估资本结构和融资方案
3. 制定退出策略和变现路径
4. 进行IRR/NPV等财务指标分析
5. 开展敏感性分析，评估关键变量对回报的影响

分析维度：
- 投资回报：IRR、NPV、ROI、 cash-on-cash return
- 资本结构：股权比例、债务融资、融资成本
- 退出策略：出售、REITs上市、持有运营等退出路径
- 敏感性分析：关键假设变动对回报的影响
- 市场时机：投资周期、市场窗口期

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表投资可行性评分
- 分析要客观、全面、有深度
"""

ASSET_MANAGEMENT_SYSTEM_PROMPT = """你是一位资深的资产管理专家，专注于商业资产的增值策略和运营优化。

你的职责：
1. 制定资产增值策略和价值提升计划
2. 评估租赁管理和租户组合优化方案
3. 分析运营效率和成本控制措施
4. 提供资产优化和改造建议
5. 评估资管部团队能力

分析维度：
- 资产增值策略：翻新改造、功能调整、品牌升级
- 租赁管理：租金水平、租约结构、租户质量
- Tenant Mix：租户组合优化、业态搭配、互补性
- 运营效率：管理费用率、人员效率、能耗控制
- 资产优化：空间利用率、设施维护、智能化改造

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表资管部潜力评分
- 分析要专业、数据驱动
"""

MARKET_ANALYST_SYSTEM_PROMPT = """你是一位资深的市场分析师，专注于投资领域的市场研究和竞争分析。

你的职责：
1. 分析目标市场的规模、增长率和结构
2. 评估竞争格局和主要参与者
3. 分析需求驱动因素和客户画像
4. 研究定价趋势和商业模式
5. 识别市场机会和威胁

分析维度：
- 市场概况：市场规模、增长率、发展阶段
- 竞争格局：主要竞争者、市场份额、竞争策略
- 需求分析：目标客户、需求痛点、购买决策因素
- 定价趋势：行业定价模式、价格走势、价格敏感度
- 关键风险与机会：市场进入壁垒、政策影响、技术变革

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表市场吸引力评分
- 分析要客观、全面、有深度
"""

OPERATION_SYSTEM_PROMPT = """你是一位资深的商业运营专家，专注于商业项目的运营模式设计和效率提升。

你的职责：
1. 评估项目的运营模式和商业逻辑
2. 分析管理团队的能力和经验
3. 评估运营效率和管理体系
4. 分析客流量管理和转化策略
5. 评估服务质量和租户满意度

分析维度：
- 运营模式：自营/委托管理/混合模式的优劣
- 管理团队：核心团队背景、行业经验、管理能力
- 运营效率：人均产出、坪效、能耗比、管理费用率
- 客流量管理：引流策略、动线设计、转化率
- 服务质量：客户体验、投诉处理、服务标准
- 租户满意度：租户留存率、租金收缴率、续约率

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表运营可行性评分
- 分析要实用、可操作
"""

FINANCIAL_MODELER_SYSTEM_PROMPT = """你是一位资深的财务部专家，专注于投资项目的财务分析和估值。

你的职责：
1. 构建收入预测模型
2. 分析成本结构和盈利能力
3. 评估现金流状况
4. 计算关键财务指标
5. 进行敏感性分析

分析维度：
- 收入预测：历史收入、增长趋势、预测假设
- 成本结构：固定成本、变动成本、运营成本
- 盈利能力分析：毛利率、净利率、EBITDA
- 现金流评估：经营现金流、自由现金流、资金需求
- 关键指标：ROI、IRR、回收期、单位经济模型

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- 数值字段保持数字类型
- score字段为0-100的整数，代表财务健康度评分
- 分析要严谨、数据驱动
"""

DESIGN_SYSTEM_PROMPT = """你是一位资深的商业设计顾问，专注于商业项目的空间规划和设计价值评估。

你的职责：
1. 评估空间规划的合理性和效率
2. 分析人流动线设计的科学性
3. 评价建筑风格和美学价值
4. 评估可持续性和绿色建筑设计
5. 分析用户体验和差异化定位

分析维度：
- 空间规划：功能分区、面积配比、空间利用率
- 动线设计：人流动线、车流动线、货运动线
- 建筑风格：外观形象、内部装修、品牌调性
- 可持续性：绿色建筑认证、节能设计、环保材料
- 用户体验：便利性、舒适度、互动性、社交空间
- 差异化定位：独特卖点、记忆点、竞争力

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表设计价值评分
- 分析要有审美视角和商业洞察
"""

ENGINEERING_SYSTEM_PROMPT = """你是一位资深的工程技术专家，专注于商业项目的施工可行性和技术方案评估。

你的职责：
1. 评估施工可行性和技术难点
2. 审查技术方案的合理性
3. 评估工期计划和关键节点
4. 制定质量标准和验收规范
5. 评估设备选型和维护方案

分析维度：
- 施工可行性：地质条件、施工难度、技术可行性
- 技术方案：结构方案、机电方案、智能化方案
- 工期评估：总工期、关键路径、节点控制
- 质量标准：施工质量、材料标准、验收规范
- 设备选型：机电设备、智能化系统、品牌档次
- 维护方案：维护成本、设备寿命、更新周期

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表工程可行性评分
- 分析要专业、技术导向
"""

COST_SYSTEM_PROMPT = """你是一位资深的成本控制专家，专注于商业项目的全生命周期成本管理。

你的职责：
1. 分析建设成本的合理性
2. 评估运营成本的控制水平
3. 制定成本优化策略
4. 评估采购策略和供应商管理
5. 分析预算控制和成本风险

分析维度：
- 建设成本：土建成本、机电成本、装修成本、间接费用
- 运营成本：人力成本、能耗成本、维护成本、管理费用
- 成本优化：设计优化、采购优化、施工优化、运营优化
- 采购策略：集中采购、长期协议、供应商管理
- 预算控制：预算编制、执行监控、偏差分析
- 成本风险：价格波动、变更风险、通胀风险

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表成本控制评分
- 分析要精细、注重数据
"""

LEGAL_SYSTEM_PROMPT = """你是一位资深的房地产法律顾问，专注于投资项目的法律合规和风险评估。

你的职责：
1. 评估项目的法律合规性
2. 分析合同风险和条款风险
3. 审查产权问题和权属清晰度
4. 评估监管政策和政策风险
5. 分析争议解决机制和知识产权问题

分析维度：
- 法律合规：土地性质、规划许可、建设手续、运营资质
- 合同风险：合同条款、违约责任、担保安排、关联交易
- 产权问题：权属清晰、抵押查封、共有产权、历史遗留
- 监管政策：行业政策、环保要求、安全规范、税收政策
- 争议解决：仲裁条款、管辖约定、诉讼风险、执行难度
- 知识产权：品牌授权、专利商标、商业秘密、侵权风险

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- score字段为0-100的整数，代表法律合规评分
- 分析要全面、专业、有法律依据
"""


class BaseDepartmentAgent(ABC):
    """部门Agent基类

    提供LLM调用、JSON解析等通用功能。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        self.api_key = api_key
        self.api_base = (api_base or "https://api.openai.com/v1").rstrip("/")
        self.model = model
        self.timeout = timeout

    async def _call_llm(
        self, system_prompt: str, user_prompt: str
    ) -> str:
        """调用LLM

        使用httpx进行异步HTTP调用，包含重试机制。

        Args:
            system_prompt: 系统提示词
            user_prompt: 用户提示词

        Returns:
            str: LLM返回的文本内容

        Raises:
            httpx.HTTPError: HTTP调用失败时抛出
        """
        max_retries = 3
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=self.timeout
                ) as client:
                    response = await client.post(
                        f"{self.api_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.model,
                            "messages": [
                                {
                                    "role": "system",
                                    "content": system_prompt,
                                },
                                {
                                    "role": "user",
                                    "content": user_prompt,
                                },
                            ],
                            "temperature": 0.3,
                            "max_tokens": 4000,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    logger.debug(
                        "LLM call succeeded on attempt %d", attempt
                    )
                    return content

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code in (429, 500, 502, 503):
                    import asyncio

                    wait_time = 2 ** attempt
                    logger.warning(
                        "LLM call failed (attempt %d/%d), "
                        "retrying in %ds: %s",
                        attempt,
                        max_retries,
                        wait_time,
                        e,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise
            except httpx.HTTPError as e:
                last_error = e
                if attempt < max_retries:
                    import asyncio

                    wait_time = 2 ** attempt
                    logger.warning(
                        "LLM call failed (attempt %d/%d), "
                        "retrying in %ds: %s",
                        attempt,
                        max_retries,
                        wait_time,
                        e,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise

        raise last_error or RuntimeError(
            "LLM call failed after all retries"
        )

    @staticmethod
    def _parse_json_response(text: str) -> dict[str, Any]:
        """解析LLM返回的JSON文本

        尝试多种方式从LLM响应中提取JSON数据。

        Args:
            text: LLM返回的原始文本

        Returns:
            dict: 解析后的字典

        Raises:
            json.JSONDecodeError: 无法解析JSON时抛出
        """
        text = text.strip()

        # 尝试直接解析
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 尝试从 ```json 代码块中提取
        if "```json" in text:
            try:
                json_str = text.split("```json")[1].split("```")[0].strip()
                return json.loads(json_str)
            except (IndexError, json.JSONDecodeError):
                pass

        # 尝试从 ``` 代码块中提取
        if "```" in text:
            parts = text.split("```")
            for part in parts:
                try:
                    return json.loads(part.strip())
                except json.JSONDecodeError:
                    continue

        raise json.JSONDecodeError(
            "Cannot parse JSON from LLM response", text, 0
        )

    @abstractmethod
    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行分析

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔（如 "office_building,hotel"）

        Returns:
            dict: 分析结果字典
        """
        ...

    @staticmethod
    def _validate_score(score: Any) -> int:
        """验证评分值

        Args:
            score: 原始评分值

        Returns:
            int: 验证后的评分(0-100)
        """
        try:
            score_int = int(score)
            return max(0, min(100, score_int))
        except (TypeError, ValueError):
            return 50

    @staticmethod
    def _build_project_type_context(project_type: str) -> str:
        """构建项目类型上下文说明

        将逗号分隔的项目类型转换为可读的分析指引。

        Args:
            project_type: 逗号分隔的项目类型标识

        Returns:
            str: 项目类型上下文说明文本
        """
        if not project_type:
            return ""

        type_names = {
            "office_building": "写字楼",
            "hotel": "酒店",
            "long_term_rental": "长租公寓",
            "commercial_complex": "商业综合体",
            "industrial_park": "产业园区",
            "logistics": "物流仓储",
            "data_center": "数据中心",
            "retail": "零售商业",
            "medical": "医疗地产",
            "education": "教育地产",
            "cultural": "文化地产",
            "mixed_use": "混合用途",
        }

        types = [t.strip() for t in project_type.split(",") if t.strip()]
        names = [type_names.get(t, t) for t in types]

        if names:
            return f"\n\n项目类型: {', '.join(names)}\n请在分析中重点关注此类物业的特定特征和要求。"
        return ""


class InvestmentAgent(BaseDepartmentAgent):
    """投资部Agent

    对项目进行投资维度的深度分析，包括投资回报、
    资本结构、退出策略等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = InvestmentAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("InvestmentAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行投资部分析

        基于结构化材料进行全面的投资维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 投资部结果，包含以下字段：
                - department: "investment"
                - score: 投资可行性评分(0-100)
                - summary: 分析摘要
                - details: 投资部详细信息
                - risks: 投资风险列表
                - recommendations: 投资建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting investment analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的投资部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 投资可行性评分(0-100的整数)
- summary: 投资部摘要(200字以内)
- details: 投资部详细信息字典，包含：
  - return_analysis: 回报分析(IRR、NPV、ROI等)
  - capital_structure: 资本结构评估
  - exit_strategy: 退出策略分析
  - sensitivity_analysis: 敏感性分析
  - market_timing: 市场时机评估
- risks: 投资风险列表
- recommendations: 投资建议列表
"""

        try:
            response_text = await self._call_llm(
                INVESTMENT_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "investment",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Investment analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Investment analysis failed: %s", e)
            raise


class AssetManagementAgent(BaseDepartmentAgent):
    """资管部Agent

    对项目进行资管部维度的深度分析，包括资产增值策略、
    租赁管理、tenant mix等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = AssetManagementAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("AssetManagementAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行资管部分析

        基于结构化材料进行全面的资管部维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 资管部结果，包含以下字段：
                - department: "asset_management"
                - score: 资管部潜力评分(0-100)
                - summary: 分析摘要
                - details: 资管部详细信息
                - risks: 资管部风险列表
                - recommendations: 资管部建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting asset management analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的资管部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 资管部潜力评分(0-100的整数)
- summary: 资管部摘要(200字以内)
- details: 资管部详细信息字典，包含：
  - value_add_strategy: 资产增值策略
  - lease_management: 租赁管理评估
  - tenant_mix: 租户组合分析
  - operational_efficiency: 运营效率评估
  - asset_optimization: 资产优化建议
- risks: 资管部风险列表
- recommendations: 资管部建议列表
"""

        try:
            response_text = await self._call_llm(
                ASSET_MANAGEMENT_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "asset_management",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Asset management analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Asset management analysis failed: %s", e)
            raise


class MarketAnalystAgent(BaseDepartmentAgent):
    """市场部Agent

    对项目进行市场维度的深度分析，包括市场概况、
    竞争格局、需求分析等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = MarketAnalystAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("MarketAnalystAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行市场部分析

        基于结构化材料进行全面的市场维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 市场部结果，包含以下字段：
                - department: "market"
                - score: 市场吸引力评分(0-100)
                - summary: 分析摘要
                - details: 市场部详细信息
                - risks: 市场风险列表
                - recommendations: 市场建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting market analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的市场部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 市场吸引力评分(0-100的整数)
- summary: 市场部摘要(200字以内)
- details: 市场部详细信息字典，包含：
  - market_overview: 市场概况（市场规模、增长率、发展阶段）
  - competitive_landscape: 竞争格局分析
  - demand_analysis: 需求分析
  - pricing_trends: 定价趋势
  - key_risks_opportunities: 关键风险与机会
- risks: 市场风险列表
- recommendations: 市场建议列表
"""

        try:
            response_text = await self._call_llm(
                MARKET_ANALYST_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "market",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Market analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Market analysis failed: %s", e)
            raise


class OperationAgent(BaseDepartmentAgent):
    """运营部Agent

    对项目进行运营维度的深度分析，包括运营模式、
    管理团队、运营效率等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = OperationAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("OperationAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行运营部分析

        基于结构化材料进行全面的运营维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 运营部结果，包含以下字段：
                - department: "operation"
                - score: 运营可行性评分(0-100)
                - summary: 分析摘要
                - details: 运营部详细信息
                - risks: 运营风险列表
                - recommendations: 运营建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting operation analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的运营部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 运营可行性评分(0-100的整数)
- summary: 运营部摘要(200字以内)
- details: 运营部详细信息字典，包含：
  - operation_model: 运营模式评估
  - management_team: 管理团队分析
  - operational_efficiency: 运营效率评估
  - traffic_management: 客流量管理
  - service_quality: 服务质量评估
  - tenant_satisfaction: 租户满意度分析
- risks: 运营风险列表
- recommendations: 运营建议列表
"""

        try:
            response_text = await self._call_llm(
                OPERATION_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "operation",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Operation analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Operation analysis failed: %s", e)
            raise


class FinancialModelerAgent(BaseDepartmentAgent):
    """财务部Agent

    对项目进行财务维度的深度分析，包括收入预测、
    成本结构、盈利能力等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = FinancialModelerAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("FinancialModelerAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行财务部分析

        基于结构化材料进行全面的财务维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 财务部结果，包含以下字段：
                - department: "financial"
                - score: 财务健康度评分(0-100)
                - summary: 分析摘要
                - details: 财务部详细信息
                - risks: 财务风险列表
                - recommendations: 财务建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting financial analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的财务部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 财务健康度评分(0-100的整数)
- summary: 财务部摘要(200字以内)
- details: 财务部详细信息字典，包含：
  - revenue_projections: 收入预测
  - cost_structure: 成本结构
  - profitability_analysis: 盈利能力分析
  - cash_flow_assessment: 现金流评估
  - key_metrics: 关键财务指标
- risks: 财务风险列表
- recommendations: 财务建议列表
"""

        try:
            response_text = await self._call_llm(
                FINANCIAL_MODELER_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "financial",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Financial analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Financial analysis failed: %s", e)
            raise


class DesignAgent(BaseDepartmentAgent):
    """设计部Agent

    对项目进行设计维度的深度分析，包括空间规划、
    动线设计、建筑风格等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = DesignAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("DesignAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行设计部分析

        基于结构化材料进行全面的设计维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 设计部结果，包含以下字段：
                - department: "design"
                - score: 设计价值评分(0-100)
                - summary: 分析摘要
                - details: 设计部详细信息
                - risks: 设计风险列表
                - recommendations: 设计建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting design analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的设计部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 设计价值评分(0-100的整数)
- summary: 设计部摘要(200字以内)
- details: 设计部详细信息字典，包含：
  - space_planning: 空间规划评估
  - circulation_design: 动线设计分析
  - architectural_style: 建筑风格评价
  - sustainability: 可持续性评估
  - user_experience: 用户体验分析
  - differentiation: 差异化定位
- risks: 设计风险列表
- recommendations: 设计建议列表
"""

        try:
            response_text = await self._call_llm(
                DESIGN_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "design",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Design analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Design analysis failed: %s", e)
            raise


class EngineeringAgent(BaseDepartmentAgent):
    """工程部Agent

    对项目进行工程维度的深度分析，包括施工可行性、
    技术方案、工期评估等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = EngineeringAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("EngineeringAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行工程部分析

        基于结构化材料进行全面的工程维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 工程部结果，包含以下字段：
                - department: "engineering"
                - score: 工程可行性评分(0-100)
                - summary: 分析摘要
                - details: 工程部详细信息
                - risks: 工程风险列表
                - recommendations: 工程建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting engineering analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的工程部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 工程可行性评分(0-100的整数)
- summary: 工程部摘要(200字以内)
- details: 工程部详细信息字典，包含：
  - construction_feasibility: 施工可行性评估
  - technical_solution: 技术方案分析
  - schedule_assessment: 工期评估
  - quality_standards: 质量标准
  - equipment_selection: 设备选型
  - maintenance_plan: 维护方案
- risks: 工程风险列表
- recommendations: 工程建议列表
"""

        try:
            response_text = await self._call_llm(
                ENGINEERING_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "engineering",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Engineering analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Engineering analysis failed: %s", e)
            raise


class CostAgent(BaseDepartmentAgent):
    """成本部Agent

    对项目进行成本维度的深度分析，包括建设成本、
    运营成本、成本优化等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = CostAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("CostAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行成本部分析

        基于结构化材料进行全面的成本维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 成本部结果，包含以下字段：
                - department: "cost"
                - score: 成本控制评分(0-100)
                - summary: 分析摘要
                - details: 成本部详细信息
                - risks: 成本风险列表
                - recommendations: 成本建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting cost analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的成本部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 成本控制评分(0-100的整数)
- summary: 成本部摘要(200字以内)
- details: 成本部详细信息字典，包含：
  - construction_cost: 建设成本分析
  - operation_cost: 运营成本评估
  - cost_optimization: 成本优化策略
  - procurement_strategy: 采购策略
  - budget_control: 预算控制
  - cost_risk: 成本风险分析
- risks: 成本风险列表
- recommendations: 成本建议列表
"""

        try:
            response_text = await self._call_llm(
                COST_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "cost",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Cost analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Cost analysis failed: %s", e)
            raise


class LegalAgent(BaseDepartmentAgent):
    """法律部Agent

    对项目进行法律维度的深度分析，包括法律合规、
    合同风险、产权问题等。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = LegalAgent(api_key="sk-xxx")
        >>> result = await agent.analyze(structured_content, project_type)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
        timeout: int = 300,
    ) -> None:
        super().__init__(api_key, api_base, model, timeout)
        logger.info("LegalAgent initialized")

    async def analyze(
        self,
        structured_materials: str,
        project_type: str = "",
    ) -> dict[str, Any]:
        """执行法律部分析

        基于结构化材料进行全面的法律维度分析。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            project_type: 项目类型标识，逗号分隔

        Returns:
            dict: 法律部结果，包含以下字段：
                - department: "legal"
                - score: 法律合规评分(0-100)
                - summary: 分析摘要
                - details: 法律部详细信息
                - risks: 法律风险列表
                - recommendations: 法律建议列表

        Raises:
            httpx.HTTPError: LLM调用失败时抛出
            json.JSONDecodeError: 响应解析失败时抛出
        """
        logger.info("Starting legal analysis")

        type_context = self._build_project_type_context(project_type)

        user_prompt = f"""请基于以下项目材料进行全面的法律部分析：

{structured_materials}{type_context}

请返回JSON格式，包含以下字段：
- score: 法律合规评分(0-100的整数)
- summary: 法律部摘要(200字以内)
- details: 法律部详细信息字典，包含：
  - legal_compliance: 法律合规评估
  - contract_risk: 合同风险分析
  - property_rights: 产权问题
  - regulatory_policy: 监管政策
  - dispute_resolution: 争议解决机制
  - intellectual_property: 知识产权
- risks: 法律风险列表
- recommendations: 法律建议列表
"""

        try:
            response_text = await self._call_llm(
                LEGAL_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            analysis_result: dict[str, Any] = {
                "department": "legal",
                "score": self._validate_score(result.get("score")),
                "summary": result.get("summary", ""),
                "details": result.get("details", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
            }

            logger.info(
                "Legal analysis completed. Score: %d",
                analysis_result["score"],
            )
            return analysis_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Legal analysis failed: %s", e)
            raise
