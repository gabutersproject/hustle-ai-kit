import { DeskError } from "@/lib/api";
import type { Health, ModelMeta } from "@/lib/types";

const PYODIDE_VERSION = "0.27.7";
const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const WLLAMA_VERSION = "3.8.1";
const WLLAMA_URL = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/esm/index.js`;
const WASM_URL = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/src/wasm/wllama.wasm`;
const MODEL_REPO = "Qwen/Qwen2.5-1.5B-Instruct-GGUF";
const MODEL_FILE = "qwen2.5-1.5b-instruct-q5_k_m.gguf";

const ENGINE_FILES = [
  "__init__.py",
  "bridge.py",
  "deadlines.py",
  "letter.py",
  "money.py",
  "pricer.py",
  "reader.py",
  "schemas.py",
  "store.py",
];

const MODEL_META: ModelMeta = {
  name: "Qwen2.5-1.5B-Instruct",
  repo: MODEL_REPO,
  file: MODEL_FILE,
  parameters: "1.5 billion",
  quantization: "Q5_K_M",
  license: "Apache-2.0",
  runner: "llama.cpp",
  role: "Reads a client note into a job ticket. The grammar has no price field.",
};

type DeskResult = { ok: true; data: unknown } | { ok: false; status: number; detail: string };

type PyodideLike = {
  FS: {
    mkdirTree: (path: string) => void;
    writeFile: (path: string, data: string) => void;
    mount: (fs: unknown, opts: object, path: string) => void;
    syncfs: (populate: boolean, callback: (error?: Error) => void) => void;
    filesystems: { IDBFS: unknown };
  };
  loadPackage: (names: string | string[]) => Promise<void>;
  runPython: (code: string) => void;
  globals: { get: (name: string) => (action: string, body: string) => unknown };
};

type WllamaLike = {
  loadModelFromHF: (
    source: { repo: string; file: string },
    params: Record<string, unknown>,
  ) => Promise<void>;
  createChatCompletion: (params: Record<string, unknown>) => Promise<{
    choices?: { message?: { content?: string | null } }[];
    usage?: { completion_tokens?: number };
  }>;
};

let boot: Promise<void> | null = null;
let modelBoot: Promise<void> | null = null;
let pyodide: PyodideLike | null = null;
let wllama: WllamaLike | null = null;
let modelLoaded = false;
let modelLoading = false;
let modelError: string | null = null;
let modelProgress: number | null = null;
let queue: Promise<unknown> = Promise.resolve();

function localToday() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function localStamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function health(): Health {
  return {
    ok: true,
    model_loaded: modelLoaded,
    model_loading: modelLoading,
    model_error: modelError,
    model_progress: modelProgress,
    model: MODEL_META,
  };
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Couldn't download the quoting engine."));
    document.head.appendChild(script);
  });
}

async function fetchText(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error("The desk files didn't load. Refresh the page.");
  }
  return response.text();
}

function syncFs(populate: boolean) {
  const fs = pyodide?.FS;
  if (!fs) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    fs.syncfs(populate, (error) => (error ? reject(error) : resolve()));
  });
}

async function bootPython() {
  await loadScript(`${PYODIDE_INDEX}pyodide.js`);
  const loadPyodide = (globalThis as { loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideLike> })
    .loadPyodide;
  if (!loadPyodide) throw new Error("Couldn't download the quoting engine.");
  pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX });
  await pyodide.loadPackage("pydantic");
  pyodide.FS.mkdirTree("/app/engine");
  pyodide.FS.mkdirTree("/app/data");
  pyodide.FS.mount(pyodide.FS.filesystems.IDBFS, {}, "/app/data");
  await syncFs(true);
  for (const name of ENGINE_FILES) {
    const source = await fetchText(`/desk/engine/${name}`);
    pyodide.FS.writeFile(`/app/engine/${name}`, source);
  }
  const book = await fetchText("/desk/pricebook.default.json");
  pyodide.FS.writeFile("/app/data/pricebook.default.json", book);
  await syncFs(false);
  pyodide.runPython("import sys\nsys.path.insert(0, '/app')\nfrom engine.bridge import handle");
}

