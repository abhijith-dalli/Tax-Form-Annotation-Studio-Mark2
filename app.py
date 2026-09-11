import json

from flask import Flask, jsonify

from services.data_resolver import resolve_value
from services.formatter import format_value

from flask import Flask, jsonify, render_template, send_file

from services.pdf_renderer import render_pdf

app = Flask(__name__)


def load_json_file(file_path):
    """Load and return JSON data from a file."""

    with open(file_path, "r") as file:
        return json.load(file)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/forms/1040/preview")
def preview_form():

    annotation_data = load_json_file(
        "data/annotation.json"
    )

    taxpayer_data = load_json_file(
        "data/taxpayer.json"
    )

    resolved_fields = []

    for field in annotation_data["fields"]:

        raw_value = resolve_value(
            taxpayer_data,
            field["valuePath"]
        )

        formatted_value = format_value(
            raw_value,
            field["type"],
            field.get("format", {})
        )

        resolved_fields.append({
            "id": field["id"],
            "label": field["label"],
            "value": formatted_value,
            "position": field["position"]
        })

    return jsonify({
        "form": annotation_data["form"],
        "fields": resolved_fields
    })


@app.route("/forms/1040/generate")
def generate_form():

    annotation_data = load_json_file(
        "data/annotation.json"
    )

    taxpayer_data = load_json_file(
        "data/taxpayer.json"
    )

    template_path = "templates/form_1040.pdf"
    output_path = "output/form_1040_completed.pdf"

    render_pdf(
        annotation_data,
        taxpayer_data,
        template_path,
        output_path
    )

    return send_file(
        output_path,
        as_attachment=True,
        download_name="form_1040_completed.pdf",
        mimetype="application/pdf"
    )

if __name__ == "__main__":
    app.run(debug=True)

