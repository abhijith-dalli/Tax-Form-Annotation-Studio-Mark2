SUPPORTED_FIELD_TYPES = ["text", "number", "currency", "date", "checkbox"]

REQUIRED_FIELD_PROPERTIES = ["id", "label", "type", "valuePath", "position"]
REQUIRED_POSITION_PROPERTIES = ["page", "x", "y", "width", "height"]


def validate_annotation(annotation_data, pdf_metadata=None):
    errors = []
    warnings = []

    if "form" not in annotation_data:
        errors.append({
            "fieldId": None,
            "type": "missing_form",
            "message": "Missing 'form' metadata"
        })

    if "fields" not in annotation_data:
        errors.append({
            "fieldId": None,
            "type": "missing_fields",
            "message": "Missing 'fields' array"
        })
        return {"valid": False, "errors": errors, "warnings": warnings}

    fields = annotation_data["fields"]

    if not isinstance(fields, list):
        errors.append({
            "fieldId": None,
            "type": "invalid_fields",
            "message": "'fields' must be an array"
        })
        return {"valid": False, "errors": errors, "warnings": warnings}

    seen_ids = set()

    for field in fields:
        field_id = field.get("id", "<unknown>")

        for prop in REQUIRED_FIELD_PROPERTIES:
            if prop not in field:
                errors.append({
                    "fieldId": field_id,
                    "type": "missing_property",
                    "message": f"Missing required property '{prop}'"
                })

        if "id" in field:
            if field["id"] in seen_ids:
                errors.append({
                    "fieldId": field["id"],
                    "type": "duplicate_id",
                    "message": f"Duplicate field ID: '{field['id']}'"
                })
            seen_ids.add(field["id"])

        if "type" in field and field["type"] not in SUPPORTED_FIELD_TYPES:
            errors.append({
                "fieldId": field_id,
                "type": "unsupported_type",
                "message": f"Unsupported field type: '{field['type']}'. Supported: {', '.join(SUPPORTED_FIELD_TYPES)}"
            })

        if "valuePath" in field:
            path = field["valuePath"]
            if not isinstance(path, str) or not path.strip():
                errors.append({
                    "fieldId": field_id,
                    "type": "invalid_value_path",
                    "message": "valuePath must be a non-empty string"
                })

        if "position" in field:
            pos = field["position"]
            for prop in REQUIRED_POSITION_PROPERTIES:
                if prop not in pos:
                    errors.append({
                        "fieldId": field_id,
                        "type": "missing_position",
                        "message": f"Missing position property '{prop}'"
                    })
                elif not isinstance(pos[prop], (int, float)):
                    errors.append({
                        "fieldId": field_id,
                        "type": "invalid_position",
                        "message": f"Position property '{prop}' must be a number"
                    })

            if pdf_metadata and "page" in pos:
                if pos["page"] < 1 or pos["page"] > pdf_metadata.get("page_count", 1):
                    errors.append({
                        "fieldId": field_id,
                        "type": "invalid_page",
                        "message": f"Page {pos['page']} is out of range (PDF has {pdf_metadata.get('page_count', 1)} pages)"
                    })

            if pdf_metadata and "page" in pos and "x" in pos and "y" in pos:
                page_num = pos["page"]
                pages = pdf_metadata.get("pages", {})
                page_info = pages.get(str(page_num), {})
                page_width = page_info.get("width", 612)
                page_height = page_info.get("height", 792)

                if pos.get("x", 0) < 0 or pos.get("x", 0) > page_width:
                    warnings.append({
                        "fieldId": field_id,
                        "type": "position_out_of_bounds",
                        "message": f"x={pos['x']} may be outside page {page_num} bounds (width={page_width})"
                    })
                if pos.get("y", 0) < 0 or pos.get("y", 0) > page_height:
                    warnings.append({
                        "fieldId": field_id,
                        "type": "position_out_of_bounds",
                        "message": f"y={pos['y']} may be outside page {page_num} bounds (height={page_height})"
                    })

        if "format" in field and "type" in field:
            fmt = field["format"]
            ftype = field["type"]

            if ftype == "currency" and "currency" in fmt:
                if fmt["currency"] not in ["USD", "EUR", "GBP"]:
                    errors.append({
                        "fieldId": field_id,
                        "type": "invalid_format",
                        "message": f"Unsupported currency: '{fmt['currency']}'"
                    })

            if ftype == "date" and "dateFormat" in fmt:
                valid_formats = ["MM/DD/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]
                if fmt["dateFormat"] not in valid_formats:
                    warnings.append({
                        "fieldId": field_id,
                        "type": "uncommon_date_format",
                        "message": f"Date format '{fmt['dateFormat']}' is not a common format. Common: {', '.join(valid_formats)}"
                    })

        if "visibleWhen" in field and field["visibleWhen"] is not None:
            vw = field["visibleWhen"]
            if "path" not in vw or "equals" not in vw:
                errors.append({
                    "fieldId": field_id,
                    "type": "invalid_condition",
                    "message": "visibleWhen must have 'path' and 'equals' properties"
                })

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "field_count": len(fields),
        "error_count": len(errors),
        "warning_count": len(warnings)
    }
