export type Shop = {
  name: string;
  maker: string;
  city: string;
  email: string;
  phone: string;
  hourly_cents: number;
  deposit_percent: number;
  lead_weeks_min: number;
  lead_weeks_max: number;
  design_hours: number;
  design_credited: boolean;
  revision_rounds: number;
  quote_valid_days: number;
  default_species: string;
  default_finish: string;
};

export type Species = {
  id: string;
  label: string;
  cents_per_bf: number;
  note: string;
};

export type Finish = {
  id: string;
  label: string;
  extra_hours: number;
  supply_cents: number;
  sheen: string;
};

export type DeliveryZone = {
  id: string;
  label: string;
  cents: number;
};

export type Addon = {
  id: string;
  label: string;
  hours: number;
  extra_bf: number;
  hardware_cents: number;
  pieces: string[];
};

export type BaseStyle = {
  id: string;
  label: string;
  extra_hours: number;
};

export type Piece = {
  id: string;
  label: string;
  labor_hours: number;
  thickness_in: number;
  waste: number;
  lumber_bf: number;
  reference_width_in: number;
  default_width_in: number;
  default_depth_in: number;
  leaf_hours: number;
  leaf_width_in: number;
  leaf_hardware_cents: number;
  supports_leaf: boolean;
  supports_seats: boolean;
  supports_base: boolean;
  scale_labor_with_width: boolean;
  seat_widths: Record<string, number>;
  bases: BaseStyle[];
  default_base: string;
};

export type GlossaryEntry = {
  id: string;
  phrase: string;
  kind: string;
  value: string;
  note: string;
};

export type Pricebook = {
  shop: Shop;
  species: Species[];
  finishes: Finish[];
  delivery: DeliveryZone[];
  addons: Addon[];
  pieces: Piece[];
  glossary: GlossaryEntry[];
};

export type Reading = {
  client_name: string;
  piece: string;
  quantity: number;
  seats: number;
  leaf: boolean;
  species_primary: string;
  species_alternate: string;
  finish: string;
  base_style: string;
  budget_low: number;
  budget_high: number;
  delivery: string;
  deadline_raw: string;
  place_raw: string;
  waterfall: boolean;
  cable_grommet: boolean;
  width_in: number;
  depth_in: number;
};

export type LineItem = {
  label: string;
  detail: string;
  cents: number;
};

export type PricedOption = {
  id: string;
  species_id: string;
  title: string;
  pitch: string;
  lines: LineItem[];
  total_cents: number;
  within_budget: boolean | null;
  budget_note: string;
};

export type Quote = {
  id: string | null;
  created_at: string;
  inquiry: string;
  maker_note: string;
  reading: Reading;
  options: PricedOption[];
  recommended_id: string;
  deposit_cents: number;
  lead_conflict: string | null;
  lead_note: string;
  assumptions: string[];
  exclusions: string[];
  letter: string;
  model_seconds: number | null;
};

export type ModelMeta = {
  name: string;
  repo: string;
  file: string;
  parameters: string;
  quantization: string;
  license: string;
  runner: string;
  role: string;
};

export type Health = {
  ok: boolean;
  model_loaded: boolean;
  model_loading: boolean;
  model_error: string | null;
  model: ModelMeta;
};

export type ReadResult = {
  reading: Reading;
  seconds: number;
  tokens_per_second: number | null;
  model: ModelMeta;
};

export type Sample = {
  id: string;
  label: string;
  blurb: string;
  inquiry: string;
};
