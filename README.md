# Tax Form Annotation Studio — Mark 2

A visual tool for creating, editing, validating, previewing, and exporting tax-form annotations.

The **Annotation Specification** is the core of this project. The Annotation Studio is a tool built around that specification, demonstrating that it is practical and can be used by an application.

## What Is an Annotation?

An annotation is a JSON structure that describes where a data field belongs on a tax form PDF. It connects a location on the PDF to a path in taxpayer data, specifying how the value should be displayed.

The annotation does not contain actual values. It contains instructions for finding and formatting values.

## Why This Specification Exists

Tax forms have fixed layouts. Taxpayer data changes for every return. The annotation specification bridges these two concerns:

1. **Separation** — Annotation layout is separate from taxpayer data.
2. **Reusability** — One annotation works with many taxpayer records.
3. **Portability** — The exported JSON can be consumed by any renderer in any language.
4. **Extensibility** — New field types and formatting options can be added without breaking existing annotations.

## Annotation Structure

A complete annotation file:

```json
{
  "form": {
    "id": "1040",
    "name": "U.S. Individual Income Tax Return",
    "version": "2025"
  },
  "fields": [
    {
      "id": "wages",
      "label": "Wages",
      "type": "currency",
      "valuePath": "taxReturn.income.wages",
      "position": {
        "page": 1,
        "x": 400,
        "y": 600,
        "width": 100,
        "height": 20
      },
      "format": {
        "fontSize": 10,
        "alignment": "right",
        "currency": "USD",
        "decimalPlaces": 2
      }
    }
  ]
}
```

### Form Metadata

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Identifier for the tax form (e.g., "1040") |
| `name` | string | Human-readable form name |
| `version` | string | Form version year |

### Field Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | yes | Unique identifier for this field |
| `label` | string | yes | Human-readable label |
| `type` | string | yes | Field type (see Field Types) |
| `valuePath` | string | yes | Dot-notation path to the value in taxpayer data |
| `position` | object | yes | Location on the PDF (see Position) |
| `format` | object | no | Formatting options (see Formatting) |
| `validation` | object | no | Validation rules (see Validation) |
| `visibleWhen` | object | no | Conditional visibility (see Conditional Fields) |

## Field Types

| Type | Description | Example Value | Formatted Output |
|------|-------------|---------------|------------------|
| `text` | Plain text | `"John"` | `John` |
| `number` | Numeric value | `85000` | `85,000` |
| `currency` | Monetary value | `85000` | `$85,000.00` |
| `date` | Date value | `"1985-06-15"` | `06/15/1985` |
| `checkbox` | Boolean/checkbox | `true` | `☑` |

Additional field types can be added by extending `services/formatter.py`.

## Position

Each field has a `position` object:

```json
{
  "page": 1,
  "x": 400,
  "y": 600,
  "width": 100,
  "height": 20
}
```

| Property | Type | Description |
|----------|------|-------------|
| `page` | integer | Page number (1-based) |
| `x` | number | Horizontal position from left edge |
| `y` | number | Vertical position from top edge |
| `width` | number | Width of the field box |
| `height` | number | Height of the field box |

### Coordinate System

- **Units**: PDF points (1 point = 1/72 inch)
- **Origin**: Top-left corner of the page
- **X axis**: Increases from left to right
- **Y axis**: Increases from top to bottom
- **Page numbers**: 1-based (first page is page 1)

This differs from the standard PDF coordinate system (bottom-left origin). The renderer converts top-left coordinates to bottom-left when writing values.

## Formatting

The `format` object controls how values are displayed:

### Common Options

| Property | Types | Description |
|----------|-------|-------------|
| `font` | all | Font name (default: "Helvetica") |
| `fontSize` | all | Font size in points (default: 10) |
| `alignment` | all | Text alignment: "left", "center", "right" |
| `prefix` | text | Text before the value |
| `suffix` | text | Text after the value |

### Currency Options

| Property | Description |
|----------|-------------|
| `currency` | Currency code: "USD", "EUR", "GBP" |
| `decimalPlaces` | Decimal places (default: 2) |

### Number Options

| Property | Description |
|----------|-------------|
| `decimalPlaces` | Decimal places (default: 0) |
| `thousandsSeparator` | Show commas (default: true) |

### Date Options

| Property | Description |
|----------|-------------|
| `dateFormat` | Format pattern: "MM/DD/YYYY", "YYYY-MM-DD", "DD/MM/YYYY" |

