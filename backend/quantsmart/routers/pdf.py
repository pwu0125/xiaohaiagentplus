"""PDF扫描路由

提供PDF文件的URL下载提取和本地上传提取功能。

端点：
    POST /api/pdf/extract-url  - 从URL下载PDF并提取文本
    POST /api/pdf/upload       - 上传PDF并提取文本
    POST /api/pdf/extract-images-url - 从URL下载PDF并提取图片
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from backend.quantsmart.services.pdf_service import PDFService, PDFServiceError
from backend.quantsmart.models import PDFExtractResponse, PDFUrlRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/pdf", tags=["PDF"])

# 共享的PDF服务实例
pdf_service = PDFService()


@router.post("/extract-url", response_model=PDFExtractResponse)
async def extract_pdf_from_url(request: PDFUrlRequest) -> dict[str, Any]:
    """从URL下载PDF并提取文本

    支持任意可访问的PDF链接，自动下载并解析文本内容。

    Args:
        request: 包含PDF URL的请求体

    Returns:
        包含 text(文本), pages(页数), chars(字符数) 的响应

    Raises:
        HTTPException: 下载失败或PDF解析失败
    """
    logger.info("[PDF] 从URL提取PDF: %s", request.url)
    try:
        result = await pdf_service.extract_from_url(request.url)
        logger.info(
            "[PDF] URL提取完成: %s | %d页, %d字符",
            request.url,
            result["pages"],
            result["chars"],
        )
        return result
    except PDFServiceError as exc:
        logger.error("[PDF] URL提取失败: %s | %s", request.url, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[PDF] URL提取异常: %s | %s", request.url, exc)
        raise HTTPException(
            status_code=500,
            detail=f"PDF处理异常: {exc}",
        ) from exc


@router.post("/upload", response_model=PDFExtractResponse)
async def upload_pdf(file: UploadFile = File(...)) -> dict[str, Any]:
    """上传PDF并提取文本

    接收multipart/form-data上传的PDF文件，返回提取的文本内容。

    Args:
        file: 上传的PDF文件

    Returns:
        包含 text(文本), pages(页数), chars(字符数), filename(文件名) 的响应

    Raises:
        HTTPException: 文件读取失败或PDF解析失败
    """
    logger.info("[PDF] 上传文件: %s | %s", file.filename, file.content_type)

    # 检查文件类型
    if file.content_type and file.content_type not in (
        "application/pdf",
        "application/octet-stream",
    ):
        if file.filename and not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {file.content_type}，请上传PDF文件",
            )

    try:
        content = await file.read()
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="上传的文件为空")

        result = await pdf_service.extract_from_upload(content, file.filename or "unknown.pdf")
        logger.info(
            "[PDF] 上传提取完成: %s | %d页, %d字符",
            file.filename,
            result["pages"],
            result["chars"],
        )
        return result
    except PDFServiceError as exc:
        logger.error("[PDF] 上传提取失败: %s | %s", file.filename, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("[PDF] 上传提取异常: %s | %s", file.filename, exc)
        raise HTTPException(
            status_code=500,
            detail=f"PDF处理异常: {exc}",
        ) from exc


@router.post("/extract-images-url")
async def extract_images_from_url(request: PDFUrlRequest) -> dict[str, Any]:
    """从URL下载PDF并提取图片

    提取PDF中嵌入的图片，以base64编码返回。

    Args:
        request: 包含PDF URL的请求体

    Returns:
        包含 images(图片列表) 的响应，每张图片有 page, width, height, format, data(base64)

    Raises:
        HTTPException: 下载失败或PDF解析失败
    """
    logger.info("[PDF] 从URL提取图片: %s", request.url)
    try:
        pdf_bytes = await pdf_service.download_from_url(request.url)
        images = pdf_service.extract_images(pdf_bytes)
        logger.info("[PDF] 图片提取完成: %s | %d张", request.url, len(images))
        return {"images": images, "count": len(images), "url": request.url}
    except PDFServiceError as exc:
        logger.error("[PDF] 图片提取失败: %s | %s", request.url, exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("[PDF] 图片提取异常: %s | %s", request.url, exc)
        raise HTTPException(
            status_code=500,
            detail=f"PDF图片提取异常: {exc}",
        ) from exc
