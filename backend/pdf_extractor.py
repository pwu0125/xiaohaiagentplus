#!/usr/bin/env python3
"""
pdf_extractor.py — 商业不动产PPT PDF信息提取器

从用户上传的PPT转PDF中提取结构化项目信息。
使用 pymupdf (fitz) 提取文本 → DeepSeek v4-pro LLM 解析为结构化JSON

流程:
  1. pymupdf 提取全文文本
  2. 截取前8000字送DeepSeek v4-pro解析
  3. 返回标准化JSON
"""
import json
import os
import re
import requests
from pathlib import Path
from typing import Optional, Dict, Any
import fitz  # pymupdf

# DeepSeek API配置
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
if not DEEPSEEK_API_KEY:
    try:
        with open('/tmp/deepseek_key.txt') as f:
            DEEPSEEK_API_KEY = f.read().strip()
    except Exception:
        pass
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-v4-pro"

EXTRACTION_PROMPT = """你是一个商业不动产数据提取专家。以下是从一个购物中心项目的PPT/PDF中提取的文本。请从中提取以下结构化信息：

1. **项目名称** — 购物中心的正式名称
2. **所在城市** — 项目所在城市
3. **商业面积** — 可租赁面积/商业建面（平方米）
4. **年化NOI** — 年化净运营收入（万元），如有多个年份取最新
5. **出租率** — 当前出租率（%）
6. **平均租金** — 平均月租金（元/平方米/月），如有多种业态取主力店均值
7. **土地剩余年限** — 土地使用权剩余年限（年）
8. **Cap Rate（如有）** — 如有披露项目的资本化率

请按以下JSON格式返回，缺失字段用null：
{
  "project_name": "项目名称",
  "city": "城市",
  "area_sqm": 数值或null,
  "annual_noi_wan": 数值或null,
  "occupancy_pct": 数值或null,
  "avg_rent_monthly": 数值或null,
  "land_years_remaining": 数值或null,
  "cap_rate": 数值或null
}

注意：
- 只提取文本中明确存在的数字，严禁编造
- 如果信息不明确，用null
- 面积单位如为"万㎡"请换算为平方米
- 租金如为日租金请标注"元/㎡/天"但数值保持原样

文本内容：
{text}
"""


def extract_text_from_pdf(pdf_path: str, max_chars: int = 8000) -> str:
    """用pymupdf提取PDF全文文本"""
    try:
        doc = fitz.open(pdf_path)
        text_parts = []
        total = 0
        for page in doc:
            page_text = page.get_text("text")
            if page_text.strip():
                text_parts.append(page_text)
                total += len(page_text)
                if total >= max_chars:
                    break
        doc.close()
        return "\n\n".join(text_parts)[:max_chars]
    except Exception as e:
        raise RuntimeError(f"PDF文本提取失败: {e}")


def parse_via_deepseek(text: str) -> Dict[str, Any]:
    """调用DeepSeek v4-pro解析结构化信息"""
    if not DEEPSEEK_API_KEY:
        # Fallback: 返回空骨架让用户手动填写
        return {
            "project_name": None,
            "city": None,
            "area_sqm": None,
            "annual_noi_wan": None,
            "occupancy_pct": None,
            "avg_rent_monthly": None,
            "land_years_remaining": None,
            "cap_rate": None,
            "extraction_error": "no_api_key",
        }

    prompt = EXTRACTION_PROMPT.replace("{text}", text[:6000])

    for attempt in range(2):
        try:
            resp = requests.post(
                f"{DEEPSEEK_BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.0,
                    "max_tokens": 1500,
                },
                timeout=30,
            )
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                json_match = re.search(r'\{[\s\S]*\}', content)
                if json_match:
                    parsed = json.loads(json_match.group())
                    parsed["extraction_error"] = None
                    return parsed
                return {"extraction_error": "no_json_in_response", "raw": content[:300]}
            elif resp.status_code == 429:
                import time
                time.sleep((attempt + 1) * 5)
            else:
                if attempt == 0:
                    import time
                    time.sleep(2)
        except Exception as e:
            if attempt == 0:
                import time
                time.sleep(2)

    return {"extraction_error": "api_failed"}


def extract_from_pdf(pdf_path: str) -> Dict[str, Any]:
    """
    主入口: 从PDF提取结构化项目信息
    
    Args:
        pdf_path: PDF文件路径
    
    Returns:
        dict: 包含项目参数 + extraction_status
    """
    text = extract_text_from_pdf(pdf_path)
    
    if not text.strip():
        return {
            "extraction_status": "failed",
            "extraction_error": "pdf_empty_text",
            "raw_text_preview": "",
        }
    
    structured = parse_via_deepseek(text)
    
    result = {
        "extraction_status": "ok" if not structured.get("extraction_error") else "partial",
        "extraction_error": structured.pop("extraction_error", None),
        "raw_text_preview": text[:500],
        "structured": structured,
    }
    return result


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python pdf_extractor.py <pdf_path>")
        sys.exit(1)
    
    result = extract_from_pdf(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