async function bootModel() {
  modelLoading = true;
  modelError = null;
  modelProgress = 0;
  const importer = new Function("url", "return import(url)") as (url: string) => Promise<{
    Wllama: new (paths: { default: string }) => WllamaLike;
  }>;
  const { Wllama } = await importer(WLLAMA_URL);
  const gpu = "gpu" in navigator;
  const attempts = gpu ? [99, 0] : [0];
  let lastError: unknown = null;
  for (const layers of attempts) {
    try {
      const engine = new Wllama({ default: WASM_URL });
      await engine.loadModelFromHF(
        { repo: MODEL_REPO, file: MODEL_FILE },
        {
          n_ctx: 4096,
          n_threads: 1,
          n_batch: 256,
          n_gpu_layers: layers,
          useCache: true,
          progressCallback: ({ loaded, total }: { loaded: number; total: number }) => {
            if (total > 0) modelProgress = Math.min(99, Math.round((loaded / total) * 100));
          },
        },
      );
      wllama = engine;
      modelLoaded = true;
      modelLoading = false;
      modelProgress = 100;
      modelError = null;
      return;
    } catch (error) {
      lastError = error;
      wllama = null;
      modelLoaded = false;
    }
  }
  modelLoading = false;
  modelProgress = null;
  modelError =
    lastError instanceof Error
      ? lastError.message
      : "The model didn't load in this browser. You can still fill a ticket by hand.";
}

function ready() {
  if (!boot) boot = bootPython();
  if (!modelBoot) modelBoot = bootModel();
  return boot;
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function call<T>(action: string, body: unknown): Promise<T> {
  return enqueue(async () => {
    await ready();
    if (!pyodide) throw new DeskError("The quoting engine isn't ready in this browser yet.");
    const handle = pyodide.globals.get("handle");
    const raw = handle(action, JSON.stringify(body ?? {}));
    const text = typeof raw === "string" ? raw : String(raw);
    const parsed = JSON.parse(text) as DeskResult;
    if (!parsed.ok) throw new DeskError(parsed.detail);
    await syncFs(false);
    return parsed.data as T;
  });
}

async function readNote<T>(body: Record<string, unknown>): Promise<T> {
  await ready();
  if (modelBoot) await modelBoot;
  if (!modelLoaded || !wllama) {
    throw new DeskError(modelError || "The model is still loading in this browser.");
  }
  const prepared = await call<{ messages: { role: string; content: string }[]; schema: unknown }>(
    "prepare_read",
    body,
  );
  const started = performance.now();
  const sampling = {
    messages: prepared.messages,
    temperature: 0,
    max_tokens: 500,
  };
  let response: Awaited<ReturnType<WllamaLike["createChatCompletion"]>>;
  try {
    response = await wllama.createChatCompletion({
      ...sampling,
      response_format: {
        type: "json_schema",
        json_schema: { name: "job_ticket", schema: prepared.schema, strict: true },
      },
    });
  } catch {
    response = await wllama.createChatCompletion(sampling);
  }
  const seconds = (performance.now() - started) / 1000;
  const content = response.choices?.[0]?.message?.content ?? "";
  const completion = response.usage?.completion_tokens ?? 0;
  return call<T>("finish_read", { ...body, content, seconds, completion_tokens: completion });
}

export async function browserApi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  let body: Record<string, unknown> = {};
  if (init?.body) {
    body = JSON.parse(String(init.body)) as Record<string, unknown>;
  }
  const stamped = { ...body, today: localToday() };

  if (!boot) boot = bootPython();
  if (!modelBoot) modelBoot = bootModel();

  if (path === "health" && method === "GET") return health() as T;
  if (path === "pricebook" && method === "GET") return call<T>("pricebook", {});
  if (path === "pricebook" && method === "PUT") return call<T>("save_pricebook", { book: body });
  if (path === "pricebook/reset") return call<T>("reset_pricebook", {});
  if (path === "read") return readNote<T>(stamped);
  if (path === "price") return call<T>("price", { ...stamped, created_at: localStamp() });
  if (path === "quotes" && method === "GET") return call<T>("quotes", {});

  const quote = path.match(/^quotes\/([^/]+)$/);
  if (quote && method === "GET") return call<T>("quote", { id: decodeURIComponent(quote[1]) });
  if (quote && method === "DELETE") {
    return call<T>("delete_quote", { id: decodeURIComponent(quote[1]) });
  }
  throw new DeskError("That didn't go through. Check the ticket and try again.");
}
