def resolve_value(data, path):
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


def resolve_value_safe(data, path):
    try:
        value = resolve_value(data, path)
        return value, None
    except (KeyError, ValueError) as e:
        return None, str(e)


def evaluate_condition(data, condition):
    if condition is None:
        return True

    if not isinstance(condition, dict):
        return True

    path = condition.get("path")
    equals = condition.get("equals")

    if path is None or equals is None:
        return True

    value, error = resolve_value_safe(data, path)

    if error:
        return False

    return str(value) == str(equals)


def is_field_visible(field, taxpayer_data):
    condition = field.get("visibleWhen")

    if condition is None:
        return True

    return evaluate_condition(taxpayer_data, condition)
