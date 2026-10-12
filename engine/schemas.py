from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


class Shop(BaseModel):
    name: str
    maker: str
    city: str
    email: str
    phone: str
    hourly_cents: int = Field(ge=0)
    deposit_percent: int = Field(ge=0, le=100)
    lead_weeks_min: int = Field(ge=1, le=104)
    lead_weeks_max: int = Field(ge=1, le=104)
    design_hours: float = Field(ge=0)
    design_credited: bool = True
    revision_rounds: int = Field(ge=0, le=10)
    quote_valid_days: int = Field(ge=1, le=365)
    default_species: str
    default_finish: str

    @model_validator(mode="after")
    def lead_order(self) -> "Shop":
        if self.lead_weeks_max < self.lead_weeks_min:
            raise ValueError("Lead time max is shorter than the minimum.")
        return self


class Species(BaseModel):
    id: str
    label: str
    cents_per_bf: int = Field(ge=0)
    note: str = ""

    @field_validator("id")
    @classmethod
    def slug(cls, value: str) -> str:
        if not value.replace("_", "").isalnum() or value != value.lower():
            raise ValueError("Species id must be a lowercase slug.")
        return value


class Finish(BaseModel):
    id: str
    label: str
    extra_hours: float = Field(ge=0)
    supply_cents: int = Field(ge=0)
    sheen: str = ""


class DeliveryZone(BaseModel):
    id: str
    label: str
    cents: int = Field(ge=0)


class Addon(BaseModel):
    id: str
    label: str
    hours: float = Field(ge=0)
    extra_bf: float = Field(ge=0)
    hardware_cents: int = Field(ge=0)
    pieces: list[str]


class BaseStyle(BaseModel):
    id: str
    label: str
    extra_hours: float


class Piece(BaseModel):
    id: str
    label: str
    labor_hours: float = Field(ge=0)
    thickness_in: float = Field(ge=0)
    waste: float = Field(gt=0)
    lumber_bf: float = Field(ge=0)
    reference_width_in: int = Field(ge=0)
    default_width_in: int = Field(ge=0)
    default_depth_in: int = Field(ge=0)
    leaf_hours: float = Field(ge=0)
    leaf_width_in: int = Field(ge=0)
    leaf_hardware_cents: int = Field(ge=0)
    supports_leaf: bool = False
    supports_seats: bool = False
    supports_base: bool = False
    scale_labor_with_width: bool = False
    seat_widths: dict[str, int] = Field(default_factory=dict)
    bases: list[BaseStyle] = Field(default_factory=list)
    default_base: str = ""


class GlossaryEntry(BaseModel):
    id: str
    phrase: str
    kind: str
    value: str
    note: str = ""


class Pricebook(BaseModel):
    shop: Shop
    species: list[Species]
    finishes: list[Finish]
    delivery: list[DeliveryZone]
    addons: list[Addon]
    pieces: list[Piece]
    glossary: list[GlossaryEntry]

    @model_validator(mode="after")
    def references_resolve(self) -> "Pricebook":
        species_ids = [item.id for item in self.species]
        finish_ids = [item.id for item in self.finishes]
        piece_ids = [item.id for item in self.pieces]
        for label, ids in (
            ("species", species_ids),
            ("finishes", finish_ids),
            ("delivery zones", [item.id for item in self.delivery]),
            ("pieces", piece_ids),
        ):
            if len(ids) != len(set(ids)):
                raise ValueError(f"Duplicate ids in {label}.")
        if self.shop.default_species not in species_ids:
            raise ValueError("Default species is not on the rate card.")
        if self.shop.default_finish not in finish_ids:
            raise ValueError("Default finish is not on the rate card.")
        return self

    def piece(self, piece_id: str) -> Piece | None:
        return next((item for item in self.pieces if item.id == piece_id), None)

    def species_by_id(self, species_id: str) -> Species | None:
        return next((item for item in self.species if item.id == species_id), None)

    def finish_by_id(self, finish_id: str) -> Finish | None:
        return next((item for item in self.finishes if item.id == finish_id), None)

    def zone_by_id(self, zone_id: str) -> DeliveryZone | None:
        return next((item for item in self.delivery if item.id == zone_id), None)

    def addon(self, addon_id: str) -> Addon | None:
        return next((item for item in self.addons if item.id == addon_id), None)


class Reading(BaseModel):
    client_name: str = ""
    piece: str
    quantity: int = 1
    seats: int = 0
    leaf: bool = False
    species_primary: str = "unspecified"
    species_alternate: str = "none"
    finish: str = "unspecified"
    base_style: str = "unspecified"
    budget_low: int = 0
    budget_high: int = 0
    delivery: str = "unspecified"
    deadline_raw: str = ""
    place_raw: str = ""
    waterfall: bool = False
    cable_grommet: bool = False
    width_in: int = 0
    depth_in: int = 0

    @field_validator(
        "client_name",
        "piece",
        "species_primary",
        "species_alternate",
        "finish",
        "base_style",
        "delivery",
        "deadline_raw",
        "place_raw",
    )
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class LineItem(BaseModel):
    label: str
    detail: str
    cents: int


class PricedOption(BaseModel):
    id: str
    species_id: str
    title: str
    pitch: str
    lines: list[LineItem]
    total_cents: int
    within_budget: bool | None
    budget_note: str


class Quote(BaseModel):
    id: str | None = None
    created_at: str
    inquiry: str = ""
    maker_note: str = ""
    reading: Reading
    options: list[PricedOption]
    recommended_id: str
    deposit_cents: int
    lead_conflict: str | None
    lead_note: str
    assumptions: list[str]
    exclusions: list[str]
    letter: str
    model_seconds: float | None = None


class ReadResult(BaseModel):
    reading: Reading
    seconds: float
    tokens_per_second: float | None
    model: dict[str, str]


class PriceRequest(BaseModel):
    inquiry: str = ""
    reading: Reading
    maker_note: str = ""
    save: bool = False
    model_seconds: float | None = None


class ReadRequest(BaseModel):
    inquiry: str
