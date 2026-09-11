from io import BytesIO

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas

from services.data_resolver import resolve_value_safe, is_field_visible
from services.formatter import format_value


def render_pdf(annotation_data, taxpayer_data, template_path, output_path):
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

            if not is_field_visible(field, taxpayer_data):
                continue

            raw_value, error = resolve_value_safe(
                taxpayer_data,
                field["valuePath"]
            )

            if error or raw_value is None:
                continue

            formatted_value = format_value(
                raw_value,
                field["type"],
                field.get("format", {})
            )

            if not formatted_value:
                continue

            field_type = field.get("type", "text")
            fmt = field.get("format", {})
            font_size = fmt.get("fontSize", 10)
            alignment = fmt.get("alignment", "left")

            pdf_canvas.setFont("Helvetica", font_size)

            x = position["x"]
            y = page_height - position["y"]

            if field_type == "checkbox":
                draw_checkbox(pdf_canvas, x, y, position, formatted_value)
            elif alignment == "right":
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
                pdf_canvas.drawString(x, y, formatted_value)

        pdf_canvas.save()

        packet.seek(0)

        overlay_pdf = PdfReader(packet)

        template_page.merge_page(
            overlay_pdf.pages[0]
        )

        writer.add_page(template_page)

    with open(output_path, "wb") as output_file:
        writer.write(output_file)


def draw_checkbox(pdf_canvas, x, y, position, formatted_value):
    box_size = min(position["width"], position["height"]) * 0.6
    box_x = x + (position["width"] - box_size) / 2
    box_y = y - box_size / 2

    pdf_canvas.rect(box_x, box_y, box_size, box_size)

    if "\u2611" in formatted_value:
        pdf_canvas.setFont("Helvetica", box_size * 0.8)
        pdf_canvas.drawCentredString(
            box_x + box_size / 2,
            box_y + box_size * 0.15,
            "X"
        )
