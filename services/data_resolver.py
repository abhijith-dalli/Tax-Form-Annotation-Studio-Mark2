def resolve_value(data, path):
    """
    Resolve a value from nested dictionary data using dot notation.

    Example:
        path = "taxReturn.taxpayer.name.first"

    Returns:
        "John"
    """

    current = data

    for key in path.split("."):
        if not isinstance(current, dict):
            raise ValueError(
                f"Cannot access '{key}'. "
                f"Expected an object but found {type(current).__name__}."
            )

        if key not in current:
            raise KeyError(f"Path not found: {path}")

        current = current[key]

    return current