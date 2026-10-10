export class ResumeGenerationError extends Error {
  code: "access" | "credits" | "exhausted" | "timeout" | "configuration";
  detail?: string;
  constructor(code: "access" | "credits" | "exhausted" | "timeout" | "configuration", detail?: string) { super(code); this.code = code; this.detail = detail; }
}
export function failureReason(error:unknown):string {
  const e=error as {statusCode?:number;name?:string}|null;
  if(e?.statusCode===429) return "rate limits or quota exhausted";
  if(e?.statusCode===404) return "model unavailable";
  if(e?.statusCode===400 || e?.statusCode===422) return "model rejected the request or schema";
  if(e?.name==="TimeoutError" || e?.name==="AbortError") return "model timed out";
  if(e?.name==="SyntaxError" || e?.name==="ZodError" || e?.name?.includes("NoObjectGenerated")) return "invalid structured output";
  return "provider failed or returned an incomplete response";
}
export function terminalFailure(error: unknown): "access" | "credits" | undefined {
  let current = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const e = current as { name?: string; statusCode?: number; message?: string; cause?: unknown };
    if (e.statusCode === 401 || e.statusCode === 403 || e.name?.includes("GatewayAuthentication") || e.name?.includes("GatewayForbidden")) return "access";
    if (e.statusCode === 402 || /insufficient (credits|funds|balance)|credit balance|budget.*(exceeded|exhausted)/i.test(e.message ?? "")) return "credits";
    current = e.cause;
  }
}
export async function runWithFallback<T>(options: {
  models: string[]; signal: AbortSignal; budgetMs: number;
  run: (model: string, signal: AbortSignal) => Promise<unknown>;
  validate: (value: unknown) => T;
  onAttempt?: (model: string, attempt: number) => void;
  onFailure?: (model: string) => void;
  now?: () => number; attemptMs?: number;
}) {
  const now = options.now ?? Date.now;
  const deadline = now() + options.budgetMs;
  let attempt = 0;
  const failures=new Set<string>();
  for (const model of [...new Set(options.models)]) {
    options.signal.throwIfAborted();
    const remaining = deadline - now();
    if (remaining <= 0) throw new ResumeGenerationError("timeout");
    attempt++;
    options.onAttempt?.(model, attempt);
    const timeout = AbortSignal.timeout(Math.max(1, Math.min(options.attemptMs ?? 40000, remaining)));
    const signal = AbortSignal.any([options.signal, timeout]);
    try {
      // Race enforces the deadline even if a transport fails to respect cancellation.
      let listener: () => void = () => {};
      const aborted = new Promise<never>((_, reject) => {
        listener = () => reject(signal.reason);
        signal.addEventListener("abort", listener, { once: true });
        if (signal.aborted) listener();
      });
      let result: unknown;
      try { result = await Promise.race([options.run(model, signal), aborted]); }
      finally { signal.removeEventListener("abort", listener); }
      options.signal.throwIfAborted();
      return { output: options.validate(result), model, attempts: attempt };
    } catch (error) {
      options.signal.throwIfAborted();
      const terminal = terminalFailure(error);
      if (terminal) throw new ResumeGenerationError(terminal);
      failures.add(failureReason(error));
      options.onFailure?.(model);
    }
  }
  throw new ResumeGenerationError("exhausted",[...failures].join("; "));
}
export function generationMessage(error: unknown, provider = "AI Gateway") {
  if (error instanceof ResumeGenerationError) {
    if (error.code === "configuration") return "The AI provider or model configuration is invalid. Ask the workspace owner to check the environment settings.";
    if (error.code === "access") return provider + " access was rejected. Check the configured API key and model access rules.";
    if (error.code === "credits") return provider + " credits or budget are exhausted. Add credits or adjust the budget, then retry.";
    if (error.code === "exhausted") return "The compatible models could not return a valid resume."+(error.detail?" Reported issues: "+error.detail+".":"")+" Check the provider key, model settings and quota, then retry.";
  }
  return "Generation reached its time limit or was interrupted. Please retry; shortening very long input may help.";
}
