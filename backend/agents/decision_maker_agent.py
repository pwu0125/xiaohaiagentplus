"""决策者Agent模块

汇总所有分析输入，形成最终投资决策，
输出包括结论、评级、评分和综合评估。
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 决策者Agent的系统提示词
DECISION_MAKER_SYSTEM_PROMPT = """你是一位资深的投资决策委员会主席，拥有丰富的投资经验和决策能力。

你的职责：
1. 综合所有部门分析和各位投资大师的意见，形成最终投资决策
2. 给出明确的投资结论：投(投资)/改(修改方案后考虑)/退(放弃)
3. 进行项目评级：A(优秀)/B+(良好)/B(一般)/C(较差)
4. 提供综合评分和详细理由
5. 列出关键风险和建议

决策原则：
- 评分权重：投资部12%、资管部10%、市场部12%、运营部10%、财务部12%、设计部10%、工程部10%、成本部12%、法律部12%
- 大师意见作为重要参考但非决定性因素，需结合部门评分综合判断
- 结论"投"要求综合评分>=75且无明显致命风险，且多数大师支持
- 结论"改"要求项目有潜力但存在可解决的问题，或大师意见分歧较大
- 结论"退"适用于评分<60或存在致命风险，或多数大师反对
- 评级A要求评分>=85，B+要求>=75，B要求>=65，C为<65

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- 结论必须明确，不能模糊
- 理由要充分、有理有据
- 风险评估要全面
- 需说明大师意见分歧点和共识点
"""


class DecisionMakerAgent:
    """决策者Agent

    汇总秘书Agent的结构化材料、所有部门Agent的结果
    以及大师Agent的洞察，形成最终投资决策。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL
        model: 使用的模型名称
        timeout: LLM调用超时时间(秒)

    Example:
        >>> agent = DecisionMakerAgent(api_key="sk-xxx")
        >>> dept_results = {"market": {...}, "financial": {...}, "risk": {...}}
        >>> master_output = {"key_insights": [...], ...}
        >>> result = await agent.decide(content, dept_results, master_output)
    """

    # 评分权重配置（9个部门，总和100%）
    SCORE_WEIGHTS: dict[str, float] = {
        "investment": 0.12,
        "asset_management": 0.10,
        "market": 0.12,
        "operation": 0.10,
        "financial": 0.12,
        "design": 0.10,
        "engineering": 0.10,
        "cost": 0.12,
        "legal": 0.12,
    }

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
        logger.info("DecisionMakerAgent initialized")

    async def decide(
        self,
        structured_materials: str,
        department_results: dict[str, dict[str, Any]],
        master_skill_output: dict[str, dict[str, Any]],
    ) -> dict[str, Any]:
        """形成最终投资决策

        综合所有前期分析结果，形成最终的投资决策结论。

        Args:
            structured_materials: 秘书Agent生成的结构化材料文本
            department_results: 部门Agent结果字典，包含market/financial/risk等
            master_skill_output: 多大师分析结果，{master_id: result} 格式

        Returns:
            dict: 最终投资决策，包含以下字段：
                - typed_conclusion: 投资结论(投/改/退)
                - rating: 项目评级(A/B+/B/C)
                - score: 综合评分(0-100)
                - summary: 决策摘要
                - key_metrics: 关键指标
                - risks: 主要风险列表
                - recommendations: 建议列表
                - project_type_config: 项目类型配置
                - report_header: 报告标题
                - department_scores: 各部门评分
                - final_assessment: 最终评估
                - master_opinions: 各位大师意见汇总

        Raises:
            ValueError: 输入参数无效时抛出
            httpx.HTTPError: LLM调用失败时抛出
        """
        if not structured_materials:
            raise ValueError("structured_materials cannot be empty")

        logger.info(
            "Starting final decision making with %d master opinions",
            len(master_skill_output),
        )

        # 计算加权综合评分
        weighted_score, dept_scores = self._calculate_weighted_score(
            department_results
        )

        # 构建部门分析摘要
        dept_summary = self._build_department_summary(department_results)

        # 构建大师洞察摘要（支持多大师）
        master_summary = self._build_master_summary(master_skill_output)

        # 构建大师共识
        master_consensus = self._build_master_consensus(master_skill_output)

        user_prompt = f"""请作为投资决策委员会主席，基于以下所有分析结果，形成最终投资决策。

