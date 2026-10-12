"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useShop } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, DeskError } from "@/lib/api";
import { centsToDollars, dollarsToCents, slug } from "@/lib/format";
import type { Pricebook, Species } from "@/lib/types";

function dollarsInput(cents: number, onCents: (cents: number) => void, label: string) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <Label>{label}</Label>
      <Input
        className="h-10 bg-background"
        inputMode="decimal"
        value={centsToDollars(cents)}
        onChange={(event) => onCents(dollarsToCents(event.target.value))}
      />
    </label>
  );
}

export function RateCardEditor() {
  const { book, reloadBook } = useShop();
  const [draft, setDraft] = useState<Pricebook | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [newWood, setNewWood] = useState("");

  useEffect(() => {
    if (book) setDraft(structuredClone(book));
  }, [book]);

  if (!draft) {
    return <p className="text-sm text-muted-foreground">Loading the rate card…</p>;
  }

  function patchShop(patch: Partial<Pricebook["shop"]>) {
    setDraft((current) => (current ? { ...current, shop: { ...current.shop, ...patch } } : current));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      await api<Pricebook>("pricebook", { method: "PUT", body: JSON.stringify(draft) });
      await reloadBook();
      toast.success("Rate card saved. The next ticket uses these numbers.");
    } catch (error) {
      toast.error(error instanceof DeskError ? error.message : "The rate card didn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const next = await api<Pricebook>("pricebook/reset", { method: "POST" });
      setDraft(next);
      await reloadBook();
      setConfirmReset(false);
      toast.success("Restored Mara's sample rate card.");
    } catch (error) {
      toast.error(error instanceof DeskError ? error.message : "Couldn't restore the sample.");
    } finally {
      setSaving(false);
    }
  }

  function addWood() {
    if (!draft) return;
    const id = slug(newWood);
    if (!id || draft.species.some((item) => item.id === id)) {
      toast.error("That wood is already on the card, or the name didn't make an id.");
      return;
    }
    const species: Species = { id, label: newWood.trim(), cents_per_bf: 1400, note: "" };
    setDraft({ ...draft, species: [...draft.species, species] });
    setNewWood("");
  }

  return (
    <div className="space-y-10">
      <div className="max-w-2xl">
        <h1 className="font-serif text-4xl tracking-tight">Rate card</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          These are the only prices Sawhorse is allowed to use. The model never sees this page.
          Change an hour or a board-foot rate and the next letter follows.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Shop</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["name", "Shop name"],
              ["maker", "Your name"],
              ["city", "City"],
              ["email", "Email"],
              ["phone", "Phone"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1.5 text-sm">
              <Label>{label}</Label>
              <Input
                className="h-10 bg-card"
                value={draft.shop[key]}
                onChange={(event) => patchShop({ [key]: event.target.value })}
              />
            </label>
          ))}
          {dollarsInput(draft.shop.hourly_cents, (cents) => patchShop({ hourly_cents: cents }), "Shop rate, $ per hour")}
          <label className="flex flex-col gap-1.5 text-sm">
            <Label>Deposit, percent</Label>
            <Input
              className="h-10 bg-card"
              type="number"
              min={0}
              max={100}
              value={draft.shop.deposit_percent}
              onChange={(event) => patchShop({ deposit_percent: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <Label>Lead time, minimum weeks</Label>
            <Input
              className="h-10 bg-card"
              type="number"
              min={1}
              value={draft.shop.lead_weeks_min}
              onChange={(event) => patchShop({ lead_weeks_min: Number(event.target.value) || 1 })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <Label>Lead time, maximum weeks</Label>
            <Input
              className="h-10 bg-card"
              type="number"
              min={1}
              value={draft.shop.lead_weeks_max}
              onChange={(event) => patchShop({ lead_weeks_max: Number(event.target.value) || 1 })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <Label>Design hours</Label>
            <Input
              className="h-10 bg-card"
              type="number"
              min={0}
              step="0.5"
              value={draft.shop.design_hours}
              onChange={(event) => patchShop({ design_hours: Number(event.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <Label>Quote valid, days</Label>
            <Input
              className="h-10 bg-card"
              type="number"
              min={1}
              value={draft.shop.quote_valid_days}
              onChange={(event) => patchShop({ quote_valid_days: Number(event.target.value) || 1 })}
            />
          </label>
          <label className="flex items-center gap-2 pt-6 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--primary)]"
              checked={draft.shop.design_credited}
              onChange={(event) => patchShop({ design_credited: event.target.checked })}
            />
            Credit the drawing if they build
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Wood, per board foot</h2>
        <div className="space-y-3">
          {draft.species.map((species) => (
            <div key={species.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_140px_auto]">
              <label className="flex flex-col gap-1.5 text-sm">
                <Label>{species.id}</Label>
                <Input
                  className="h-10 bg-background"
                  value={species.label}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      species: draft.species.map((item) =>
                        item.id === species.id ? { ...item, label: event.target.value } : item,
                      ),
                    })
                  }
                />
                <span className="text-xs text-muted-foreground">{species.note}</span>
              </label>
              {dollarsInput(species.cents_per_bf, (cents) =>
                setDraft({
                  ...draft,
                  species: draft.species.map((item) =>
                    item.id === species.id ? { ...item, cents_per_bf: cents } : item,
                  ),
                }),
              "Dollars")}
              <Button
                type="button"
                variant="ghost"
                className="self-end"
                disabled={species.id === draft.shop.default_species}
                onClick={() =>
                  setDraft({ ...draft, species: draft.species.filter((item) => item.id !== species.id) })
                }
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-10 max-w-xs bg-card"
            value={newWood}
            placeholder="Red oak"
            onChange={(event) => setNewWood(event.target.value)}
            aria-label="New wood name"
          />
          <Button type="button" variant="outline" className="h-10" onClick={addWood} disabled={!newWood.trim()}>
            Add wood
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Finishes</h2>
        <div className="space-y-3">
          {draft.finishes.map((finish) => (
            <div key={finish.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-3">
              <p className="text-sm font-medium sm:col-span-3">{finish.label}</p>
              <label className="flex flex-col gap-1.5 text-sm">
                <Label>Extra hours</Label>
                <Input
                  className="h-10 bg-background"
                  type="number"
                  min={0}
                  step="0.5"
                  value={finish.extra_hours}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      finishes: draft.finishes.map((item) =>
                        item.id === finish.id
                          ? { ...item, extra_hours: Number(event.target.value) || 0 }
                          : item,
                      ),
                    })
                  }
                />
              </label>
              {dollarsInput(
                finish.supply_cents,
                (cents) =>
                  setDraft({
                    ...draft,
                    finishes: draft.finishes.map((item) =>
                      item.id === finish.id ? { ...item, supply_cents: cents } : item,
                    ),
                  }),
                "Supplies, dollars",
              )}
              <p className="self-end text-xs text-muted-foreground">Sheen: {finish.sheen}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Delivery</h2>
        <div className="space-y-3">
          {draft.delivery.map((zone) => (
            <div key={zone.id} className="grid items-end gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_160px]">
              <label className="flex flex-col gap-1.5 text-sm">
                <Label>{zone.id}</Label>
                <Input
                  className="h-10 bg-background"
                  value={zone.label}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      delivery: draft.delivery.map((item) =>
                        item.id === zone.id ? { ...item, label: event.target.value } : item,
                      ),
                    })
                  }
                />
              </label>
              {dollarsInput(
                zone.cents,
                (cents) =>
                  setDraft({
                    ...draft,
                    delivery: draft.delivery.map((item) =>
                      item.id === zone.id ? { ...item, cents } : item,
                    ),
                  }),
                "Fee, dollars",
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Pieces, in hours</h2>
        <div className="space-y-3">
          {draft.pieces.map((piece) => (
            <div key={piece.id} className="rounded-lg border border-border bg-card p-3">
              <p className="font-medium">{piece.label}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5 text-sm">
                  <Label>Labor hours</Label>
                  <Input
                    className="h-10 bg-background"
                    type="number"
                    min={0}
                    step="0.5"
                    value={piece.labor_hours}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        pieces: draft.pieces.map((item) =>
                          item.id === piece.id
                            ? { ...item, labor_hours: Number(event.target.value) || 0 }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                {piece.supports_leaf ? (
                  <label className="flex flex-col gap-1.5 text-sm">
                    <Label>Leaf hours</Label>
                    <Input
                      className="h-10 bg-background"
                      type="number"
                      min={0}
                      step="0.5"
                      value={piece.leaf_hours}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          pieces: draft.pieces.map((item) =>
                            item.id === piece.id
                              ? { ...item, leaf_hours: Number(event.target.value) || 0 }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                ) : null}
              </div>
              {piece.supports_seats ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Seat lengths:{" "}
                  {Object.entries(piece.seat_widths)
                    .map(([seats, width]) => `${seats} seats, ${width} in`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" className="h-10 px-4" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save rate card"}
        </Button>
        {confirmReset ? (
          <>
            <Button type="button" variant="destructive" className="h-10" onClick={reset} disabled={saving}>
              Restore the sample
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={() => setConfirmReset(false)}>
              Keep my edits
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" className="h-10" onClick={() => setConfirmReset(true)}>
            Restore Mara&apos;s sample
          </Button>
        )}
      </div>
    </div>
  );
}
