from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class Position:
    page: int
    x: float
    y: float
    width: float
    height: float


@dataclass
class Format:
    font: str = "Helvetica"
    fontSize: int = 10
    alignment: str = "left"
    currency: Optional[str] = None
    decimalPlaces: Optional[int] = None
    dateFormat: Optional[str] = None
    prefix: str = ""
    suffix: str = ""
    thousandsSeparator: bool = True


@dataclass
class Validation:
    required: bool = False
    min: Optional[float] = None
    max: Optional[float] = None


@dataclass
class VisibleWhen:
    path: str
    equals: str


@dataclass
class Field:
    id: str
    label: str
    type: str
    valuePath: str
    position: Position
    format: Format = field(default_factory=Format)
    validation: Optional[Validation] = None
    visibleWhen: Optional[VisibleWhen] = None


@dataclass
class FormMetadata:
    id: str
    name: str
    version: str


@dataclass
class Annotation:
    form: FormMetadata
    fields: List[Field] = field(default_factory=list)
