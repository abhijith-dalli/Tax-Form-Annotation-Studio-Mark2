import json
import os
import uuid

from flask import Flask, jsonify, render_template, request, send_file

from services.data_resolver import resolve_value, resolve_value_safe, is_field_visible
from services.formatter import format_value
from services.pdf_renderer import render_pdf
from services.pdf_to_image import get_pdf_metadata, pdf_page_to_image
from services.validator import validate_annotation

app = Flask(__name__)

ANNOTATION_FILE = "data/annotation.json"
TAXPAYER_FILE = "data/taxpayer.json"
UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("output", exist_ok=True)


def get_active_pdf_path():
    meta_file = os.path.join(UPLOAD_DIR, "current.json")
    if os.path.exists(meta_file):
        with open(meta_file, "r") as f:
            meta = json.load(f)
            pdf_path = meta.get("pdf_path")
            if pdf_path and os.path.exists(pdf_path):
                return pdf_path
    return None


def get_pdf_metadata_file():
    meta_file = os.path.join(UPLOAD_DIR, "current.json")
    if os.path.exists(meta_file):
        with open(meta_file, "r") as f:
            return json.load(f)
    return {}


def save_pdf_metadata(meta):
    meta_file = os.path.join(UPLOAD_DIR, "current.json")
    with open(meta_file, "w") as f:
        json.dump(meta, f, indent=2)


def load_json(file_path):
    with open(file_path, "r") as f:
        return json.load(f)


def save_json(file_path, data):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/pdf/upload", methods=["POST"])
def upload_pdf():
    if "pdf" not in request.files:
        return jsonify({"error": "No PDF file provided"}), 400

    pdf_file = request.files["pdf"]

    if not pdf_file.filename:
        return jsonify({"error": "No file selected"}), 400

    if not pdf_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "File must be a PDF"}), 400

    filename = f"{uuid.uuid4().hex}.pdf"
    pdf_path = os.path.join(UPLOAD_DIR, filename)
    pdf_file.save(pdf_path)

    try:
        metadata = get_pdf_metadata(pdf_path)
    except Exception as e:
        os.remove(pdf_path)
        return jsonify({"error": f"Invalid PDF: {str(e)}"}), 400

    form_meta = {
        "pdf_path": pdf_path,
        "original_filename": pdf_file.filename,
        "stored_filename": filename,
        "pdf_metadata": metadata
    }

    save_pdf_metadata(form_meta)

    return jsonify({
        "status": "ok",
        "filename": pdf_file.filename,
        "pdf_metadata": metadata
    })


@app.route("/api/pdf/metadata", methods=["GET"])
def get_current_pdf_metadata():
    meta = get_pdf_metadata_file()
    if not meta:
        return jsonify({"loaded": False, "page_count": 0, "pages": {}})

    pdf_path = meta.get("pdf_path")
    if not pdf_path or not os.path.exists(pdf_path):
        return jsonify({"loaded": False, "page_count": 0, "pages": {}})

    return jsonify({
        "loaded": True,
        "filename": meta.get("original_filename", ""),
        "page_count": meta["pdf_metadata"]["page_count"],
        "pages": meta["pdf_metadata"]["pages"]
    })


@app.route("/api/pdf/metadata", methods=["POST"])
def update_pdf_metadata():
    data = request.get_json()

    annotation = load_json(ANNOTATION_FILE)
    annotation["form"] = {
        "id": data.get("formId", "custom"),
        "name": data.get("formName", "Custom Tax Form"),
        "version": data.get("formVersion", "2025")
    }
    save_json(ANNOTATION_FILE, annotation)

    meta = get_pdf_metadata_file()
    if meta:
        meta["form"] = annotation["form"]
        save_pdf_metadata(meta)

    return jsonify({"status": "ok", "form": annotation["form"]})


@app.route("/api/annotations", methods=["GET"])
def get_annotations():
    data = load_json(ANNOTATION_FILE)
    return jsonify(data)


@app.route("/api/annotations", methods=["POST"])
def save_annotations():
    data = request.get_json()
    save_json(ANNOTATION_FILE, data)
    return jsonify({"status": "ok"})


