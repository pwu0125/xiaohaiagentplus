"""秘书Agent模块

负责接收用户上传的材料列表，使用LLM提取结构化信息，
返回标准化的项目资料字典。
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# 秘书Agent的系统提示词
SECRETARY_SYSTEM_PROMPT = """你是一位专业的投资委员会秘书，擅长从各类投资材料中提取和结构化关键信息。

你的职责：
1. 仔细阅读用户提供的项目材料
2. 提取项目的基本信息、财务数据、运营数据和市场背景
3. 识别缺失的关键字段
4. 生成结构化的项目摘要

输出要求：
- 必须返回合法的JSON格式
- 所有字段使用中文
- 数值字段保持数字类型
- 缺失的字段标注为null或空数组
- 对项目的理解要准确、全面

提取字段说明：
- basic_info: 项目基本信息（名称、行业、阶段、团队等）
- financial_data: 财务数据（收入、成本、利润、融资历史等）
- operational_data: 运营数据（用户量、增长率、关键指标等）
- market_context: 市场背景（市场规模、竞争格局、趋势等）
"""

# 材料提取的系统提示词
EXTRACTION_SYSTEM_PROMPT = """你是一位专业的投资材料分析专家。

请从用户提供的材料中提取所有与投资部相关的关键信息。
重点关注：
1. 项目/公司的基本信息
2. 财务数据和指标
3. 运营数据和增长指标
4. 市场定位和竞争情况
5. 团队背景
6. 融资历史和资金需求

