"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QuoteView } from "@/components/quote-view";
import { Button } from "@/components/ui/button";
import { api, DeskError } from "@/lib/api";
import type { Quote } from "@/lib/types";

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let stopped = false;
    api<Quote>(`quotes/${params.id}`)
      .then((result) => {
        if (!stopped) setQuote(result);
      })
      .catch((caught) => {
        if (!stopped) setError(caught instanceof DeskError ? caught.message : "That ticket isn't here.");
      });
    return () => {
      stopped = true;
    };
  }, [params.id]);

  async function remove() {
    try {
      await api(`quotes/${params.id}`, { method: "DELETE" });
      toast.success("Ticket deleted from this machine.");
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