@app.route("/api/annotations/validate", methods=["POST"])
def validate_annotations():
    data = request.get_json()

    pdf_path = get_active_pdf_path()
    pdf_metadata = None
    if pdf_path:
        try:
            pdf_metadata = get_pdf_metadata(pdf_path)
        except Exception:
            pass

    result = validate_annotation(data, pdf_metadata)
    return jsonify(result)


@app.route("/api/taxpayer", methods=["GET"])
def get_taxpayer():
    data = load_json(TAXPAYER_FILE)
    return jsonify(data)


@app.route("/api/pdf/page/<int:page_num>", methods=["GET"])
def get_pdf_page(page_num):
    pdf_path = get_active_pdf_path()

    if not pdf_path:
        return jsonify({"error": "No PDF loaded"}), 404

    image_b64 = pdf_page_to_image(pdf_path, page_num)

    if image_b64 is None:
        return jsonify({"error": "Failed to render page"}), 500

    return jsonify({"page": page_num, "image": image_b64})


@app.route("/api/resolve/<field_id>", methods=["GET"])
def resolve_field(field_id):
    data = load_json(ANNOTATION_FILE)
    taxpayer = load_json(TAXPAYER_FILE)

    for field in data.get("fields", []):
        if field["id"] == field_id:
            raw_value, error = resolve_value_safe(taxpayer, field["valuePath"])

            if error:
                return jsonify({
                    "id": field_id,
                    "raw": None,
                    "formatted": "",
                    "error": error
                })

            formatted = format_value(raw_value, field["type"], field.get("format", {}))

            return jsonify({
                "id": field_id,
                "raw": raw_value,
                "formatted": formatted,
                "error": None
            })

    return jsonify({"error": "Field not found"}), 404


@app.route("/api/resolve/all", methods=["GET"])
def resolve_all():
    data = load_json(ANNOTATION_FILE)
    taxpayer = load_json(TAXPAYER_FILE)

    resolved = []

    for field in data.get("fields", []):
        visible = is_field_visible(field, taxpayer)

        if not visible:
            resolved.append({
                "id": field["id"],
                "raw": None,
                "formatted": "",
                "visible": False,
                "error": None
            })
            continue

        raw_value, error = resolve_value_safe(taxpayer, field["valuePath"])

        if error:
            resolved.append({
                "id": field["id"],
                "raw": None,
                "formatted": "",
                "visible": True,
                "error": error
            })
            continue

        formatted = format_value(raw_value, field["type"], field.get("format", {}))

        resolved.append({
            "id": field["id"],
            "raw": raw_value,
            "formatted": formatted,
            "visible": True,
            "error": None
        })

    return jsonify({"fields": resolved})


@app.route("/forms/1040/preview")
def preview_form():
    data = load_json(ANNOTATION_FILE)
    taxpayer = load_json(TAXPAYER_FILE)

    resolved_fields = []

    for field in data["fields"]:
        visible = is_field_visible(field, taxpayer)

        if not visible:
            resolved_fields.append({
                "id": field["id"],
                "label": field["label"],
                "value": "",
                "position": field["position"],
                "visible": False
            })
            continue

        raw_value = resolve_value(taxpayer, field["valuePath"])
        formatted = format_value(raw_value, field["type"], field.get("format", {}))

        resolved_fields.append({
            "id": field["id"],
            "label": field["label"],
            "value": formatted,
            "position": field["position"],
            "visible": True
        })

    return jsonify({
        "form": data["form"],
        "fields": resolved_fields
    })


@app.route("/forms/1040/generate")
def generate_form():
    annotation_data = load_json(ANNOTATION_FILE)
    taxpayer_data = load_json(TAXPAYER_FILE)

    pdf_path = get_active_pdf_path()
    if not pdf_path:
        return jsonify({"error": "No PDF loaded"}), 400

    form_id = annotation_data.get("form", {}).get("id", "form")
    output_filename = f"{form_id}_completed.pdf"
    output_path = os.path.join("output", output_filename)

    os.makedirs("output", exist_ok=True)

    render_pdf(annotation_data, taxpayer_data, pdf_path, output_path)

    return send_file(
        output_path,
        as_attachment=True,
        download_name=output_filename,
        mimetype="application/pdf"
    )


if __name__ == "__main__":
    app.run(debug=True, port=8080)
