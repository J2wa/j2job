import { snapshotModels } from "./model-catalog-snapshot.ts";

export type CatalogModel = {
  id: string; type: string; tags?: string[];
  modalities?: { input?: string[]; output?: string[] };
  context_window?: number; max_tokens?: number; released?: number;
};
export const PREFERRED_MODELS = [
  "openai/gpt-6-luna-fast", "anthropic/claude-haiku-5.5",
  "google/gemini-3.8-flash", "anthropic/claude-sonnet-5.5",
  "deepseek/deepseek-v4.1-flash", "openai/gpt-6.1-sol",
];
export function compatible(model: CatalogModel) {
  return model.type === "language" && model.tags?.includes("structured-output")
    && model.modalities?.input?.includes("text")
    && model.modalities?.output?.includes("text")
    && !model.modalities.output.includes("image")
    && (model.context_window ?? 0) >= 65536 && (model.max_tokens ?? 0) >= 8192;
}
const slug = /^[a-z0-9][a-z0-9.-]*\/[a-zA-Z0-9][a-zA-Z0-9._:-]*$/;
export function configuredModels(primary?: string, fallbacks?: string) {
  const models = [primary?.trim(), ...(fallbacks?.split(",").map(x => x.trim()) ?? [])].filter((x): x is string => Boolean(x));
  if (models.some(x => !slug.test(x))) throw new Error("Invalid resume model configuration.");
  return [...new Set(models)];
}
export function orderModels(catalog: CatalogModel[], primary?: string, fallbacks?: string) {
  const configured = configuredModels(primary, fallbacks);
  // An explicit fallback list is an allowlist, useful for controlling provider access and cost.
  if (fallbacks?.trim()) return configured;
  const eligible = catalog.filter(compatible);
  const available = new Set(eligible.map(x => x.id));
  const rest = eligible.sort((a,b) => (b.released ?? 0) - (a.released ?? 0) || a.id.localeCompare(b.id)).map(x => x.id);
  return [...new Set([...configured, ...PREFERRED_MODELS.filter(x => available.has(x)), ...rest])];
}
let cached: { models: CatalogModel[]; expires: number } | undefined;
let pending: Promise<CatalogModel[]> | undefined;
export async function discoverModels(fetcher: typeof fetch = fetch): Promise<CatalogModel[]> {
  if (cached && cached.expires > Date.now()) return cached.models;
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetcher("https://ai-gateway.vercel.sh/v1/models", { signal: AbortSignal.timeout(3000), cache: "no-store" });
      if (!response.ok) throw new Error("Model catalog unavailable");
      const body: unknown = await response.json();
      const data = (body as { data?: unknown })?.data;
      if (!Array.isArray(data)) throw new Error("Invalid model catalog");
      const models = data.filter((x): x is CatalogModel => Boolean(x && typeof x.id === "string" && slug.test(x.id) && compatible(x)));
      if (!models.length) throw new Error("No compatible models");
      cached = { models, expires: Date.now() + 3600000 };
      return models;
    } catch {
      const models = cached?.models ?? snapshotModels;
      cached = { models, expires: Date.now() + 60000 };
      return models;
    } finally { pending = undefined; }
  })();
  return pending;
}
