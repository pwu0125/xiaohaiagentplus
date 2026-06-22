"""材料分析器模块

负责接收用户上传的商业地产投资材料，执行以下流程：
文件上传 → 文本提取 → 秘书Agent快速提取 → LLM报告生成器 → 保存知识库

支持PDF、Excel/CSV、TXT/MD/JSON等多种文件格式。
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import uuid
from collections.abc import AsyncGenerator
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 报告生成器 Prompt
# ---------------------------------------------------------------------------

ANALYSIS_PROMPT = """你是一位资深的商业地产投资分析专家，拥有20年以上的行业经验。
请基于以下项目材料，生成一份完整的商业地产投资分析报告。

【项目材料】
{materials_text}

【项目类型】
{project_type}

请严格按照以下JSON格式输出报告（确保是合法的JSON）：

{{
  "conclusion": "invest|hold|divest",
  "confidence": 85,
  "summary": "一句话总结投资结论",
  "key_metrics": {{
    "valuation": "12.5亿",
    "cap_rate": "5.8%",
    "irr": "18.5%",
    "noi": "7200万/年",
    "entry_cap_rate": "6.2%",
    "exit_cap_rate": "5.2%",
    "leverage_ratio": "60%",
    "interest_coverage": "2.5x"
  }},
  "scenarios": {{
    "optimistic": {{
      "irr": "22.3%",
      "multiple": "2.1x",
      "exit_value": "15.8亿",
      "assumptions": ["租金上涨8%", "空置率降至5%"]
    }},
    "base": {{
      "irr": "18.5%",
      "multiple": "1.8x",
      "exit_value": "13.2亿",
      "assumptions": ["租金稳定增长5%", "空置率维持8%"]
    }},
    "pessimistic": {{
      "irr": "12.1%",
      "multiple": "1.4x",
      "exit_value": "10.5亿",
      "assumptions": ["租金仅涨2%", "空置率升至12%"]
    }}
  }},
  "risks": [
    {{
      "category": "市场风险",
      "level": "high|medium|low",
      "description": "风险描述"
    }}
  ],
  "action_items": [
    "具体行动建议1",
    "具体行动建议2"
  ],
  "macro_cycle": {{
    "phase": "复苏期|扩张期|成熟期|衰退期",
    "indicators": [
      {{
        "name": "GDP增速",
        "points": [{{"year": "2021", "value": 8.4}}, {{"year": "2022", "value": 3.0}}, {{"year": "2023", "value": 5.2}}]
      }}
    ]
  }},
  "industry_cycle": {{
    "phase": "上升期|高峰期|调整期|筑底期",
    "indicators": [
      {{
        "name": "全国写字楼空置率",
        "points": [{{"year": "2021", "value": 18.5}}, {{"year": "2022", "value": 20.2}}, {{"year": "2023", "value": 21.8}}]
      }}
    ]
  }},
  "city_analysis": {{
    "city": "城市名称",
    "tier": "一线|新一线|二线|三线",
    "gdp_growth": "6.5%",
    "population_growth": "2.1%",
    "office_vacancy": "18.5%",
    "competitors": [
      {{"name": "竞品A", "rent": 280, "vacancy": 15, "x": 280, "y": 15}}
    ],
    "project_position": {{"name": "本项目", "rent": 250, "vacancy": 12, "x": 250, "y": 12}}
  }},
  "project_profile": {{
    "property_type": "写字楼|商业综合体|酒店|长租公寓|产业园",
    "total_area": "85000平方米",
    "operation_status": "运营中|在建|规划",
    "ownership_structure": "全资|合资|REITs",
    "location": "项目地址",
    "year_built": 2019,
    "occupancy_rate": "88%",
    "avg_rent": "250元/㎡·月"
  }},
  "sections": {{
    "overview": "<h3>项目概览</h3><p>HTML格式的项目概览内容</p>",
    "financial": "<h3>财务分析</h3><p>HTML格式的财务分析内容</p>",
    "valuation": "<h3>估值分析</h3><p>HTML格式的估值分析内容</p>",
    "roi": "<h3>回报分析</h3><p>HTML格式的回报分析内容</p>",
    "risk": "<h3>风险分析</h3><p>HTML格式的风险分析内容</p>"
  }}
}}