### Checkbox Options

Checkboxes render as `☑` (checked) or `☐` (unchecked) using Unicode characters.

## valuePath Resolution

The `valuePath` uses dot notation to traverse nested JSON data.

Given taxpayer data:

```json
{
  "taxReturn": {
    "income": {
      "wages": 85000
    }
  }
}
```

The path `taxReturn.income.wages` resolves to `85000`.

The resolver walks each key:

1. Start at the root object
2. Split path by `.`
3. For each key, access the property
4. Return the final value

If a key is missing, resolution fails gracefully (returns null with an error).

## Validation

The validator checks annotations for correctness:

### Required Checks

- Form metadata present
- Each field has `id`, `label`, `type`, `valuePath`, `position`
- No duplicate field IDs
- Field type is supported
- Position has all required properties (`page`, `x`, `y`, `width`, `height`)

### Optional Checks (with PDF metadata)

- Page number exists in the PDF
- Coordinates are within page bounds

### Format Checks

- Currency code is supported
- Date format is a recognized pattern

### Validation Result

```json
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "field_count": 12,
  "error_count": 0,
  "warning_count": 0
}
```

## Conditional Fields

Fields can have a `visibleWhen` property for conditional visibility:

```json
{
  "id": "spouseFirstName",
  "valuePath": "taxReturn.spouse.name.first",
  "visibleWhen": {
    "path": "taxReturn.filingStatus",
    "equals": "married"
  }
}
```

The field is only rendered when the condition is true:

1. Resolve the value at `path`
2. Compare it to `equals`
3. If equal, the field is visible
4. If not equal, the field is skipped

This is intentionally simple. It does not support operators, nested conditions, or complex logic.

## Example Annotation

```json
{
  "form": {
    "id": "1040",
    "name": "U.S. Individual Income Tax Return",
    "version": "2025"
  },
  "fields": [
    {
      "id": "filingStatus",
      "label": "Filing Status",
      "type": "text",
      "valuePath": "taxReturn.filingStatus",
      "position": { "page": 1, "x": 100, "y": 80, "width": 200, "height": 20 },
      "format": { "fontSize": 10, "alignment": "left" }
    },
    {
      "id": "taxpayerFirstName",
      "label": "First Name",
      "type": "text",
      "valuePath": "taxReturn.taxpayer.name.first",
      "position": { "page": 1, "x": 100, "y": 150, "width": 150, "height": 20 },
      "format": { "fontSize": 10, "alignment": "left" }
    },
    {
      "id": "wages",
      "label": "Wages",
      "type": "currency",
      "valuePath": "taxReturn.income.wages",
      "position": { "page": 1, "x": 400, "y": 600, "width": 100, "height": 20 },
      "format": { "fontSize": 10, "alignment": "right", "currency": "USD", "decimalPlaces": 2 }
    },
    {
      "id": "spouseFirstName",
      "label": "Spouse First Name",
      "type": "text",
      "valuePath": "taxReturn.spouse.name.first",
      "position": { "page": 1, "x": 100, "y": 220, "width": 150, "height": 20 },
      "format": { "fontSize": 10, "alignment": "left" },
      "visibleWhen": { "path": "taxReturn.filingStatus", "equals": "married" }
    }
  ]
}
```

## Example Taxpayer Data

```json
{
  "taxReturn": {
    "filingStatus": "married",
    "taxpayer": {
      "name": { "first": "John", "last": "Smith" },
      "ssn": "123-45-6789",
      "dateOfBirth": "1985-06-15"
    },
    "spouse": {
      "name": { "first": "Jane", "last": "Smith" },
      "ssn": "987-65-4321"
    },
    "income": {
      "wages": 85000,
      "interest": 1250.50,
      "dividends": 450.75,
      "total": 86701.25
    },
    "deductions": {
      "standard": true
    }
  }
}
```

## How Annotations Map Data to PDF

The flow from annotation to completed PDF:

```
annotation.json  +  taxpayer.json
        |                |
        v                v
   data_resolver  (finds values using valuePath)
        |
        v
   formatter      (converts values to display strings)
        |
        v
   pdf_renderer   (positions strings on the PDF)
        |
        v
   completed PDF
```

Each field:
1. Checks if it should be visible (conditional visibility)
2. Resolves its value from taxpayer data
3. Formats the value according to its type and format options
4. Draws the formatted value at the specified position on the PDF

## How Another Developer Can Implement a Renderer

