export class DeskError extends Error {}

const browserRuntime = process.env.NEXT_PUBLIC_SAWHORSE_RUNTIME === "browser";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (browserRuntime) {
    const { browserApi } = await import("@/lib/browser-desk");
    return browserApi<T>(path, init);
  }
  let response: Response;
  try {
    response = await fetch(`/api/engine/${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new DeskError("The desk can't reach the quoting engine on this machine.");
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? (data as { detail: unknown }).detail
        : null;
    const message =
      typeof detail === "string"
        ? detail
        : "That didn't go through. Check the ticket and try again.";
    throw new DeskError(message);
  }

  return data as T;
}
