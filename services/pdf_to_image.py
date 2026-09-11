import base64
import io
import os
import tempfile

from pdf2image import convert_from_path
from pypdf import PdfReader


def get_pdf_metadata(pdf_path):
    reader = PdfReader(pdf_path)
    page_count = len(reader.pages)
    pages = {}

    for i, page in enumerate(reader.pages):
        box = page.mediabox
        pages[str(i + 1)] = {
            "width": float(box.width),
            "height": float(box.height)
        }

    return {
        "page_count": page_count,
        "pages": pages
    }


def pdf_page_to_image(pdf_path, page_number, dpi=150):
    images = convert_from_path(
        pdf_path,
        first_page=page_number,
        last_page=page_number,
        dpi=dpi
    )

    if not images:
        return None

    image = images[0]

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)

    return base64.b64encode(buffer.read()).decode("utf-8")


def pdf_all_pages_to_images(pdf_path, dpi=100):
    images = convert_from_path(pdf_path, dpi=dpi)
    result = []

    for i, image in enumerate(images):
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        b64 = base64.b64encode(buffer.read()).decode("utf-8")
        result.append({
            "page": i + 1,
            "image": b64
        })

    return result
