# Tax System Annotations

This project is a small Flask application that demonstrates how tax form fields can be defined using an annotation structure and then populated with data.

The main idea is to keep the tax form annotation separate from the actual taxpayer data.

## Project Structure

```text
TAX SYSTEM ANNOTATIONS/
│
├── data/
│   ├── annotation.json
│   └── taxpayer.json
│
├── models/
│   └── annotation.py
│
├── services/
│   ├── data_resolver.py
│   ├── formatter.py
│   └── pdf_renderer.py
│
├── templates/
│   ├── index.html
│   └── form_1040.pdf
│
├── output/
│   └── form_1040_completed.pdf
│
├── app.py
├── requirements.txt
└── README.md
```

## How the annotation works

The annotation is stored in `data/annotation.json`.

Each field contains:

- `id` - unique name for the field
- `label` - field description
- `type` - type of value, such as text or currency
- `valuePath` - path to find the value in the taxpayer data
- `position` - location of the field on the PDF
- `format` - how the value should be displayed

Example:

```json
{
  "id": "wages",
  "label": "Wages",
  "type": "currency",
  "valuePath": "taxReturn.income.wages",
  "position": {
    "page": 1,
    "x": 450,
    "y": 620,
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
```

## Getting the value

The taxpayer data is stored separately in `data/taxpayer.json`.

For example:

```json
{
  "taxReturn": {
    "income": {
      "wages": 85000
    }
  }
}
```

The annotation uses:

```text
taxReturn.income.wages
```

to find the value.

The `data_resolver.py` service walks through the nested data and returns `85000`.

This means the annotation does not need to contain the actual taxpayer value.

## Formatting

`formatter.py` is responsible for formatting the resolved value.

For example:

```text
85000
```

becomes:

```text
$85,000.00
```

based on the formatting information in the annotation.

Keeping resolving and formatting separate makes the code easier to change later.

## PDF Rendering

`pdf_renderer.py` takes the resolved and formatted values and writes them onto the PDF template.

The basic flow is:

```text
annotation.json
       +
taxpayer.json
       |
       v
data_resolver.py
       |
       v
formatter.py
       |
       v
pdf_renderer.py
       |
       v
completed PDF
```

The generated PDF is saved in:

```text
output/form_1040_completed.pdf
```

## Positioning

The position of each field is defined using:

```text
page
x
y
width
height
```

The coordinates are defined relative to the top-left of the page.

The PDF renderer converts the Y coordinate to the coordinate system used by the PDF library.

## Why I designed it this way

I kept the annotation and taxpayer data separate so that the same annotation can be reused with different taxpayer data.

I used `valuePath` with dot notation because tax data can be deeply nested, for example:

```text
taxReturn.taxpayer.name.first
```

I kept resolving, formatting, and PDF rendering as separate services so that each part has one main responsibility.

I also included the form version because the position of fields can change between different versions of a tax form.

## Current Scope

This is a basic prototype for the assignment.

Currently it demonstrates:

- Field annotations
- Nested data references
- Field positioning
- Basic formatting
- PDF value rendering
- A simple Flask UI

The prototype could be extended later to support things like:

- Checkboxes
- Dates
- More formatting options
- Conditional fields
- Multiple pages
- More complex data structures
- Better text fitting

## Running the project

Install the dependencies:

```bash
python3 -m pip install -r requirements.txt
```

Run the Flask application:

```bash
python3 app.py
```

Open:

```text
http://127.0.0.1:5000
```

From the UI, click **Generate PDF** to create the completed form.
