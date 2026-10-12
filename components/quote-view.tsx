import { money } from "@/lib/format";
import type { Quote } from "@/lib/types";

export function QuoteView({ quote }: { quote: Quote }) {
  const recommended = quote.options.find((option) => option.id === quote.recommended_id);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
      <article className="letter-sheet border border-border bg-card px-6 py-8 shadow-[0_24px_50px_-36px_rgba(48,32,16,0.55)] sm:px-10 sm:py-12">
        <pre className="font-serif text-[17px] leading-8 whitespace-pre-wrap text-foreground">
          {quote.letter}
        </pre>
      </article>

      <aside className="no-print space-y-5">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">Shop ticket</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every dollar is hours, board feet, or a fee from the rate card. The model is not
            allowed to name a price.
          </p>
        </div>

        {quote.options.map((option) => {
          const chosen = option.id === quote.recommended_id;
          const over = option.within_budget === false;
          return (
            <section
              key={option.id}
              className={`rounded-lg border bg-card p-4 ${
                chosen ? "border-primary" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium leading-snug">{option.title}</h3>
                {chosen ? (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                    Send this
                  </span>
                ) : null}
              </div>
              <p className="font-serif mt-2 text-4xl tracking-tight">{money(option.total_cents)}</p>
              <p className={`mt-1 text-sm ${over ? "text-[oklch(0.45_0.12_40)]" : "text-primary"}`}>
                {option.budget_note}
              </p>
              <ul className="mt-4">
                {option.lines.map((line) => (
                  <li
                    key={`${option.id}-${line.label}`}
                    className="flex items-start justify-between gap-4 border-t border-border py-2 text-sm"
                  >
                    <span>
                      <span className="block">{line.label}</span>
                      <span className="block text-xs text-muted-foreground">{line.detail}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{money(line.cents)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{option.pitch}</p>
            </section>
          );
        })}

        <section className="rounded-lg border border-border bg-card p-4 text-sm leading-6">
          <p>
            Deposit on {recommended ? "the one to send" : "the ticket"}:{" "}
            <span className="font-medium">{money(quote.deposit_cents)}</span>
          </p>
          {quote.lead_conflict ? (
            <p className="mt-2 text-[oklch(0.45_0.12_40)]">{quote.lead_conflict}</p>
          ) : null}
          <p className="mt-2 text-muted-foreground">{quote.lead_note}</p>
        </section>

        {quote.assumptions.length > 0 ? (
          <section>
            <h3 className="text-sm font-medium">In the letter, as assumptions</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {quote.assumptions.map((item) => (
                <li key={item}>— {item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {quote.inquiry ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">The note they sent</summary>
            <p className="mt-2 leading-6 whitespace-pre-wrap">{quote.inquiry}</p>
          </details>
        ) : null}
      </aside>
    </div>
  );
}