The annotation specification is implementation-agnostic. To build a renderer in any language:

1. **Parse** the annotation JSON
2. **Load** the taxpayer data
3. **For each field**:
   - Check `visibleWhen` — skip if condition is false
   - Resolve `valuePath` against taxpayer data
   - Format the value based on `type` and `format`
   - Position the value at `position.x`, `position.y` on the specified `position.page`
4. **Apply** font, size, and alignment from `format`
5. **Write** to PDF (or any other output format)

The renderer does not need knowledge of specific tax fields. It works entirely from the annotation specification.

### Python Example

```python
import json
from reportlab.pdfgen import canvas

def render(annotation, taxpayer_data, output_path):
    for field in annotation["fields"]:
        value = resolve_path(taxpayer_data, field["valuePath"])
        text = format_value(value, field["type"], field["format"])
        pos = field["position"]

        c = canvas.Canvas(output_path)
        c.setFont("Helvetica", field["format"]["fontSize"])
        c.drawString(pos["x"], pos["y"], text)
    c.save()
```

### Key Principle

The annotation is the contract. Any renderer that follows the specification will produce the same output.

## Running the Annotation Studio

### Prerequisites

- Python 3.8+
- poppler (for PDF-to-image conversion)

Install poppler on macOS:

```bash
brew install poppler
```

Install poppler on Ubuntu:

```bash
sudo apt-get install poppler-utils
```

### Install Dependencies

```bash
python3 -m pip install -r requirements.txt
```

### Run the Application

```bash
python3 app.py
```

Open in browser:

```
http://127.0.0.1:5000
```

## How to Generate a PDF

1. Open the Annotation Studio
2. Upload a tax form PDF (or use an existing one)
3. Add and configure annotation fields
4. Click **Generate PDF**
5. The completed PDF downloads automatically

The PDF renderer:
1. Loads the uploaded PDF
2. Reads the annotation
3. Resolves values from taxpayer data
4. Applies formatting
5. Applies conditional visibility
6. Positions values on the PDF
7. Saves and serves the completed PDF

## How to Export an Annotation

1. Open the Annotation Studio
2. Create or modify annotations
3. Click **Export JSON**
4. A modal displays the JSON
5. Click **Copy to Clipboard** to copy

The exported JSON is standalone. It contains no references to the Annotation Studio. Another developer can use it with any renderer.

## Project Structure

```
Tax-Form-Annotation-Studio-Mark2/
|
+-- data/
|   +-- annotation.json       (annotation specification)
|   +-- taxpayer.json          (sample taxpayer data)
|
+-- models/
|   +-- annotation.py          (data classes for type hints)
|
+-- services/
|   +-- data_resolver.py       (resolves valuePath to values)
|   +-- formatter.py           (formats values for display)
|   +-- validator.py           (validates annotations)
|   +-- pdf_renderer.py        (writes values onto PDF)
|   +-- pdf_to_image.py        (converts PDF pages to images)
|
+-- templates/
|   +-- index.html             (Annotation Studio UI)
|
+-- static/
|   +-- css/
|   |   +-- style.css          (application styles)
|   +-- js/
|       +-- app.js             (main application logic)
|       +-- pdf-viewer.js      (PDF page rendering)
|
+-- uploads/                   (uploaded PDFs, git-ignored)
+-- output/                    (generated PDFs, git-ignored)
|
+-- app.py                     (Flask application)
+-- requirements.txt
+-- README.md
```

## Current Limitations

- Font selection is limited to Helvetica
- No support for multi-line text wrapping
- No support for rotation
- Checkbox rendering uses Unicode characters, not form field widgets
- Conditional visibility supports only simple equality checks
- No support for computed fields or formulas
- No undo/redo in the visual editor
- Single-session application (no persistence beyond JSON files)

## Possible Future Extensions

- **Field Validation** — Add validation rules (required, min/max values, regex patterns) to annotations with UI in the Annotation Studio
- **Conditional Visibility UI** — Show/hide fields based on other field values (e.g., show spouse fields only when filing status is "married")
- Support for additional field types (phone, email, SSN with masking)
- Rich text formatting (bold, italic)
- Multiple font support
- Form field widgets for checkboxes
- Complex conditional logic (AND, OR, comparisons)
- Computed fields (e.g., total = wages + interest)
- Multi-page annotations
- Annotation templates for common form patterns
- Collaborative editing
- Version history for annotations
- Import from PDF form fields
- Support for other output formats (HTML, CSV, XML)
