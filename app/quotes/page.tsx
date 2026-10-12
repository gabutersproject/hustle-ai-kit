"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useShop } from "@/components/shell";
import { api, DeskError } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import type { Quote } from "@/lib/types";

export default function QuotesPage() {
  const { book } = useShop();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    api<{ quotes: Quote[] }>("quotes")
      .then((result) => {
        if (!stopped) setQuotes(result.quotes);
      })
      .catch((caught) => {
        if (!stopped) setError(caught instanceof DeskError ? caught.message : "Couldn't load tickets.");
      });
    return () => {
      stopped = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="font-serif text-4xl tracking-tight">Tickets</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Saved on this machine, in a file next to the rate card. Nothing here is an account.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {quotes === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading tickets…</p>
      ) : null}

      {quotes && quotes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card px-4 py-8">
          <p className="font-medium">No tickets yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A note from a client becomes one. Start with Priya&apos;s dining table if you want to see the shape.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline">
            New quote
          </Link>
        </div>
      ) : null}

      {quotes && quotes.length > 0 ? (
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {quotes.map((quote) => {
          const recommended = quote.options.find((option) => option.id === quote.recommended_id);
          const piece = book?.pieces.find((item) => item.id === quote.reading.piece);
          return (
            <li key={quote.id}>
              <Link href={`/quotes/${quote.id}`} className="flex items-baseline justify-between gap-4 px-4 py-4 hover:bg-secondary">
                <span>
                  <span className="block font-medium">
                    {quote.reading.client_name || "Unnamed client"}
                    <span className="font-normal text-muted-foreground"> · {piece?.label ?? quote.reading.piece}</span>
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatDate(quote.created_at)}
                    {recommended ? ` · ${recommended.budget_note}` : ""}
                  </span>
                </span>
                <span className="font-serif text-2xl">{recommended ? money(recommended.total_cents) : ""}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      ) : null}
    </div>
  );
}
