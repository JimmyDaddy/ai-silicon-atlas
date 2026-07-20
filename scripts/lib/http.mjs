const DEFAULT_TIMEOUT_MS = 20000;

export async function fetchJson(url, options = {}) {
  const {
    headers = {},
    retries = 3,
    retryStatuses = [429],
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = 700,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...headers,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = retryStatuses.includes(response.status) || response.status >= 500;
        const error = new Error(`HTTP ${response.status} for ${url}`);
        error.status = response.status;
        if (!retryable || attempt === retries) throw error;
        lastError = error;
      } else {
        return await response.json();
      }
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    } finally {
      clearTimeout(timeout);
    }

    await wait(retryDelayMs * (attempt + 1));
  }

  throw lastError ?? new Error(`Unable to fetch ${url}`);
}

export function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
