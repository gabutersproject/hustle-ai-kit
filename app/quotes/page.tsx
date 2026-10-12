import { Suspense } from "react";
import { QuotesScreen } from "@/components/quotes-screen";

export default function QuotesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading tickets…</p>}>
      <QuotesScreen />
    </Suspense>
  );
}
