from datetime import datetime


def format_value(value, field_type, format_config):
    if value is None:
        return ""

    if field_type == "text":
        return format_text(value, format_config)

    if field_type == "number":
        return format_number(value, format_config)

    if field_type == "currency":
        return format_currency(value, format_config)

    if field_type == "date":
        return format_date(value, format_config)

    if field_type == "checkbox":
        return format_checkbox(value, format_config)

    raise ValueError(f"Unsupported field type: {field_type}")


def format_text(value, format_config):
    text = str(value)

    prefix = format_config.get("prefix", "")
    suffix = format_config.get("suffix", "")

    return f"{prefix}{text}{suffix}"


def format_number(value, format_config):
    decimal_places = format_config.get("decimalPlaces", 0)
    use_thousands = format_config.get("thousandsSeparator", True)

    num = float(value)

    if decimal_places > 0:
        formatted = f"{num:,.{decimal_places}f}"
    else:
        formatted = f"{int(num):,}" if use_thousands else str(int(num))

    prefix = format_config.get("prefix", "")
    suffix = format_config.get("suffix", "")

    return f"{prefix}{formatted}{suffix}"


def format_currency(value, format_config):
    currency = format_config.get("currency", "USD")
    decimal_places = format_config.get("decimalPlaces", 2)

    num = float(value)

    symbols = {
        "USD": "$",
        "EUR": "\u20ac",
        "GBP": "\u00a3"
    }

    symbol = symbols.get(currency, currency + " ")
    return f"{symbol}{num:,.{decimal_places}f}"


def format_date(value, format_config):
    date_format = format_config.get("dateFormat", "MM/DD/YYYY")

    if isinstance(value, str):
        for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"]:
            try:
                parsed = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue
        else:
            return str(value)
    elif isinstance(value, (int, float)):
        try:
            parsed = datetime.fromtimestamp(value)
        except (OSError, ValueError):
            return str(value)
    else:
        return str(value)

    format_map = {
        "MM/DD/YYYY": "%m/%d/%Y",
        "YYYY-MM-DD": "%Y-%m-%d",
        "DD/MM/YYYY": "%d/%m/%Y",
        "MM-DD-YYYY": "%m-%d-%Y",
        "YYYY/MM/DD": "%Y/%m/%d"
    }

    strftime_fmt = format_map.get(date_format, "%m/%d/%Y")
    return parsed.strftime(strftime_fmt)


def format_checkbox(value, format_config):
    if isinstance(value, bool):
        return "\u2611" if value else "\u2610"

    if isinstance(value, str):
        checked_values = ["true", "yes", "1", "checked", "x"]
        return "\u2611" if value.lower() in checked_values else "\u2610"

    return "\u2611" if value else "\u2610"
