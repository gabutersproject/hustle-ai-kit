"use client";

import { useShop } from "@/components/shell";

export default function LocalPage() {
  const { health } = useShop();
  const model = health?.model;

  return (
    <article className="max-w-2xl space-y-8">
      <header>
        <h1 className="font-serif text-4xl tracking-tight">Why this stays on the bench</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          Sawhorse is a quoting desk for a one-person furniture shop. The open model is what
          makes the reading possible without renting someone else&apos;s brain, and without
          handing them the shop&apos;s margin.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">The job</h2>
        <p className="leading-7">
          Mara Ellison builds furniture in Hudson, New York. A note comes in from Catskill: six
          seats, maybe eight with a leaf, walnut if it isn&apos;t crazy, otherwise white oak, no
          gloss, before Thanksgiving, four to five thousand dollars. The tedious part is not
          writing a polite email. It is turning that note into her hours, her board feet, and an
          honest no when the date or the wood doesn&apos;t fit.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">What the open model is allowed to do</h2>
        <p className="leading-7">
          Qwen2.5-1.5B-Instruct, quantized to Q5_K_M, runs in llama.cpp on this machine. The
          weights are Apache-2.0. There is no API key. llama.cpp holds the reply to a JSON schema,
          and that schema has no price field, so the model cannot type a dollar amount. It also
          never sees the hourly rate or the lumber prices. Those stay in the rate card, which is
          ordinary code. The letter is assembled from that ticket. If a number is in the letter,
          it is because the rate card put it there.
        </p>
        <ol className="space-y-2 border-l border-border pl-4 text-sm leading-6">
          <li>The note stays in this process.</li>
          <li>The model returns a job ticket: wood, seats, leaf, town, budget, timing.</li>
          <li>The rate card prices the ticket. Hours times the shop rate. Board feet times the wood.</li>
          <li>You check the read, then you send the letter.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Where a closed model is worse at this</h2>
        <p className="leading-7">
          Ask a general chat model to quote a walnut dining table and it reaches for retail. A
          round number, a confident email, a price the shop cannot build for. Sending that either
          loses the job or gives away the margin. The same model does not know that Catskill is
          about forty minutes from this shop, or that &quot;not glossy&quot; here means hardwax oil
          rather than a satin people will complain about. You can paste a glossary into a hosted
          prompt. You also paste the client&apos;s town, their budget, and sometimes why they need
          the table by a certain Thursday. In a town this size, that note is not anonymous, and
          the rate card is the business.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">The bill that actually matters</h2>
        <p className="leading-7">
          A frontier API would read one of these notes for less than a cent. That is not the cost
          that breaks a shop quoting fifteen small jobs in a month. A proposal product at thirty
          or forty dollars a month still doesn&apos;t know a trestle from a pedestal. The weights
          here are a file of about 1.2 GB. The quotes are a JSON file. If Sawhorse disappeared
          tomorrow, both would still be on the laptop. Electricity is the inference bill. A 1.5
          billion parameter model is small enough for a shop computer with no GPU, which is the
          reason to use an open weight this size instead of renting a larger closed one. Nobody
          can reprice the model out from under the quote.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">The niche adjustment a shop will actually keep</h2>
        <p className="leading-7">
          The glossary is not a fine-tune, and it shouldn&apos;t pretend to be. It is the list a
          maker will edit on a Sunday: towns, finish words, species nicknames. The next note uses
          it. The same open weights can take a LoRA later, trained on the quotes Mara actually
          sent. A closed API does not hand you the weights, and it does not hand you a grammar
          that forbids a price.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-serif text-2xl">On this machine</h2>
        {model ? (
          <dl className="mt-4 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted-foreground">Model</dt>
            <dd>{model.name}</dd>
            <dt className="text-muted-foreground">Weights</dt>
            <dd>{model.repo}</dd>
            <dt className="text-muted-foreground">File</dt>
            <dd>{model.file}</dd>
            <dt className="text-muted-foreground">Size</dt>
            <dd>{model.parameters}, {model.quantization}</dd>
            <dt className="text-muted-foreground">License</dt>
            <dd>{model.license}</dd>
            <dt className="text-muted-foreground">Runner</dt>
            <dd>{model.runner}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              {health?.model_loaded
                ? "Loaded. Reads happen in this process."
                : health?.model_loading
                  ? "Loading into memory."
                  : health?.model_error || "Not loaded."}
            </dd>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Waiting for the engine to answer.</p>
        )}
      </section>
    </article>
  );
}
