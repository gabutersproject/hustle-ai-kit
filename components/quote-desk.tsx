"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { QuoteView } from "@/components/quote-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useShop } from "@/components/shell";
import { api, DeskError } from "@/lib/api";
import { cn } from "cn";
import samples from "@/data/samples.json";
import type { Pricebook, Quote, Reading, ReadResult, Sample } from "@/lib/types";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <Label>{label}</Label>
      {children}
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

function Choice({
  value,
  onValue,
  options,
}: {
  value: string;
  onValue: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const items = Object.fromEntries(options.map((option) => [option.value, option.label]));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onValue(next);
      }}
    >
      <SelectTrigger className="h-10 w-full bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function blankReading(book: Pricebook): Reading {
  return {
    client_name: "",
    piece: book.pieces[0]?.id ?? "dining_table",
    quantity: 1,
    seats: 6,
    leaf: false,
    species_primary: book.shop.default_species,
    species_alternate: "none",
    finish: "unspecified",
    base_style: "unspecified",
    budget_low: 0,
    budget_high: 0,
    delivery: "unspecified",
    deadline_raw: "",
    place_raw: "",
    waterfall: false,
    cable_grommet: false,
    width_in: 0,
    depth_in: 0,
  };
}

export function QuoteDesk() {
  const { book, health } = useShop();
  const [inquiry, setInquiry] = useState("");
  const [reading, setReading] = useState<Reading | null>(null);
  const [readMeta, setReadMeta] = useState<ReadResult | null>(null);
  const [makerNote, setMakerNote] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "pricing" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);

  const piece = book?.pieces.find((item) => item.id === reading?.piece);
  const modelReady = Boolean(health?.model_loaded);

  function update(patch: Partial<Reading>) {
    if (!book) return;
    setReading((current) => {
      const base = current ?? blankReading(book);
      const next = { ...base, ...patch };
      const nextPiece = book.pieces.find((item) => item.id === next.piece);
      if (nextPiece && !nextPiece.supports_leaf) next.leaf = false;
      if (nextPiece && !nextPiece.supports_seats) next.seats = 0;
      if (nextPiece && !nextPiece.supports_base) next.base_style = "unspecified";
      const grommet = book.addons.find((item) => item.id === "cable_grommet");
      const waterfall = book.addons.find((item) => item.id === "waterfall");
      if (grommet && !grommet.pieces.includes(next.piece)) next.cable_grommet = false;
      if (waterfall && !waterfall.pieces.includes(next.piece)) next.waterfall = false;
      return next;
    });
    setQuote(null);
    setSavedId(null);
  }

  async function readNote() {
    setError(null);
    setQuote(null);
    setSavedId(null);
    setPhase("reading");
    try {
      const result = await api<ReadResult>("read", {
        method: "POST",
        body: JSON.stringify({ inquiry }),
      });
      setReading(result.reading);
      setReadMeta(result);
    } catch (caught) {
      setError(caught instanceof DeskError ? caught.message : "The read failed.");
    } finally {
      setPhase("idle");
    }
  }

  async function price(save: boolean) {
    if (!reading) return;
    setError(null);
    setPhase(save ? "saving" : "pricing");
    try {
      const next = await api<Quote>("price", {
        method: "POST",
        body: JSON.stringify({
          inquiry,
          reading,
          maker_note: makerNote,
          save,
          model_seconds: readMeta?.seconds ?? null,
        }),
      });
      setQuote(next);
      setSavedId(next.id);
      if (save && next.id) toast.success("Ticket saved on this machine.");
    } catch (caught) {
      setError(caught instanceof DeskError ? caught.message : "Pricing failed.");
    } finally {
      setPhase("idle");
    }
  }

  function loadSample(sample: Sample) {
    setInquiry(sample.inquiry);
    setReading(null);
    setReadMeta(null);
    setQuote(null);
    setSavedId(null);
    setMakerNote("");
    setError(null);
  }

  const grommetOk = Boolean(
    piece && book?.addons.find((item) => item.id === "cable_grommet")?.pieces.includes(piece.id),
  );
  const waterfallOk = Boolean(
    piece && book?.addons.find((item) => item.id === "waterfall")?.pieces.includes(piece.id),
  );

  return (
    <div className="space-y-8">
      <div className="no-print max-w-2xl">
        <h1 className="font-serif text-4xl tracking-tight">Read a client note</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          Paste it the way they wrote it. An open model on this machine turns it into a job
          ticket. Your rate card, not the model, sets every dollar.
        </p>
      </div>

      <section className="no-print space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {(samples as Sample[]).map((sample) => (
            <button
              key={sample.id}
              type="button"
              onClick={() => loadSample(sample)}
              className="rounded-lg border border-border bg-card px-3 py-3 text-left hover:border-primary"
            >
              <span className="block text-sm font-medium">{sample.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {sample.blurb}
              </span>
            </button>
          ))}
        </div>

        <Textarea
          value={inquiry}
          onChange={(event) => setInquiry(event.target.value)}
          placeholder="Hi, we just bought a place in Catskill…"
          className="min-h-48 bg-card text-base leading-7"
          aria-label="Client note"
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="h-10 px-4"
            disabled={!modelReady || phase === "reading" || inquiry.trim().length < 8}
            onClick={readNote}
          >
            {phase === "reading" ? "Reading on this machine…" : "Read the note"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4"
            disabled={!book || phase === "reading"}
            onClick={() => {
              if (!book) return;
              setReading(blankReading(book));
              setReadMeta(null);
              setQuote(null);
              setSavedId(null);
              setError(null);
            }}
          >
            Fill the ticket myself
          </Button>
        </div>
        {phase === "reading" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Qwen2.5 1.5B is reading the note in this process. A short note is usually under a
            minute. Nothing is uploaded.
          </p>
        ) : null}
        {!modelReady ? (
          <p className="text-sm text-muted-foreground">
            Reading waits for the model. Filling the ticket yourself does not.
          </p>
        ) : null}
      </section>

      {reading && book ? (
        <section className="no-print space-y-5 rounded-xl border border-border bg-card p-4 sm:p-6">
          <div>
            <h2 className="font-serif text-2xl tracking-tight">Check the read</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Change anything the model got wrong. Pricing uses this ticket and the rate card.
            </p>
            {readMeta ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Read on this machine in {readMeta.seconds}s
                {readMeta.tokens_per_second
                  ? ` · ${readMeta.tokens_per_second} tokens/sec`
                  : ""}{" "}
                · {readMeta.model.name} · nothing left the shop
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Filled by hand. No model call.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client">
              <Input
                className="h-10 bg-background"
                value={reading.client_name}
                onChange={(event) => update({ client_name: event.target.value })}
              />
            </Field>
            <Field label="Piece">
              <Choice
                value={reading.piece}
                onValue={(value) => update({ piece: value })}
                options={book.pieces.map((item) => ({ value: item.id, label: item.label }))}
              />
            </Field>
            <Field label="Quantity">
              <Input
                className="h-10 bg-background"
                type="number"
                min={1}
                value={reading.quantity}
                onChange={(event) => update({ quantity: Number(event.target.value) || 1 })}
              />
            </Field>
            {piece?.supports_seats ? (
              <Field label="Seats, without a leaf">
                <Input
                  className="h-10 bg-background"
                  type="number"
                  min={0}
                  value={reading.seats}
                  onChange={(event) => update({ seats: Number(event.target.value) || 0 })}
                />
              </Field>
            ) : null}
            <Field label="First wood">
              <Choice
                value={reading.species_primary}
                onValue={(value) => update({ species_primary: value })}
                options={[
                  { value: "unspecified", label: "Unspecified" },
                  ...book.species.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />
            </Field>
            <Field label="Fallback wood">
              <Choice
                value={reading.species_alternate}
                onValue={(value) => update({ species_alternate: value })}
                options={[
                  { value: "none", label: "None" },
                  ...book.species.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />
            </Field>
            <Field label="Finish">
              <Choice
                value={reading.finish}
                onValue={(value) => update({ finish: value })}
                options={[
                  { value: "unspecified", label: "Unspecified" },
                  ...book.finishes.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />
            </Field>
            {piece?.supports_base ? (
              <Field label="Base">
                <Choice
                  value={reading.base_style}
                  onValue={(value) => update({ base_style: value })}
                  options={[
                    { value: "unspecified", label: "Unspecified" },
                    ...piece.bases.map((item) => ({ value: item.id, label: item.label })),
                  ]}
                />
              </Field>
            ) : null}
            <Field label="Delivery">
              <Choice
                value={reading.delivery}
                onValue={(value) => update({ delivery: value })}
                options={[
                  { value: "unspecified", label: "Unspecified" },
                  ...book.delivery.map((item) => ({ value: item.id, label: item.label })),
                ]}
              />
            </Field>
            <Field label="Place, as they said it">
              <Input
                className="h-10 bg-background"
                value={reading.place_raw}
                onChange={(event) => update({ place_raw: event.target.value })}
              />
            </Field>
            <Field label="Budget low, dollars" hint="0 if they didn't name one.">
              <Input
                className="h-10 bg-background"
                type="number"
                min={0}
                value={reading.budget_low}
                onChange={(event) => update({ budget_low: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Budget high, dollars">
              <Input
                className="h-10 bg-background"
                type="number"
                min={0}
                value={reading.budget_high}
                onChange={(event) => update({ budget_high: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Their timing">
              <Input
                className="h-10 bg-background"
                value={reading.deadline_raw}
                onChange={(event) => update({ deadline_raw: event.target.value })}
                placeholder="before Thanksgiving"
              />
            </Field>
            <Field label="Width, inches" hint="0 lets the rate card choose.">
              <Input
                className="h-10 bg-background"
                type="number"
                min={0}
                value={reading.width_in}
                onChange={(event) => update({ width_in: Number(event.target.value) || 0 })}
              />
            </Field>
            <Field label="Depth, inches">
              <Input
                className="h-10 bg-background"
                type="number"
                min={0}
                value={reading.depth_in}
                onChange={(event) => update({ depth_in: Number(event.target.value) || 0 })}
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {piece?.supports_leaf ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={reading.leaf}
                  onChange={(event) => update({ leaf: event.target.checked })}
                />
                Leaf
              </label>
            ) : null}
            {waterfallOk ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={reading.waterfall}
                  onChange={(event) => update({ waterfall: event.target.checked })}
                />
                Waterfall ends
              </label>
            ) : null}
            {grommetOk ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={reading.cable_grommet}
                  onChange={(event) => update({ cable_grommet: event.target.checked })}
                />
                Cable grommet
              </label>
            ) : null}
          </div>

          <Field label="A line only you would write" hint="Added above your name. Leave it blank to send the letter as priced.">
            <Textarea
              value={makerNote}
              onChange={(event) => {
                setMakerNote(event.target.value);
                setQuote(null);
                setSavedId(null);
              }}
              className="min-h-20 bg-background"
            />
          </Field>

          <Button
            type="button"
            className="h-10 px-4"
            disabled={phase === "pricing" || phase === "saving"}
            onClick={() => price(false)}
          >
            {phase === "pricing" ? "Pricing…" : quote ? "Price again" : "Price from the rate card"}
          </Button>
        </section>
      ) : null}

      {error ? (
        <p className="no-print text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {quote ? (
        <section className="space-y-4">
          <div className="no-print flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="h-10 px-4" onClick={() => window.print()}>
              Print letter
            </Button>
            <Button
              type="button"
              className="h-10 px-4"
              disabled={phase === "saving" || Boolean(savedId)}
              onClick={() => price(true)}
            >
              {savedId ? "Saved" : phase === "saving" ? "Saving…" : "Save ticket"}
            </Button>
            {savedId ? (
              <Link
                href={`/quotes/${savedId}`}
                className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}
              >
                Open saved ticket
              </Link>
            ) : null}
          </div>
          <QuoteView quote={quote} />
        </section>
      ) : null}
    </div>
  );
}