返回格式要求：
- 必须返回合法的JSON
- 数值保持原始精度
- 不确定的信息标注"待确认"
- 保留原文中的关键引用
"""


class SecretaryAgent:
    """秘书Agent

    接收用户上传的材料列表，使用LLM提取结构化信息，
    返回标准化的项目资料字典。

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL，默认使用OpenAI官方
        model: 使用的模型名称，默认gpt-4o
        timeout: LLM调用超时时间(秒)，默认300

    Example:
        >>> agent = SecretaryAgent(api_key="sk-xxx")
        >>> materials = [{"filename": "bp.pdf", "content": "..."}]
        >>> result = await agent.process_materials(materials)
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
        logger.info("SecretaryAgent initialized with model: %s", model)

    async def process_materials(
        self,
        materials: list[dict[str, Any]],
        project_type: str = "",
    ) -> dict[str, Any]:
        """处理材料列表，提取结构化信息

        依次处理每个材料文件，提取信息并合并为统一的项目资料。
        结合项目类型信息，重点提取与项目类型相关的关键信息。

        Args:
            materials: 材料列表，每项包含filename和content等字段。
            project_type: 项目类型标识，逗号分隔（如 "office_building,hotel"）。

        Returns:
            dict: 标准化的项目资料字典，包含以下字段：
                - project_name: 项目名称
                - extracted_fields: 提取的字段（basic_info/financial_data/operational_data/market_context）
                - missing_fields: 缺失字段列表
                - material_summary: 材料摘要
                - structured_content: 结构化内容文本

        Raises:
            ValueError: 材料列表为空时抛出
            httpx.HTTPError: LLM调用失败时抛出
        """
        if not materials:
            raise ValueError("Materials list cannot be empty")

        logger.info(
            "Processing %d materials | project_type=%s",
            len(materials),
            project_type,
        )

        # 逐个提取材料信息
        extracted_results: list[dict[str, Any]] = []
        for idx, material in enumerate(materials, 1):
            logger.debug("Extracting from material %d/%d: %s",
                        idx, len(materials), material.get("filename", "unknown"))
            try:
                extracted = await self.extract_from_file(
                    material, project_type
                )
                extracted_results.append(extracted)
            except Exception as e:
                logger.error(
                    "Failed to extract from material %s: %s",
                    material.get("filename", "unknown"),
                    e,
                )
                # 继续处理其他材料

        if not extracted_results:
            raise RuntimeError("All material extractions failed")

        # 合并提取结果
        merged = self._merge_extracted_results(extracted_results)

        # 生成结构化内容
        structured_content = self.generate_structured_content(
            merged, project_type
        )

        # 识别缺失字段
        missing_fields = self._identify_missing_fields(merged)

        # 生成材料摘要
        material_summary = self._generate_summary(materials, merged)

        result: dict[str, Any] = {
            "project_name": merged.get("basic_info", {}).get("name", "未命名项目"),
            "extracted_fields": {
                "basic_info": merged.get("basic_info", {}),
                "financial_data": merged.get("financial_data", {}),
                "operational_data": merged.get("operational_data", {}),
                "market_context": merged.get("market_context", {}),
            },
            "missing_fields": missing_fields,
            "material_summary": material_summary,
            "structured_content": structured_content,
        }

        logger.info(
            "Materials processed successfully. Project: %s, Missing fields: %d",
            result["project_name"],
            len(missing_fields),
        )

        return result

    async def extract_from_file(
        self,
        file_info: dict[str, Any],
        project_type: str = "",
    ) -> dict[str, Any]:
        """从单个文件提取信息

        使用LLM从文件内容中提取结构化投资信息。
        结合项目类型信息，重点提取与项目类型相关的关键字段。

        Args:
            file_info: 文件信息字典，至少包含：
                - filename: 文件名
                - content: 文件内容（文本）
                可选包含：
                - file_type: 文件类型
                - size: 文件大小
            project_type: 项目类型标识，逗号分隔。

        Returns:
            dict: 提取的信息字典

        Raises:
            ValueError: 文件信息格式不正确时抛出
            httpx.HTTPError: LLM调用失败时抛出
        """
        filename = file_info.get("filename", "unknown")
        content = file_info.get("content", "")

        if not content:
            logger.warning("Empty content for file: %s", filename)
            return {}

        logger.debug("Extracting from file: %s", filename)

        type_hint = ""
        if project_type:
            type_hint = f"\n项目类型: {project_type}\n请重点关注与该项目类型相关的信息。"

        user_prompt = f"""请从以下投资材料中提取关键信息。

文件名: {filename}
文件类型: {file_info.get("file_type", "unknown")}{type_hint}

文件内容:
{content[:8000]}

请提取所有与投资部相关的信息，返回JSON格式。
"""

        try:
            response_text = await self._call_llm(
                EXTRACTION_SYSTEM_PROMPT, user_prompt
            )
            extracted = self._parse_json_response(response_text)
            logger.debug("Successfully extracted from file: %s", filename)
            return extracted
        except (httpx.HTTPError, json.JSONDecodeError) as e:
            logger.error("LLM extraction failed for %s: %s", filename, e)
            raise

    def generate_structured_content(
        self,
        extracted: dict[str, Any],
        project_type: str = "",
    ) -> str:
        """生成结构化内容文本

        将提取的信息整合为统一格式的结构化文本，
        供后续Agent使用。包含项目类型信息。

        Args:
            extracted: 提取的信息字典。
            project_type: 项目类型标识，逗号分隔。

        Returns:
            str: 结构化内容文本。
        """
        sections: list[str] = []

        # 项目类型信息
        if project_type:
            sections.append(f"【项目类型】\n  {project_type}")

        # 项目基本信息
        basic = extracted.get("basic_info", {})
        if basic:
            sections.append("【项目基本信息】")
            for key, value in basic.items():
                if value is not None:
                    sections.append(f"  {key}: {value}")

        # 财务数据
        financial = extracted.get("financial_data", {})
        if financial:
            sections.append("\n【财务数据】")
            for key, value in financial.items():
                if value is not None:
                    sections.append(f"  {key}: {value}")

        # 运营数据
        operational = extracted.get("operational_data", {})
        if operational:
            sections.append("\n【运营数据】")
            for key, value in operational.items():
                if value is not None:
                    sections.append(f"  {key}: {value}")

        # 市场背景
        market = extracted.get("market_context", {})
        if market:
            sections.append("\n【市场背景】")
            for key, value in market.items():
                if value is not None:
                    sections.append(f"  {key}: {value}")

        return "\n".join(sections)

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
                    logger.debug("LLM call succeeded on attempt %d", attempt)
                    return content

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code in (429, 500, 502, 503):
                    import asyncio

                    wait_time = 2 ** attempt
                    logger.warning(
                        "LLM call failed (attempt %d/%d), retrying in %ds: %s",
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
                        "LLM call failed (attempt %d/%d), retrying in %ds: %s",
                        attempt,
                        max_retries,
                        wait_time,
                        e,
                    )
                    await asyncio.sleep(wait_time)
                else:
                    raise

        raise last_error or RuntimeError("LLM call failed after all retries")

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
        # 尝试直接解析
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 尝试从代码块中提取
        if "```json" in text:
            json_str = text.split("```json")[1].split("```")[0].strip()
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass

        # 尝试从```中提取
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

    @staticmethod
    def _merge_extracted_results(
        results: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """合并多个提取结果

        将多个文件的提取结果合并为统一的字典。

        Args:
            results: 提取结果列表

        Returns:
            dict: 合并后的结果
        """
        merged: dict[str, Any] = {}

        for result in results:
            if not isinstance(result, dict):
                continue
            for key, value in result.items():
                if isinstance(value, dict):
                    if key not in merged:
                        merged[key] = {}
                    merged[key].update(value)
                elif isinstance(value, list):
                    if key not in merged:
                        merged[key] = []
                    merged[key].extend(value)
                else:
                    if key not in merged or merged[key] is None:
                        merged[key] = value

        return merged

    @staticmethod
    def _identify_missing_fields(
        extracted: dict[str, Any]
    ) -> list[str]:
        """识别缺失的关键字段

        Args:
            extracted: 已提取的信息字典

        Returns:
            list: 缺失字段列表
        """
        required_fields = {
            "basic_info": ["name", "industry", "stage", "team_size"],
            "financial_data": ["revenue", "cost", "profit", "funding_history"],
            "operational_data": ["users", "growth_rate", "key_metrics"],
            "market_context": ["market_size", "competition", "trends"],
        }

        missing: list[str] = []
        for category, fields in required_fields.items():
            category_data = extracted.get(category, {})
            for field in fields:
                if field not in category_data or category_data[field] is None:
                    missing.append(f"{category}.{field}")

        return missing

    @staticmethod
    def _generate_summary(
        materials: list[dict[str, Any]], extracted: dict[str, Any]
    ) -> str:
        """生成材料摘要

        Args:
            materials: 原始材料列表
            extracted: 提取的信息字典

        Returns:
            str: 材料摘要文本
        """
        filenames = [m.get("filename", "unknown") for m in materials]
        project_name = extracted.get("basic_info", {}).get("name", "未命名项目")

        summary = (
            f"项目: {project_name}\n"
            f"材料数量: {len(materials)}\n"
            f"材料列表: {', '.join(filenames)}\n"
        )

        # 添加关键数据概览
        financial = extracted.get("financial_data", {})
        if financial:
            summary += f"\n财务概览: {financial}"

        return summary
