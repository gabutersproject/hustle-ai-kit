"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SawhorseMark } from "@/components/mark";
import { api, DeskError } from "@/lib/api";
import type { Health, Pricebook } from "@/lib/types";

type ShopContextValue = {
  health: Health | null;
  book: Pricebook | null;
  loadError: string | null;
  reloadBook: () => Promise<void>;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function useShop() {
  const value = useContext(ShopContext);
  if (!value) throw new Error("useShop must be used inside the desk shell");
  return value;
}

const browserRuntime = process.env.NEXT_PUBLIC_SAWHORSE_RUNTIME === "browser";

const NAV = [
  { href: "/", label: "New quote" },
  { href: "/quotes", label: "Tickets" },
  { href: "/rate-card", label: "Rate card" },
  { href: "/glossary", label: "Glossary" },
  { href: "/local", label: "Why it stays local" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [health, setHealth] = useState<Health | null>(null);
  const [book, setBook] = useState<Pricebook | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reloadBook() {
    const next = await api<Pricebook>("pricebook");
    setBook(next);
  }

  useEffect(() => {
    let stopped = false;
    let bookLoaded = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (stopped) return;
      try {
        const next = await api<Health>("health");
        if (stopped) return;
        setHealth(next);
        if (!bookLoaded) {
          const pricebook = await api<Pricebook>("pricebook");
          if (stopped) return;
          setBook(pricebook);
          bookLoaded = true;
        }
        setLoadError(null);
        const modelPending = !next.model_loaded && !next.model_error;
        if (modelPending || !bookLoaded) timer = setTimeout(poll, 1200);
      } catch (error) {
        if (stopped) return;
        setLoadError(error instanceof DeskError ? error.message : "The engine is not up yet.");
        timer = setTimeout(poll, 1500);
      }
    }

    poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const value = useMemo(
    () => ({ health, book, loadError, reloadBook }),
    [health, book, loadError],
  );

  const modelLabel = !health
    ? "Connecting"
    : health.model_loaded
      ? `${health.model.name.split("-")[0]} ${health.model.parameters.replace(" billion", "B")} · ${browserRuntime ? "in this browser" : "on this machine"}`
      : health.model_loading
        ? health.model_progress != null && health.model_progress < 100
          ? `Downloading the weights · ${health.model_progress}%`
          : "Loading the model"
        : "Model unavailable";

  return (
    <ShopContext.Provider value={value}>
      <div className="min-h-screen">
        <header className="no-print border-b border-border bg-background/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
            <Link href="/" className="flex items-center gap-3 text-primary">
              <SawhorseMark className="size-9" />
              <span>
                <span className="font-serif block text-[1.65rem] leading-none tracking-tight text-foreground">
                  Sawhorse
                </span>
                <span className="text-xs text-muted-foreground">
                  Quoting desk for a one-person shop
                </span>
              </span>
            </Link>
            <div className="text-right">
              <p className="text-sm font-medium">{book?.shop.name ?? "Loading the shop"}</p>
              <p className="text-xs text-muted-foreground">{modelLabel}</p>
            </div>
          </div>
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {health && !health.model_loaded ? (
            <p className="mx-auto max-w-6xl px-4 pb-3 text-sm text-muted-foreground">
              {health.model_error
                ? health.model_error
                : browserRuntime
                  ? "Qwen2.5 is downloading into this browser, about 1.1 GB, then it stays here. You can fill a ticket by hand while that finishes. The note is not uploaded."
                  : "Qwen2.5 is loading on this machine. You can fill a ticket by hand. Reading a note waits until the model is in memory."}
            </p>
          ) : null}
          {loadError && !book ? (
            <p className="mx-auto max-w-6xl px-4 pb-3 text-sm text-destructive" role="alert">
              {loadError}
            </p>
          ) : null}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </ShopContext.Provider>
  );
}
