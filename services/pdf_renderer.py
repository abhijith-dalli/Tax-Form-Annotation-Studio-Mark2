from io import BytesIO

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from services.data_resolver import resolve_value
from services.formatter import format_value


def render_pdf(annotation_data, taxpayer_data, template_path, output_path):
    """
    Write resolved annotation values onto a PDF template.
    """

    template_pdf = PdfReader(template_path)
    writer = PdfWriter()

    for page_number, template_page in enumerate(template_pdf.pages):

        packet = BytesIO()

        page_width = float(template_page.mediabox.width)
        page_height = float(template_page.mediabox.height)

        pdf_canvas = canvas.Canvas(
            packet,
            pagesize=(page_width, page_height)
        )

        for field in annotation_data["fields"]:

            position = field["position"]

            if position["page"] != page_number + 1:
                continue

            raw_value = resolve_value(
                taxpayer_data,
                field["valuePath"]
            )

            formatted_value = format_value(
                raw_value,
                field["type"],
                field.get("format", {})
            )

            font_size = field.get("format", {}).get(
                "fontSize",
                10
            )

            alignment = field.get("format", {}).get(
                "alignment",
                "left"
            )

            pdf_canvas.setFont(
                "Helvetica",
                font_size
            )

            x = position["x"]
            y = page_height - position["y"]

            if alignment == "right":
                pdf_canvas.drawRightString(
                    x + position["width"],
                    y,
                    formatted_value
                )

            elif alignment == "center":
                pdf_canvas.drawCentredString(
                    x + position["width"] / 2,
                    y,
                    formatted_value
                )

            else:
                pdf_canvas.drawString(
                    x,
                    y,
                    formatted_value
                )

        pdf_canvas.save()

        packet.seek(0)

        overlay_pdf = PdfReader(packet)

        template_page.merge_page(
            overlay_pdf.pages[0]
        )

        writer.add_page(template_page)

    with open(output_path, "wb") as output_file:
        writer.write(output_file)