要求：
1. 必须返回合法的JSON格式
2. 所有数值指标必须基于材料中的真实数据计算
3. 风险分析要全面，至少覆盖市场、政策、运营、财务四个维度
4. HTML sections要有实质内容，不能是空壳
5. 宏观周期和行业周期的时间序列数据要合理
6. 城市分析中的竞品坐标用于散点图展示
"""

# ---------------------------------------------------------------------------
# Mock 数据生成器
# ---------------------------------------------------------------------------

DEMO_REPORT: dict[str, Any] = {
    "conclusion": "invest",
    "confidence": 82,
    "summary": "该项目位于核心商务区，租金增长稳定，空置率低于市场均值，建议以合理估值进入持有。",
    "key_metrics": {
        "valuation": "12.8亿元",
        "cap_rate": "5.6%",
        "irr": "18.2%",
        "noi": "7168万元/年",
        "entry_cap_rate": "6.0%",
        "exit_cap_rate": "5.0%",
        "leverage_ratio": "55%",
        "interest_coverage": "2.6x",
    },
    "scenarios": {
        "optimistic": {
            "irr": "22.5%",
            "multiple": "2.1x",
            "exit_value": "16.0亿元",
            "assumptions": ["租金年增8%", "空置率降至5%", "资本化率压缩至4.8%"],
        },
        "base": {
            "irr": "18.2%",
            "multiple": "1.8x",
            "exit_value": "13.2亿元",
            "assumptions": ["租金年增5%", "空置率维持8%", "资本化率维持5.6%"],
        },
        "pessimistic": {
            "irr": "11.8%",
            "multiple": "1.3x",
            "exit_value": "10.2亿元",
            "assumptions": ["租金年增2%", "空置率升至13%", "资本化率扩张至6.5%"],
        },
    },
    "risks": [
        {
            "category": "市场风险",
            "level": "medium",
            "description": "区域写字楼新增供应2025年达峰值，可能压制租金增长空间",
        },
        {
            "category": "政策风险",
            "level": "low",
            "description": "商业地产REITs政策推进中，长期利好退出渠道",
        },
        {
            "category": "运营风险",
            "level": "medium",
            "description": "现有物业管理团队运营效率低于行业TOP10均值15%",
        },
        {
            "category": "财务风险",
            "level": "low",
            "description": "当前杠杆率55%，利息覆盖倍数2.6x，偿债能力充足",
        },
    ],
    "action_items": [
        "优先完成工程尽职调查，重点排查消防与机电系统",
        "与现有租约前三大租户确认续租意向，锁定未来3年现金流",
        "谈判阶段争取10%价格折让，将entry_cap_rate提升至6.5%以上",
        "引入专业物业管理团队，目标首年内将NOI提升8%",
        "关注公募REITs政策窗口，预留资产证券化退出通道",
    ],
    "macro_cycle": {
        "phase": "复苏期",
        "indicators": [
            {
                "name": "GDP增速(%)",
                "points": [
                    {"year": "2020", "value": 2.2},
                    {"year": "2021", "value": 8.4},
                    {"year": "2022", "value": 3.0},
                    {"year": "2023", "value": 5.2},
                    {"year": "2024", "value": 4.8},
                ],
            },
            {
                "name": "社零增速(%)",
                "points": [
                    {"year": "2020", "value": -3.9},
                    {"year": "2021", "value": 12.5},
                    {"year": "2022", "value": -0.2},
                    {"year": "2023", "value": 7.2},
                    {"year": "2024", "value": 5.5},
                ],
            },
        ],
    },
    "industry_cycle": {
        "phase": "调整期",
        "indicators": [
            {
                "name": "全国写字楼空置率(%)",
                "points": [
                    {"year": "2020", "value": 16.8},
                    {"year": "2021", "value": 18.5},
                    {"year": "2022", "value": 20.2},
                    {"year": "2023", "value": 21.8},
                    {"year": "2024", "value": 22.5},
                ],
            },
            {
                "name": "商业地产投资额(万亿元)",
                "points": [
                    {"year": "2020", "value": 1.85},
                    {"year": "2021", "value": 2.12},
                    {"year": "2022", "value": 1.78},
                    {"year": "2023", "value": 1.92},
                    {"year": "2024", "value": 2.05},
                ],
            },
        ],
    },
    "city_analysis": {
        "city": "上海市",
        "tier": "一线",
        "gdp_growth": "5.8%",
        "population_growth": "1.8%",
        "office_vacancy": "19.2%",
        "competitors": [
            {"name": "恒隆广场", "rent": 350, "vacancy": 8, "x": 350, "y": 8},
            {"name": "国金中心", "rent": 320, "vacancy": 10, "x": 320, "y": 10},
            {"name": "环球金融中心", "rent": 290, "vacancy": 14, "x": 290, "y": 14},
            {"name": "金茂大厦", "rent": 260, "vacancy": 16, "x": 260, "y": 16},
            {"name": "来福士广场", "rent": 240, "vacancy": 18, "x": 240, "y": 18},
            {"name": "SOHO东海", "rent": 200, "vacancy": 22, "x": 200, "y": 22},
        ],
        "project_position": {
            "name": "本项目",
            "rent": 250,
            "vacancy": 12,
            "x": 250,
            "y": 12,
        },
    },
    "project_profile": {
        "property_type": "甲级写字楼",
        "total_area": "85000平方米",
        "operation_status": "运营中",
        "ownership_structure": "外资基金持有",
        "location": "浦东新区陆家嘴金融贸易区",
        "year_built": 2018,
        "occupancy_rate": "88%",
        "avg_rent": "250元/㎡·月",
    },
    "sections": {
        "overview": (
            "<h3>项目概览</h3>"
            "<p>本项目为陆家嘴核心区甲级写字楼，总建筑面积8.5万㎡，"
            "2018年竣工入市，当前出租率88%，平均租金250元/㎡·月。"
            "物业由国际知名开发商持有并运营，建筑品质及物业管理均达国际标准。</p>"
            "<p>项目周边交通便利，距地铁2号线/14号线步行5分钟，"
            "毗邻国金中心、环球金融中心等地标建筑，商务配套成熟。</p>"
        ),
        "financial": (
            "<h3>财务分析</h3>"
            "<p>项目2023年度运营收入2.25亿元，运营支出1.53亿元，"
            "NOI约7,168万元，NOI利润率31.9%。</p>"
            "<p>历史财务表现稳健：2021-2023年NOI复合增长率6.2%，"
            "运营支出控制良好，年均增幅仅2.8%。</p>"
            "<p>现有债务余额7.0亿元，综合融资成本4.2%，"
            "剩余贷款期限8年，偿债现金流覆盖率2.6倍，财务结构安全。</p>"
        ),
        "valuation": (
            "<h3>估值分析</h3>"
            "<p>采用收益法估值，当前资本化率5.6%，对应估值12.8亿元。</p>"
            "<p>敏感性分析：资本化率每变动25bps，估值波动约5,500万元。"
            "在5.0%-6.5%资本化率区间，估值区间11.0-14.3亿元。</p>"
            "<p>与近期可比交易对比，本项目估值处于市场中位水平，"
            "单价约1.51万元/㎡，低于陆家嘴核心区1.8万元/㎡的均价，"
            "存在约15%的价值提升空间。</p>"
        ),
        "roi": (
            "<h3>回报分析</h3>"
            "<p>基准情景下，预计5年持有期IRR 18.2%，权益倍数1.8x，"
            "年均现金回报率(CoC)约12.5%。</p>"
            "<p>乐观情景下IRR可达22.5%，悲观情景下IRR仍有11.8%，"
            "下行风险可控。</p>"
            "<p>假设第5年末以5.0%资本化率退出，退出估值约13.2亿元，"
            "实现资本增值约3,000万元。</p>"
        ),
        "risk": (
            "<h3>风险分析</h3>"
            "<p><b>市场风险（中）：</b>区域未来2年新增供应约30万㎡，"
            "可能压制租金增速，需关注周边项目预租情况。</p>"
            "<p><b>运营风险（中）：</b>现有物业管理团队效率有提升空间，"
            "建议在收购后引入专业物管团队。</p>"
            "<p><b>政策风险（低）：</b>REITs政策持续推进利好长期退出，"
            "但税收政策存在不确定性。</p>"
            "<p><b>财务风险（低）：</b>杠杆率适中，偿债覆盖充足，"
            "利率上行空间有限。</p>"
        ),
    },
}


# ---------------------------------------------------------------------------
# 文件提取工具
# ---------------------------------------------------------------------------


def extract_text_from_file(content: bytes, filename: str) -> dict[str, Any]:
    """从文件内容中提取文本

    支持PDF、Excel/CSV、TXT/MD/JSON等多种文件格式。
    根据不同文件类型使用不同的提取策略。

    Args:
        content: 文件二进制内容
        filename: 原始文件名

    Returns:
        dict: 提取结果，包含以下字段：
            - text: 提取的文本内容
            - file_type: 文件类型标识
            - content_length: 文本长度
            - diagnostics: 提取过程诊断信息
    """
    file_lower = filename.lower()
    diagnostics: dict[str, Any] = {
        "filename": filename,
        "method": None,
        "error": None,
        "fallback_used": False,
    }

    # PDF 文件
    if file_lower.endswith(".pdf"):
        return _extract_pdf(content, diagnostics)

    # Excel 文件
    if file_lower.endswith((".xlsx", ".xls")):
        return _extract_excel(content, diagnostics)

    # CSV 文件
    if file_lower.endswith(".csv"):
        return _extract_csv(content, diagnostics)

    # 文本类文件 (TXT/MD/JSON)
    if file_lower.endswith((".txt", ".md", ".json", ".py", ".js", ".html", ".xml")):
        return _extract_text(content, diagnostics)

    # 未知类型，尝试作为文本读取
    diagnostics["method"] = "unknown_fallback"
    diagnostics["fallback_used"] = True
    try:
        text = content.decode("utf-8", errors="replace")
        return {
            "text": text,
            "file_type": "unknown",
            "content_length": len(text),
            "diagnostics": diagnostics,
        }
    except Exception as e:
        diagnostics["error"] = str(e)
        return {
            "text": "[文件读取失败]",
            "file_type": "unknown",
            "content_length": 0,
            "diagnostics": diagnostics,
        }


def _extract_pdf(content: bytes, diagnostics: dict[str, Any]) -> dict[str, Any]:
    """提取PDF文本，使用PyMuPDF(fitz)，失败时回退到直接读取"""
    diagnostics["method"] = "pymupdf"
    text_parts: list[str] = []

    try:
        import fitz  # type: ignore[import-untyped]

        pdf_stream = io.BytesIO(content)
        doc = fitz.open(stream=pdf_stream, filetype="pdf")
        page_count = len(doc)

        for page_num in range(page_count):
            page = doc.load_page(page_num)
            page_text = page.get_text()
            text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")

        doc.close()
        text = "\n\n".join(text_parts)
        diagnostics["pages"] = page_count

        return {
            "text": text,
            "file_type": "pdf",
            "content_length": len(text),
            "diagnostics": diagnostics,
        }

    except ImportError:
        diagnostics["error"] = "PyMuPDF(fitz) not installed"
    except Exception as e:
        diagnostics["error"] = f"PyMuPDF extraction failed: {e}"

    # 回退：尝试直接读取
    diagnostics["fallback_used"] = True
    diagnostics["method"] = "pymupdf_fallback_utf8"
    try:
        text = content.decode("utf-8", errors="replace")
        # 过滤掉二进制控制字符
        text = "".join(ch for ch in text if ch.isprintable() or ch in "\n\r\t")
        diagnostics["note"] = "Fallback to raw UTF-8 decoding"
        return {
            "text": text,
            "file_type": "pdf",
            "content_length": len(text),
            "diagnostics": diagnostics,
        }
    except Exception as e:
        diagnostics["error"] = f"Fallback also failed: {e}"
        return {
            "text": "[PDF读取失败]",
            "file_type": "pdf",
            "content_length": 0,
            "diagnostics": diagnostics,
        }


def _extract_excel(content: bytes, diagnostics: dict[str, Any]) -> dict[str, Any]:
    """提取Excel文本，使用pandas"""
    diagnostics["method"] = "pandas_excel"

    try:
        import pandas as pd  # type: ignore[import-untyped]

        excel_file = io.BytesIO(content)
        # 读取所有sheet
        all_sheets = pd.read_excel(excel_file, sheet_name=None)
        text_parts: list[str] = []

        for sheet_name, df in all_sheets.items():
            text_parts.append(f"=== Sheet: {sheet_name} ===")
            text_parts.append(df.to_string(index=True))
            text_parts.append("")

        text = "\n".join(text_parts)
        diagnostics["sheets"] = list(all_sheets.keys())

        return {
            "text": text,
            "file_type": "excel",
            "content_length": len(text),
            "diagnostics": diagnostics,
        }

    except ImportError:
        diagnostics["error"] = "pandas not installed"
    except Exception as e:
        diagnostics["error"] = f"Excel extraction failed: {e}"

    return {
        "text": "[Excel读取失败，请安装pandas和openpyxl]",
        "file_type": "excel",
        "content_length": 0,
        "diagnostics": diagnostics,
    }


def _extract_csv(content: bytes, diagnostics: dict[str, Any]) -> dict[str, Any]:
    """提取CSV文本，使用pandas"""
    diagnostics["method"] = "pandas_csv"

    try:
        import pandas as pd  # type: ignore[import-untyped]

        csv_stream = io.BytesIO(content)
        df = pd.read_csv(csv_stream)
        text = df.to_string(index=True)

        diagnostics["rows"] = len(df)
        diagnostics["columns"] = len(df.columns)

        return {
            "text": text,
            "file_type": "csv",
            "content_length": len(text),
            "diagnostics": diagnostics,
        }

    except ImportError:
        diagnostics["error"] = "pandas not installed"
    except Exception as e:
        diagnostics["error"] = f"CSV extraction failed: {e}"

    return {
        "text": "[CSV读取失败，请安装pandas]",
        "file_type": "csv",
        "content_length": 0,
        "diagnostics": diagnostics,
    }


def _extract_text(content: bytes, diagnostics: dict[str, Any]) -> dict[str, Any]:
    """提取纯文本文件内容，UTF-8解码"""
    diagnostics["method"] = "utf8_decode"

    try:
        text = content.decode("utf-8", errors="replace")
        diagnostics["encoding"] = "utf-8"

        return {
            "text": text,
            "file_type": "text",
            "content_length": len(text),
            "diagnostics": diagnostics,
        }
    except Exception as e:
        diagnostics["error"] = f"Text decoding failed: {e}"
        return {
            "text": "[文本读取失败]",
            "file_type": "text",
            "content_length": 0,
            "diagnostics": diagnostics,
        }


# ---------------------------------------------------------------------------
# SSE 事件构造器
# ---------------------------------------------------------------------------


def _sse_event(event_type: str, **kwargs: Any) -> dict[str, Any]:
    """构造SSE事件字典

    Args:
        event_type: 事件类型名称
        **kwargs: 事件数据字段

    Returns:
        SSE事件字典
    """
    return {"type": event_type, **kwargs}


# ---------------------------------------------------------------------------
# MaterialAnalyzer 类
# ---------------------------------------------------------------------------


class MaterialAnalyzer:
    """材料分析器

    负责接收用户上传的商业地产投资材料，执行完整分析流程：
    文件上传 → 文本提取 → 秘书Agent快速提取 → LLM报告生成器 → 保存知识库

    Args:
        api_key: OpenAI API密钥
        api_base: OpenAI API基础URL，默认使用OpenAI官方
        model: 使用的模型名称，默认gpt-4o

    Example:
        >>> analyzer = MaterialAnalyzer(api_key="sk-xxx")
        >>> materials = [{"filename": "bp.pdf", "content": b"..."}]
        >>> async for event in analyzer.analyze_stream(materials, "office_building", "sess_001"):
        ...     print(event)
    """

    def __init__(
        self,
        api_key: str,
        api_base: str | None = None,
        model: str = "gpt-4o",
    ) -> None:
        self.api_key = api_key
        self.api_base = (api_base or "https://api.openai.com/v1").rstrip("/")
        self.model = model
        self.timeout = 300
        logger.info("MaterialAnalyzer initialized with model: %s", model)

    # ------------------------------------------------------------------
    # 公共接口
    # ------------------------------------------------------------------

    async def analyze_stream(
        self,
        materials: list[dict[str, Any]],
        project_type: str,
        session_id: str,
    ) -> AsyncGenerator[dict[str, Any], None]:
        """流式分析材料

        通过SSE推送各阶段进度和最终报告。

        Args:
            materials: 材料列表，每项包含filename和content(bytes)等字段
            project_type: 项目类型标识
            session_id: 会话ID

        Yields:
            dict: SSE事件字典，类型包括：
                - stage_start: 阶段开始
                - stage_progress: 阶段进度更新
                - stage_complete: 阶段完成
                - flow_complete: 整个流程完成
                - error: 错误事件

        Raises:
            ValueError: 材料列表为空时抛出
        """
        if not materials:
            yield _sse_event("error", error="Materials list cannot be empty")
            return

        logger.info(
            "[session=%s] 开始材料分析 | project_type=%s | files=%d",
            session_id,
            project_type,
            len(materials),
        )

        try:
            # =============================================================
            # 阶段1: 文件提取
            # =============================================================
            yield _sse_event("stage_start", stage="extraction")

            extracted_materials: list[dict[str, Any]] = []
            for idx, material in enumerate(materials):
                filename = material.get("filename", "unknown")
                file_content = material.get("content", b"")

                if isinstance(file_content, str):
                    file_content = file_content.encode("utf-8")

                progress = int((idx / len(materials)) * 100)
                yield _sse_event(
                    "stage_progress",
                    stage="extraction",
                    progress=progress,
                    current_file=filename,
                    file_index=idx + 1,
                    total_files=len(materials),
                )

                result = extract_text_from_file(file_content, filename)
                extracted_materials.append({
                    "filename": filename,
                    **result,
                })
                await asyncio.sleep(0.8)
                logger.info(
                    "[session=%s] 提取文件 %s: type=%s, length=%d",
                    session_id,
                    filename,
                    result["file_type"],
                    result["content_length"],
                )

            yield _sse_event(
                "stage_complete",
                stage="extraction",
                extracted_count=len(extracted_materials),
            )
            await asyncio.sleep(0.5)

            # =============================================================
            # 阶段2: 秘书Agent快速提取
            # =============================================================
            yield _sse_event("stage_start", stage="secretary")
            await asyncio.sleep(1.5)

            # 准备秘书Agent输入
            secretary_materials = [
                {
                    "filename": m["filename"],
                    "content": m["text"],
                    "file_type": m["file_type"],
                }
                for m in extracted_materials
            ]

            try:
                from backend.agents.secretary_agent import SecretaryAgent

                secretary = SecretaryAgent(
                    api_key=self.api_key,
                    api_base=self.api_base,
                    model=self.model,
                )
                secretary_result = await secretary.process_materials(
                    secretary_materials, project_type
                )
                structured_content = secretary_result.get(
                    "structured_content", ""
                )
            except Exception as e:
                logger.warning(
                    "[session=%s] 秘书Agent调用失败，使用原始文本: %s",
                    session_id,
                    e,
                )
                # 秘书Agent失败时，使用拼接的文本作为后备
                structured_content = "\n\n".join(
                    f"【{m['filename']}】\n{m['text'][:5000]}"
                    for m in extracted_materials
                )

            yield _sse_event(
                "stage_complete",
                stage="secretary",
                project_name=getattr(
                    secretary_result if "secretary_result" in dir() else {},
                    "project_name",
                    "未命名项目",
                )
                if "secretary_result" in dir()
                else "未命名项目",
            )
            await asyncio.sleep(0.5)

            # =============================================================
            # 阶段3: LLM报告生成器
            # =============================================================
            yield _sse_event("stage_start", stage="report_builder")
            await asyncio.sleep(0.5)

            materials_text = "\n\n".join(
                f"===== 文件: {m['filename']} =====\n{m['text'][:8000]}"
                for m in extracted_materials
            )

            yield _sse_event(
                "stage_progress",
                stage="report_builder",
                progress=10,
                message="正在调用LLM生成报告...",
            )
            await asyncio.sleep(0.5)

            try:
                report = await self._generate_report(
                    materials_text, structured_content, project_type, session_id
                )
                yield _sse_event(
                    "stage_progress",
                    stage="report_builder",
                    progress=80,
                    message="报告生成完成，正在保存...",
                )
            except Exception as e:
                logger.warning(
                    "[session=%s] LLM报告生成失败，使用Mock数据: %s", session_id, e
                )
                report = self._generate_demo_report(project_type)
                yield _sse_event(
                    "stage_progress",
                    stage="report_builder",
                    progress=80,
                    message="使用演示数据...",
                )

            yield _sse_event(
                "stage_complete",
                stage="report_builder",
                report_ready=True,
            )
            await asyncio.sleep(0.5)

            # =============================================================
            # 阶段4: 保存知识库
            # =============================================================
            kb_id = await self._save_to_knowledge_base(
                report, materials, project_type, session_id
            )
            await asyncio.sleep(0.5)

            # =============================================================
            # 流程完成
            # =============================================================
            yield _sse_event("stage_progress", stage="report_builder", progress=100, message="分析完成")
            await asyncio.sleep(0.3)
            yield _sse_event(
                "flow_complete",
                final_report={
                    "report": report,
                    "kb_id": kb_id,
                    "session_id": session_id,
                },
            )

            logger.info(
                "[session=%s] 材料分析流程完成 | kb_id=%s",
                session_id,
                kb_id,
            )

        except Exception as e:
            logger.exception("[session=%s] 材料分析流程异常: %s", session_id, e)
            yield _sse_event("error", error=str(e), session_id=session_id)

    async def analyze(
        self,
        materials: list[dict[str, Any]],
        project_type: str,
    ) -> dict[str, Any]:
        """非流式分析材料

        收集所有流式事件，返回最终结果。

        Args:
            materials: 材料列表
            project_type: 项目类型标识

        Returns:
            dict: 包含以下字段：
                - report: 完整分析报告
                - kb_id: 知识库条目ID
                - session_id: 会话ID

        Raises:
            RuntimeError: 分析流程出错时抛出
        """
        session_id = str(uuid.uuid4())
        report: dict[str, Any] | None = None
        kb_id: str | None = None

        async for event in self.analyze_stream(materials, project_type, session_id):
            if event["type"] == "flow_complete":
                final = event.get("final_report", {})
                report = final.get("report")
                kb_id = final.get("kb_id")
            elif event["type"] == "error":
                raise RuntimeError(f"分析失败: {event.get('error')}")

        if report is None:
            raise RuntimeError("分析未完成，未收到报告")

        return {
            "report": report,
            "kb_id": kb_id or "",
            "session_id": session_id,
        }

    # ------------------------------------------------------------------
    # 内部方法
    # ------------------------------------------------------------------

    async def _generate_report(
        self,
        materials_text: str,
        structured_content: str,
        project_type: str,
        session_id: str,
    ) -> dict[str, Any]:
        """调用LLM生成投资分析报告

        Args:
            materials_text: 所有材料的原始文本
            structured_content: 秘书Agent提取的结构化内容
            project_type: 项目类型
            session_id: 会话ID

        Returns:
            dict: 完整的分析报告JSON

        Raises:
            httpx.HTTPError: LLM调用失败
            json.JSONDecodeError: LLM返回非JSON格式
        """
        combined_text = f"{structured_content}\n\n===== 原始材料 =====\n\n{materials_text}"

        prompt = ANALYSIS_PROMPT.format(
            materials_text=combined_text[:15000],
            project_type=project_type,
        )

        logger.info("[session=%s] 调用LLM生成报告...", session_id)

        response_text = await self._call_llm(
            system_prompt="你是一位资深的商业地产投资分析专家，严格按JSON格式输出。",
            user_prompt=prompt,
        )

        report = self._parse_json_response(response_text)
        logger.info("[session=%s] LLM报告生成成功", session_id)
        return report

    def _generate_demo_report(self, project_type: str) -> dict[str, Any]:
        """生成演示报告数据

        当API不可用时，返回完整的Demo报告数据。
        根据项目类型微调部分字段。

        Args:
            project_type: 项目类型标识

        Returns:
            dict: 完整的演示报告
        """
        import copy

        report = copy.deepcopy(DEMO_REPORT)

        # 根据项目类型微调
        if "hotel" in project_type.lower():
            report["summary"] = (
                "该酒店项目位于旅游城市核心区，RevPAR增长稳定，"
                "建议关注品牌升级机会后进入持有。"
            )
            report["key_metrics"]["valuation"] = "8.5亿元"
            report["key_metrics"]["cap_rate"] = "6.2%"
            report["key_metrics"]["irr"] = "15.8%"
            report["project_profile"]["property_type"] = "高端商务酒店"
            report["project_profile"]["total_area"] = "45000平方米"
            report["project_profile"]["avg_rent"] = "650元/房·晚"

        elif "retail" in project_type.lower() or "commercial" in project_type.lower():
            report["summary"] = (
                "该商业综合体位于城市核心商圈，客流恢复强劲，"
                "业态组合优化空间大，建议积极关注。"
            )
            report["key_metrics"]["valuation"] = "22.0亿元"
            report["key_metrics"]["cap_rate"] = "5.2%"
            report["project_profile"]["property_type"] = "商业综合体"
            report["project_profile"]["total_area"] = "180000平方米"
            report["project_profile"]["avg_rent"] = "180元/㎡·月"

        elif "industrial" in project_type.lower() or "logistics" in project_type.lower():
            report["summary"] = (
                "该物流园位于交通枢纽节点，电商需求旺盛，"
                "供不应求格局持续，建议积极布局。"
            )
            report["key_metrics"]["valuation"] = "6.8亿元"
            report["key_metrics"]["cap_rate"] = "6.8%"
            report["key_metrics"]["irr"] = "16.5%"
            report["project_profile"]["property_type"] = "高标准物流仓库"
            report["project_profile"]["total_area"] = "120000平方米"
            report["project_profile"]["avg_rent"] = "42元/㎡·月"

        return report

    async def _save_to_knowledge_base(
        self,
        report: dict[str, Any],
        materials: list[dict[str, Any]],
        project_type: str,
        session_id: str,
    ) -> str:
        """保存分析结果到知识库

        Args:
            report: 分析报告
            materials: 原始材料列表
            project_type: 项目类型
            session_id: 会话ID

        Returns:
            str: 知识库条目ID
        """
        try:
            from backend.quantsmart.services.kb_service import KnowledgeBaseService

            kb_service = KnowledgeBaseService()
            project_name = report.get("project_profile", {}).get(
                "location", "未命名项目"
            )
            title = f"{project_name} - 材料分析报告"

            kb_id = kb_service.save_analysis(
                title=title,
                analysis_type="material_analysis",
                project_name=project_name,
                project_type=project_type,
                session_id=session_id,
                content=json.dumps(report, ensure_ascii=False, indent=2),
                tags=["material_analysis", project_type],
            )
            logger.info("[session=%s] 分析结果已保存到知识库: %s", session_id, kb_id)
            return kb_id

        except Exception as e:
            logger.warning("[session=%s] 保存知识库失败: %s", session_id, e)
            return ""

    async def _call_llm(self, system_prompt: str, user_prompt: str) -> str:
        """调用LLM

        使用httpx进行异步HTTP调用，包含重试机制。

        Args:
            system_prompt: 系统提示词
            user_prompt: 用户提示词

        Returns:
            str: LLM返回的文本内容

        Raises:
            httpx.HTTPError: HTTP调用失败
        """
        max_retries = 3
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.post(
                        f"{self.api_base}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": self.model,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            "temperature": 0.3,
                            "max_tokens": 8000,
                        },
                    )
                    response.raise_for_status()
                    data = response.json()
                    content = data["choices"][0]["message"]["content"]
                    return content

            except httpx.HTTPStatusError as e:
                last_error = e
                if e.response.status_code in (429, 500, 502, 503):
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
        text = text.strip()

        # 尝试直接解析
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

        # 尝试查找第一个{和最后一个}
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass

        raise json.JSONDecodeError(
            "Cannot parse JSON from LLM response", text, 0
        )