## 项目材料

{structured_materials}

## 各部门分析

{dept_summary}

## 各位投资大师的意见

{master_summary}

{master_consensus}

## 计算评分

- 各部门评分: {dept_scores}
- 加权综合评分: {weighted_score:.1f}/100

评分权重说明:
- 投资部评分权重12%
- 资管部评分权重10%
- 市场部评分权重12%
- 运营部评分权重10%
- 财务部评分权重12%
- 设计部评分权重10%
- 工程部评分权重10%
- 成本部评分权重12%
- 法律部评分权重12%

决策标准:
- "投": 综合评分>=75且无明显致命风险，且多数大师支持
- "改": 项目有潜力但存在可解决的问题，或大师意见分歧较大
- "退": 评分<60或存在致命风险，或多数大师反对

评级标准:
- A: 综合评分>=85
- B+: 综合评分>=75
- B: 综合评分>=65
- C: 综合评分<65

请返回JSON格式，包含以下字段：
- typed_conclusion: 投资结论(投/改/退)
- rating: 项目评级(A/B+/B/C)
- score: 综合评分(0-100的整数)
- summary: 决策摘要(200字以内)
- key_metrics: 关键指标字典
- risks: 主要风险列表
- recommendations: 建议列表
- report_header: 报告标题
- final_assessment: 最终评估意见(500字以内)
- master_opinions: 各位大师意见汇总字典{{master_id: {{verdict, score, key_point}}}}
"""

        try:
            response_text = await self._call_llm(
                DECISION_MAKER_SYSTEM_PROMPT, user_prompt
            )
            result = self._parse_json_response(response_text)

            # 构建大师意见汇总
            master_opinions = self._extract_master_opinions(
                master_skill_output
            )

            # 确保结果包含必要字段，并应用计算评分
            decision_result: dict[str, Any] = {
                "typed_conclusion": self._validate_conclusion(
                    result.get("typed_conclusion")
                ),
                "rating": self._validate_rating(
                    result.get("rating")
                ),
                "score": self._validate_score(
                    result.get("score"), weighted_score
                ),
                "summary": result.get("summary", ""),
                "key_metrics": result.get("key_metrics", {}),
                "risks": result.get("risks", []),
                "recommendations": result.get("recommendations", []),
                "project_type_config": result.get(
                    "project_type_config", {}
                ),
                "report_header": result.get(
                    "report_header", "投资部报告"
                ),
                "department_scores": dept_scores,
                "final_assessment": result.get("final_assessment", ""),
                "master_opinions": result.get(
                    "master_opinions", master_opinions
                ),
            }

            logger.info(
                "Decision making completed. "
                "Conclusion: %s, Rating: %s, Score: %d, "
                "Masters: %d",
                decision_result["typed_conclusion"],
                decision_result["rating"],
                decision_result["score"],
                len(master_opinions),
            )
            return decision_result

        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("Decision making failed: %s", e)
            raise

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
                            "temperature": 0.2,
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

        Args:
            text: LLM返回的原始文本

        Returns:
            dict: 解析后的字典

        Raises:
            json.JSONDecodeError: 无法解析JSON时抛出
        """
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        if "```json" in text:
            try:
                json_str = text.split("```json")[1].split("```")[0].strip()
                return json.loads(json_str)
            except (IndexError, json.JSONDecodeError):
                pass

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

    def _calculate_weighted_score(
        self,
        department_results: dict[str, dict[str, Any]],
    ) -> tuple[float, dict[str, int]]:
        """计算加权综合评分

        按照预设权重计算各部门评分的加权平均值。

        Args:
            department_results: 部门Agent结果字典

        Returns:
            tuple: (加权综合评分, 各部门原始评分字典)
        """
        dept_scores: dict[str, int] = {}
        weighted_sum = 0.0
        total_weight = 0.0

        for dept_key, weight in self.SCORE_WEIGHTS.items():
            dept_result = department_results.get(dept_key, {})
            score = dept_result.get("score")

            if score is not None:
                try:
                    score_int = int(score)
                    score_int = max(0, min(100, score_int))
                    dept_scores[dept_key] = score_int
                    weighted_sum += score_int * weight
                    total_weight += weight
                except (TypeError, ValueError):
                    dept_scores[dept_key] = 50
                    weighted_sum += 50 * weight
                    total_weight += weight
            else:
                dept_scores[dept_key] = 50
                weighted_sum += 50 * weight
                total_weight += weight

        if total_weight == 0:
            return 50.0, dept_scores

        return round(weighted_sum / total_weight, 1), dept_scores

    @staticmethod
    def _build_department_summary(
        department_results: dict[str, dict[str, Any]],
    ) -> str:
        """构建部门分析摘要

        汇总所有9个部门的分析结果，生成格式化的部门分析摘要。

        Args:
            department_results: 部门Agent结果字典

        Returns:
            str: 格式化的部门分析摘要
        """
        sections: list[str] = []

        dept_labels: dict[str, str] = {
            "investment": "投资部",
            "asset_management": "资管部",
            "market": "市场部",
            "operation": "运营部",
            "financial": "财务部",
            "design": "设计部",
            "engineering": "工程部",
            "cost": "成本部",
            "legal": "法律部",
        }

        for dept_key, label in dept_labels.items():
            dept = department_results.get(dept_key, {})
            if not dept:
                continue

            sections.append(f"\n### {label}")
            sections.append(f"- 评分: {dept.get('score', 'N/A')}/100")

            summary = dept.get("summary", "")
            if summary:
                sections.append(f"- 摘要: {summary}")

            details = dept.get("details", {})
            if isinstance(details, dict) and details:
                # 提取第一个非空字段作为代表
                for k, v in details.items():
                    if v:
                        sections.append(f"- {k}: {str(v)[:200]}")
                        break

            risks = dept.get("risks", [])
            if risks:
                sections.append(f"- 主要风险: {risks[:3]}")

        return "\n".join(sections)

    @staticmethod
    def _build_master_summary(
        master_outputs: dict[str, dict[str, Any]],
    ) -> str:
        """构建多大师洞察摘要

        汇总所有投资大师的分析结果，生成格式化的洞察摘要。

        Args:
            master_outputs: 多大师分析结果，{master_id: result} 格式

        Returns:
            str: 格式化的多大师洞察摘要
        """
        sections: list[str] = []

        for master_id, output in master_outputs.items():
            # 跳过失败的结果
            if "error" in output:
                sections.append(f"\n### {output.get('master_name', master_id)} - 分析失败")
                continue

            master_name = output.get("master_name", master_id)
            sections.append(f"\n### {master_name}的视角")
            sections.append(f"- 结论: {output.get('verdict', 'N/A')}")
            sections.append(f"- 评分: {output.get('score', 'N/A')}/100")
            sections.append(
                f"- 置信度: {output.get('confidence', 'N/A')}"
            )

            insights = output.get("key_insights", [])
            if insights:
                sections.append(f"- 关键洞察: {insights[:3]}")

            questions = output.get("critical_questions", [])
            if questions:
                sections.append(f"- 关键问题: {questions[:2]}")

            reasoning = output.get("reasoning", "")
            if reasoning:
                # 截取推理的前200字
                reasoning_snippet = reasoning[:200]
                if len(reasoning) > 200:
                    reasoning_snippet += "..."
                sections.append(f"- 核心推理: {reasoning_snippet}")

        return "\n".join(sections)

    @staticmethod
    def _build_master_consensus(
        master_outputs: dict[str, dict[str, Any]],
    ) -> str:
        """构建大师共识分析

        统计各位大师的verdict分布，生成共识/分歧总结。

        Args:
            master_outputs: 多大师分析结果，{master_id: result} 格式

        Returns:
            str: 格式化的共识分析
        """
        sections: list[str] = []
        sections.append("\n### 大师共识分析")

        # 统计verdict
        verdict_counts: dict[str, int] = {}
        master_verdicts: list[str] = []
        scores: list[int] = []

        for master_id, output in master_outputs.items():
            if "error" in output:
                continue
            verdict = output.get("verdict", "改")
            master_name = output.get("master_name", master_id)
            score = output.get("score", 0)
            verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
            master_verdicts.append(f"{master_name}: {verdict}, 评分{score}")
            try:
                scores.append(int(score))
            except (TypeError, ValueError):
                pass

        if master_verdicts:
            sections.append("\n**各位大师意见:**")
            for mv in master_verdicts:
                sections.append(f"- {mv}")

        if verdict_counts:
            total = sum(verdict_counts.values())
            sections.append(f"\n**共识统计 ({total}位大师):**")
            for v, c in verdict_counts.items():
                sections.append(f"- {v}: {c}位")

            # 计算共识结论
            if scores:
                avg_score = sum(scores) / len(scores)
                sections.append(f"- 平均评分: {avg_score:.1f}/100")

            # 分歧判断
            if len(verdict_counts) > 1:
                sections.append("\n**分歧点:** 大师意见存在分歧，建议重点关注分歧原因")
            else:
                consensus = list(verdict_counts.keys())[0]
                sections.append(f"\n**共识: 全体大师一致建议'{consensus}'**")

        return "\n".join(sections)

    @staticmethod
    def _validate_conclusion(conclusion: Any) -> str:
        """验证投资结论

        Args:
            conclusion: 原始结论值

        Returns:
            str: 验证后的结论(投/改/退)
        """
        valid = {"投": "投", "改": "改", "退": "退",
                 "invest": "投", "revise": "改", "pass": "退",
                 "通过": "投", "修改": "改", "放弃": "退"}
        if isinstance(conclusion, str):
            return valid.get(conclusion.strip().lower(), "改")
        return "改"

    @staticmethod
    def _validate_rating(rating: Any) -> str:
        """验证项目评级

        Args:
            rating: 原始评级值

        Returns:
            str: 验证后的评级(A/B+/B/C)
        """
        valid_ratings = {"A": "A", "B+": "B+", "B": "B", "C": "C",
                         "a": "A", "b+": "B+", "b": "B", "c": "C"}
        if isinstance(rating, str):
            return valid_ratings.get(rating.strip(), "B")
        return "B"

    @staticmethod
    def _validate_score(
        score: Any, calculated_score: float
    ) -> int:
        """验证评分值

        优先使用LLM返回的评分，如果无效则使用计算值。

        Args:
            score: LLM返回的原始评分
            calculated_score: 计算的加权评分

        Returns:
            int: 验证后的评分(0-100)
        """
        if score is not None:
            try:
                score_int = int(score)
                return max(0, min(100, score_int))
            except (TypeError, ValueError):
                pass

        return int(round(calculated_score))

    @staticmethod
    def _extract_master_opinions(
        master_outputs: dict[str, dict[str, Any]],
    ) -> dict[str, dict[str, Any]]:
        """提取大师意见汇总

        从多大师分析结果中提取关键信息，生成精简的意见汇总。

        Args:
            master_outputs: 多大师分析结果，{master_id: result} 格式

        Returns:
            dict: {master_id: {verdict, score, key_point}} 格式的意见汇总
        """
        opinions: dict[str, dict[str, Any]] = {}

        for master_id, output in master_outputs.items():
            if "error" in output:
                opinions[master_id] = {
                    "verdict": "改",
                    "score": 50,
                    "key_point": f"分析失败: {output.get('error', '未知错误')}",
                }
                continue

            insights = output.get("key_insights", [])
            key_point = insights[0] if insights else ""
            if not key_point:
                reasoning = output.get("reasoning", "")
                key_point = reasoning[:100] if reasoning else "无详细分析"

            opinions[master_id] = {
                "verdict": output.get("verdict", "改"),
                "score": output.get("score", 50),
                "key_point": key_point,
            }

        return opinions
