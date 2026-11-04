export class HttpError extends Error {
  /** @param {number} status @param {string} url @param {string} [detail] */
  constructor(status, url, detail = "") {
    super(`HTTP ${status} for ${url}${detail ? `: ${detail}` : ""}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

const lastRequestAt = new Map();

/**
 * @param {string} host
 * @param {number} minIntervalMs
 */
async function throttleHost(host, minIntervalMs) {
  const prev = lastRequestAt.get(host) ?? 0;
  const wait = minIntervalMs - (Date.now() - prev);
  if (wait > 0) await sleep(wait);
  lastRequestAt.set(host, Date.now());
}

/** @param {number} ms */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {{
 *   fetchImpl?: typeof fetch,
 *   headers?: Record<string, string>,
 *   retries?: number,
 *   minIntervalMs?: number,
 *   signal?: AbortSignal,
 * }} [options]
 */
export async function fetchJson(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) throw new Error("fetch is not available");

  const parsed = new URL(url);
  const retries = options.retries ?? 3;
  const minIntervalMs = options.minIntervalMs ?? 350;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttleHost(parsed.host, minIntervalMs);

    const res = await fetchImpl(url, {
      signal: options.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "aidusia-studio-catalog-sync/1.0 (+https://github.com/VivreleHpi/aidusia-studio)",
        ...options.headers,
      },
    });

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("retry-after");
      const waitSec = retryAfterHeader ? Number(retryAfterHeader) : 2 ** attempt;
      if (attempt === retries) {
        throw new HttpError(429, url, "rate limit exceeded after retries");
      }
      await sleep(Math.max(1, waitSec) * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new HttpError(res.status, url, body.slice(0, 200));
    }

    return res.json();
  }

  throw new Error("fetchJson: unreachable");
}
