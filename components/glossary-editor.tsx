"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useShop } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, DeskError } from "@/lib/api";
import type { GlossaryEntry, Pricebook } from "@/lib/types";

const KINDS = ["delivery", "finish", "species", "piece", "base", "other"];

export function GlossaryEditor() {
  const { book, reloadBook } = useShop();
  const [rows, setRows] = useState<GlossaryEntry[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (book) setRows(book.glossary.map((entry) => ({ ...entry })));
  }, [book]);

  if (!book) {
    return <p className="text-sm text-muted-foreground">Loading the glossary…</p>;
  }

  function update(id: string, patch: Partial<GlossaryEntry>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function save() {
    const cleaned = rows
      .map((row) => ({
        ...row,
        phrase: row.phrase.trim(),
        value: row.value.trim(),
        note: row.note.trim(),
      }))
      .filter((row) => row.phrase && row.value);
    setSaving(true);
    try {
      const next: Pricebook = { ...book!, glossary: cleaned };
      await api("pricebook", { method: "PUT", body: JSON.stringify(next) });
      await reloadBook();
      toast.success("Glossary saved. The next read uses it.");
    } catch (error) {
      toast.error(error instanceof DeskError ? error.message : "The glossary didn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="max-w-2xl">
        <h1 className="font-serif text-4xl tracking-tight">Glossary</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          This is the part a general model does not have. Catskill means a mid-Hudson delivery.
          &quot;Not glossy&quot; in this shop means hardwax oil. The list goes to the model with
          the note. It is not a price, and it does not leave the machine.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No phrases yet. Add the towns and the finish words your clients actually use.
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-[1fr_140px_1fr_auto]">
            <label className="flex flex-col gap-1.5 text-sm">
              <Label>Phrase</Label>
              <Input
                className="h-10 bg-background"
                value={row.phrase}
                onChange={(event) => update(row.id, { phrase: event.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <Label>Kind</Label>
              <Select value={row.kind} onValueChange={(value) => value && update(row.id, { kind: value })}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <Label>Rate-card id</Label>
              <Input
                className="h-10 bg-background"
                value={row.value}
                onChange={(event) => update(row.id, { value: event.target.value })}
                placeholder="mid_hudson"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              className="self-end"
              onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
            >
              Remove
            </Button>
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-3">
              <Label>Note, for you</Label>
              <Input
                className="h-10 bg-background"
                value={row.note}
                onChange={(event) => update(row.id, { note: event.target.value })}
                placeholder="About 40 minutes south of the shop"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: `g_${Date.now()}`, phrase: "", kind: "delivery", value: "", note: "" },
            ])
          }
        >
          Add a phrase
        </Button>
        <Button type="button" className="h-10 px-4" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save glossary"}
        </Button>
      </div>
    </div>
  );
}
