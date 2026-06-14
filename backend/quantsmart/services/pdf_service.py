"""PDF处理服务

提供PDF下载、文本提取和图片提取功能。
使用PyMuPDF(fitz)作为PDF处理引擎。
"""

from __future__ import annotations

import logging
from io import BytesIO
from typing import Any, Optional

import httpx

try:
    import fitz  # PyMuPDF

    HAS_FITZ = True
except ImportError:
    HAS_FITZ = False

logger = logging.getLogger(__name__)


class PDFServiceError(Exception):
    """PDF服务异常"""

    pass


class PDFService:
    """PDF处理服务

    提供PDF文件的下载、文本提取和图片提取功能。

    Example:
        >>> service = PDFService()
        >>> result = await service.extract_from_url("https://example.com/file.pdf")
        >>> print(result["text"][:100])
    """

    def __init__(self) -> None:
        if not HAS_FITZ:
            logger.warning(
                "PyMuPDF(fitz) 未安装，PDF功能将不可用。"
                "请运行: pip install pymupdf"
            )

    async def download_from_url(self, url: str, timeout: float = 30.0) -> bytes:
        """从URL下载PDF文件

        Args:
            url: PDF文件的URL
            timeout: 下载超时时间（秒）

        Returns:
            PDF文件的字节内容

        Raises:
            PDFServiceError: 下载失败
        """
        logger.info("[PDFService] 开始下载PDF: %s", url)
        try:
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                pdf_bytes = response.content
                logger.info(
                    "[PDFService] 下载完成: %s | 大小: %.2f KB",
                    url,
                    len(pdf_bytes) / 1024,
                )
                return pdf_bytes
        except httpx.HTTPStatusError as exc:
            logger.error(
                "[PDFService] 下载HTTP错误 %s: %s",
                exc.response.status_code,
                url,
            )
            raise PDFServiceError(
                f"下载PDF失败，HTTP {exc.response.status_code}: {url}"
            ) from exc
        except httpx.RequestError as exc:
            logger.error("[PDFService] 下载请求错误: %s | %s", url, exc)
            raise PDFServiceError(f"下载PDF请求失败: {url}") from exc

    def extract_text(self, pdf_bytes: bytes) -> dict[str, Any]:
        """从PDF字节中提取文本

        Args:
            pdf_bytes: PDF文件的字节内容

        Returns:
            包含 text, pages, chars 的字典

        Raises:
            PDFServiceError: PDF处理失败
        """
        if not HAS_FITZ:
            raise PDFServiceError(
                "PyMuPDF(fitz) 未安装，无法提取PDF文本。"
                "请运行: pip install pymupdf"
            )

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text_parts: list[str] = []
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_text = page.get_text()
                text_parts.append(page_text)
            doc.close()

            full_text = "\n\n".join(text_parts)
            result = {
                "text": full_text,
                "pages": len(text_parts),
                "chars": len(full_text),
            }
            logger.info(
                "[PDFService] 文本提取完成: %d 页, %d 字符",
                result["pages"],
                result["chars"],
            )
            return result
        except Exception as exc:
            logger.error("[PDFService] PDF文本提取失败: %s", exc)
            raise PDFServiceError(f"PDF文本提取失败: {exc}") from exc

    def extract_images(
        self,
        pdf_bytes: bytes,
        min_width: int = 100,
        min_height: int = 100,
    ) -> list[dict[str, Any]]:
        """从PDF字节中提取图片

        Args:
            pdf_bytes: PDF文件的字节内容
            min_width: 图片最小宽度过滤
            min_height: 图片最小高度过滤

        Returns:
            图片信息列表，每项包含 page, width, height, format, data(base64)

        Raises:
            PDFServiceError: PDF处理失败
        """
        if not HAS_FITZ:
            raise PDFServiceError(
                "PyMuPDF(fitz) 未安装，无法提取PDF图片。"
                "请运行: pip install pymupdf"
            )

        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            images: list[dict[str, Any]] = []
            import base64

            for page_num in range(len(doc)):
                page = doc[page_num]
                img_list = page.get_images(full=True)
                for img_idx, img in enumerate(img_list):
                    xref = img[0]
                    pix = fitz.Pixmap(doc, xref)
                    if pix.width < min_width or pix.height < min_height:
                        pix = None
                        continue
                    if pix.n < 5:
                        img_data = pix.tobytes("png")
                    else:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                        img_data = pix.tobytes("png")
                    images.append({
                        "page": page_num + 1,
                        "width": pix.width,
                        "height": pix.height,
                        "format": "png",
                        "data": base64.b64encode(img_data).decode("utf-8"),
                    })
                    pix = None

            doc.close()
            logger.info("[PDFService] 图片提取完成: %d 张", len(images))
            return images
        except Exception as exc:
            logger.error("[PDFService] PDF图片提取失败: %s", exc)
            raise PDFServiceError(f"PDF图片提取失败: {exc}") from exc

    async def extract_from_url(self, url: str) -> dict[str, Any]:
        """从URL下载PDF并提取文本

        Args:
            url: PDF文件的URL

        Returns:
            包含 text, pages, chars 的字典
        """
        pdf_bytes = await self.download_from_url(url)
        result = self.extract_text(pdf_bytes)
        result["url"] = url
        return result

    async def extract_from_upload(self, file_content: bytes, filename: str) -> dict[str, Any]:
        """从上传的文件内容提取文本

        Args:
            file_content: 文件字节内容
            filename: 文件名

        Returns:
            包含 text, pages, chars, filename 的字典
        """
        result = self.extract_text(file_content)
        result["filename"] = filename
        return result
