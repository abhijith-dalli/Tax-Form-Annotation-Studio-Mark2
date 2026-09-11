def format_value(value, field_type, format_config):
    """
    Format a value based on the field type and formatting configuration.
    """

    if value is None:
        return ""

    if field_type == "text":
        return str(value)

    if field_type == "currency":
        return format_currency(value, format_config)

    raise ValueError(f"Unsupported field type: {field_type}")


def format_currency(value, format_config):
    """
    Format a numeric value as currency.
    """

    currency = format_config.get("currency", "USD")
    decimal_places = format_config.get("decimalPlaces", 2)

    if currency == "USD":
        return f"${value:,.{decimal_places}f}"

    raise ValueError(f"Unsupported currency: {currency}")