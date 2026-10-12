"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QuoteView } from "@/components/quote-view";
import { Button } from "@/components/ui/button";
import { useShop } from "@/components/shell";
import { api, DeskError } from "@/lib/api";
import { formatDate, money } from "@/lib/format";
import type { Quote } from "@/lib/types";

const browserRuntime = process.env.NEXT_PUBLIC_SAWHORSE_RUNTIME === "browser";

function SavedTicket({ id }: { id: string }) {
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let stopped = false;
    api<Quote>(`quotes/${id}`)
      .then((result) => {
        if (!stopped) setQuote(result);
      })
      .catch((caught) => {
        if (!stopped) setError(caught instanceof DeskError ? caught.message : "That ticket isn't here.");
      });
    return () => {
      stopped = true;
    };
  }, [id]);

  async function remove() {
    try {
      await api(`quotes/${id}`, { method: "DELETE" });
      toast.success(browserRuntime ? "Ticket deleted from this browser." : "Ticket deleted from this machine.");
      router.push("/quotes");
    } catch (caught) {
      toast.error(caught instanceof DeskError ? caught.message : "Couldn't delete that ticket.");
    }
  }

  if (error) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-serif text-4xl tracking-tight">Ticket not on this machine</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/quotes" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to tickets
        </Link>
      </div>
    );
  }

  if (!quote) {
    return <p className="text-sm text-muted-foreground">Loading the ticket…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Link href="/quotes" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          All tickets
        </Link>
        <Button type="button" variant="outline" className="h-10" onClick={() => window.print()}>
          Print letter
        </Button>
        {confirmDelete ? (
          <>
            <Button type="button" variant="destructive" className="h-10" onClick={remove}>
              Delete this ticket
            </Button>
            <Button type="button" variant="ghost" className="h-10" onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" className="h-10" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>
      <QuoteView quote={quote} />
    </div>
  );
}

export function QuotesScreen() {
  const params = useSearchParams();
  const id = params.get("id");
  const { book } = useShop();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) return;
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
  }, [id]);

  if (id) return <SavedTicket id={id} />;

  return (
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h1 className="font-serif text-4xl tracking-tight">Tickets</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          {browserRuntime
            ? "Saved in this browser, next to the rate card. Nothing here is an account."
            : "Saved on this machine, in a file next to the rate card. Nothing here is an account."}
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
                <Link
                  href={`/quotes?id=${quote.id}`}
                  className="flex items-baseline justify-between gap-4 px-4 py-4 hover:bg-secondary"
                >
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
