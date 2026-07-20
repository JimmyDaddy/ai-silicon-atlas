import { fetchJson, wait } from "../lib/http.mjs";

const SEC_ROOT = "https://data.sec.gov";
const SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";
const SEC_READER_ROOT = "https://r.jina.ai";
const TRACKED_FORMS = new Set(["10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "20-F", "20-F/A", "6-K"]);
const SEC_TRANSPORT = process.env.SEC_TRANSPORT === "reader" ? "reader" : "direct";
const SEC_FACTS_MAX_AGE_HOURS = Number(process.env.SEC_FACTS_MAX_AGE_HOURS) > 0
  ? Number(process.env.SEC_FACTS_MAX_AGE_HOURS)
  : 168;
const READER_INTERVAL_MS = Number(process.env.SEC_READER_INTERVAL_MS) > 0
  ? Number(process.env.SEC_READER_INTERVAL_MS)
  : process.env.JINA_API_KEY ? 250 : 3_100;
let nextReaderRequestAt = 0;
let readerQueue = Promise.resolve();

const metricTags = {
  revenue: [
    ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"],
    ["us-gaap", "Revenues"],
    ["us-gaap", "SalesRevenueNet"],
    ["ifrs-full", "Revenue"],
  ],
  netIncome: [
    ["us-gaap", "NetIncomeLoss"],
    ["ifrs-full", "ProfitLoss"],
  ],
  assets: [
    ["us-gaap", "Assets"],
    ["ifrs-full", "Assets"],
  ],
  cash: [
    ["us-gaap", "CashAndCashEquivalentsAtCarryingValue"],
    ["ifrs-full", "CashAndCashEquivalents"],
  ],
  capex: [
    ["us-gaap", "PaymentsToAcquirePropertyPlantAndEquipment"],
    ["ifrs-full", "PurchaseOfPropertyPlantAndEquipment"],
  ],
};

function secHeaders() {
  const contact = process.env.DATA_CONTACT_EMAIL || "maintainer@example.com";
  return { "User-Agent": `AI-Silicon-Atlas/1.0 ${contact}` };
}

function secRequestOptions() {
  return {
    headers: secHeaders(),
    retries: 2,
    retryDelayMs: 1_200,
    retryStatuses: [403, 429],
  };
}

function readerHeaders() {
  return {
    Accept: "application/json",
    ...(process.env.JINA_API_KEY ? { Authorization: `Bearer ${process.env.JINA_API_KEY}` } : {}),
  };
}

async function reserveReaderSlot() {
  const reservation = readerQueue.then(async () => {
    const delay = Math.max(0, nextReaderRequestAt - Date.now());
    if (delay) await wait(delay);
    nextReaderRequestAt = Date.now() + READER_INTERVAL_MS;
  });
  readerQueue = reservation.catch(() => {});
  await reservation;
}

async function fetchSecJson(url) {
  if (SEC_TRANSPORT === "direct") return fetchJson(url, secRequestOptions());

  await reserveReaderSlot();
  const response = await fetchJson(`${SEC_READER_ROOT}/${url}`, {
    headers: readerHeaders(),
    retries: 1,
    retryDelayMs: 3_500,
    retryStatuses: [429],
    timeoutMs: 25_000,
  });
  const content = response?.data?.content;
  const upstreamStatus = response?.data?.httpStatus;
  if (Number.isFinite(upstreamStatus) && upstreamStatus >= 400) {
    const error = new Error(`SEC upstream returned HTTP ${upstreamStatus} for ${url}`);
    error.status = upstreamStatus;
    throw error;
  }
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`SEC relay returned no JSON content for ${url}`);
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`SEC relay returned invalid JSON for ${url}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function cikKey(cik) {
  return String(cik).padStart(10, "0");
}

function resolveTickerMap(rawTickers) {
  return new Map(
    Object.values(rawTickers).map((entry) => [entry.ticker.toUpperCase(), entry]),
  );
}

function recentFilings(submissions, limit = 8) {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return [];

  const filings = [];

  for (let index = 0; index < recent.form.length; index += 1) {
    if (!TRACKED_FORMS.has(recent.form[index])) continue;
    const accessionNumber = recent.accessionNumber[index];
    const primaryDocument = recent.primaryDocument[index];
    const cik = String(submissions.cik).replace(/^0+/, "");
    filings.push({
      form: recent.form[index],
      filedAt: recent.filingDate[index],
      reportDate: recent.reportDate[index] || null,
      accessionNumber,
      title: recent.primaryDocDescription[index] || `${recent.form[index]} filing`,
      url: `${SEC_ARCHIVES}/${cik}/${accessionNumber.replaceAll("-", "")}/${primaryDocument}`,
    });

    if (filings.length >= limit) break;
  }

  return filings;
}

function extractMetric(companyFacts, candidates) {
  const matches = [];

  for (const [priority, [taxonomy, tag]] of candidates.entries()) {
    const fact = companyFacts?.facts?.[taxonomy]?.[tag];
    if (!fact?.units) continue;

    const unitName = fact.units.USD ? "USD" : Object.keys(fact.units)[0];
    const values = fact.units[unitName] ?? [];
    const usable = values
      .filter((entry) => TRACKED_FORMS.has(entry.form) && entry.filed && entry.end)
      .sort((left, right) => {
        const filedOrder = right.filed.localeCompare(left.filed);
        if (filedOrder) return filedOrder;

        const periodOrder = right.end.localeCompare(left.end);
        if (periodOrder) return periodOrder;

        const leftDuration = left.start ? Date.parse(left.end) - Date.parse(left.start) : Number.POSITIVE_INFINITY;
        const rightDuration = right.start ? Date.parse(right.end) - Date.parse(right.start) : Number.POSITIVE_INFINITY;
        return leftDuration - rightDuration;
      });

    const latest = usable[0];
    if (!latest) continue;

    matches.push({
      label: fact.label,
      value: latest.val,
      unit: unitName,
      periodStart: latest.start ?? null,
      periodEnd: latest.end,
      filedAt: latest.filed,
      form: latest.form,
      fiscalYear: latest.fy ?? null,
      fiscalPeriod: latest.fp ?? null,
      taxonomy,
      tag,
      priority,
    });
  }

  matches.sort((left, right) => {
    const filedOrder = right.filedAt.localeCompare(left.filedAt);
    if (filedOrder) return filedOrder;

    const periodOrder = right.periodEnd.localeCompare(left.periodEnd);
    if (periodOrder) return periodOrder;

    const leftDuration = left.periodStart
      ? Date.parse(left.periodEnd) - Date.parse(left.periodStart)
      : Number.POSITIVE_INFINITY;
    const rightDuration = right.periodStart
      ? Date.parse(right.periodEnd) - Date.parse(right.periodStart)
      : Number.POSITIVE_INFINITY;
    return leftDuration - rightDuration || left.priority - right.priority;
  });

  const latest = matches[0];
  if (!latest) return null;

  const { priority: _priority, ...metric } = latest;
  return metric;
}

function extractMetrics(companyFacts) {
  return Object.fromEntries(
    Object.entries(metricTags)
      .map(([key, candidates]) => [key, extractMetric(companyFacts, candidates)])
      .filter(([, value]) => value !== null),
  );
}

function extractMetricHistory(companyFacts, metrics, checkedAt, limit = 8) {
  const cutoff = Date.parse(checkedAt) - 5 * 365 * 86_400_000;
  const history = {};

  for (const [name, selectedMetric] of Object.entries(metrics)) {
    const fact = companyFacts?.facts?.[selectedMetric.taxonomy]?.[selectedMetric.tag];
    const values = fact?.units?.[selectedMetric.unit] ?? [];
    const selectedDuration = selectedMetric.periodStart
      ? Date.parse(selectedMetric.periodEnd) - Date.parse(selectedMetric.periodStart)
      : null;
    const candidates = values
      .filter((entry) => TRACKED_FORMS.has(entry.form) && entry.filed && entry.end)
      .filter((entry) => Date.parse(entry.end) >= cutoff)
      .filter((entry) => {
        if (selectedDuration === null) return !entry.start;
        if (!entry.start) return false;

        const entryDuration = Date.parse(entry.end) - Date.parse(entry.start);
        const sameFiscalPeriod = selectedMetric.fiscalPeriod
          ? entry.fp === selectedMetric.fiscalPeriod
          : true;
        const comparableDuration = Math.abs(entryDuration - selectedDuration) <= 35 * 86_400_000;
        return sameFiscalPeriod && comparableDuration;
      })
      .sort((left, right) => {
        const periodOrder = right.end.localeCompare(left.end);
        if (periodOrder) return periodOrder;

        const leftDuration = left.start ? Date.parse(left.end) - Date.parse(left.start) : Number.POSITIVE_INFINITY;
        const rightDuration = right.start ? Date.parse(right.end) - Date.parse(right.start) : Number.POSITIVE_INFINITY;
        return leftDuration - rightDuration || right.filed.localeCompare(left.filed);
      });

    const periods = new Map();
    for (const entry of candidates) {
      if (periods.has(entry.end)) continue;
      periods.set(entry.end, {
        label: fact.label,
        value: entry.val,
        unit: selectedMetric.unit,
        periodStart: entry.start ?? null,
        periodEnd: entry.end,
        filedAt: entry.filed,
        form: entry.form,
        fiscalYear: entry.fy ?? null,
        fiscalPeriod: entry.fp ?? null,
        taxonomy: selectedMetric.taxonomy,
        tag: selectedMetric.tag,
      });
      if (periods.size >= limit) break;
    }

    history[name] = [...periods.values()];
  }

  return history;
}

function discardStaleMetrics(metrics, checkedAt, maxAgeDays = 730) {
  const cutoff = Date.parse(checkedAt) - maxAgeDays * 86_400_000;
  const recent = {};
  const warnings = [];

  for (const [name, metric] of Object.entries(metrics)) {
    if (Date.parse(metric.periodEnd) >= cutoff) {
      recent[name] = metric;
    } else {
      warnings.push(`Ignored stale ${name} metric ending ${metric.periodEnd}`);
    }
  }

  return { metrics: recent, warnings };
}

export async function updateSecCompanies(companyIdentifiers, previousCompanies = {}) {
  const startedAt = new Date().toISOString();
  const results = {};
  const tracked = Object.entries(companyIdentifiers).filter(([, identifiers]) => identifiers.secTicker);
  const missingLocalCik = tracked.filter(([, identifiers]) => !identifiers.secCik);
  let tickerMap = new Map();
  let tickerLookupError = null;
  let consecutiveAccessDenied = 0;
  let consecutiveReaderFailures = 0;
  let circuitError = null;

  if (missingLocalCik.length) {
    try {
      const rawTickers = await fetchSecJson("https://www.sec.gov/files/company_tickers.json");
      tickerMap = resolveTickerMap(rawTickers);
    } catch (error) {
      tickerLookupError = error instanceof Error ? error.message : String(error);
    }
  }

  for (const [slug, identifiers] of tracked) {
    const ticker = identifiers.secTicker.toUpperCase();
    const match = tickerMap.get(ticker);
    const cik = identifiers.secCik ? cikKey(identifiers.secCik) : match ? cikKey(match.cik_str) : null;
    const checkedAt = new Date().toISOString();

    if (circuitError) {
      results[slug] = {
        status: "error",
        provider: "SEC EDGAR",
        checkedAt,
        identifiers: { ticker, ...(cik ? { cik } : {}) },
        latestFiling: null,
        recentFilings: [],
        metrics: {},
        metricHistory: {},
        warnings: [circuitError],
      };
      continue;
    }

    if (!cik) {
      results[slug] = {
        status: "error",
        provider: "SEC EDGAR",
        checkedAt,
        identifiers: { ticker },
        latestFiling: null,
        recentFilings: [],
        metrics: {},
        metricHistory: {},
        warnings: [tickerLookupError
          ? `CIK lookup failed: ${tickerLookupError}`
          : `Ticker ${ticker} was not found in SEC company_tickers.json`],
      };
      continue;
    }

    try {
      if (SEC_TRANSPORT === "reader") console.log(`[SEC ${slug}] fetching submissions through Reader`);
      const submissions = await fetchSecJson(`${SEC_ROOT}/submissions/CIK${cik}.json`);
      const filings = recentFilings(submissions);
      const previous = previousCompanies[slug];
      const metricsCheckedAt = previous?.metricsCheckedAt
        ?? (Object.keys(previous?.metrics ?? {}).length ? previous?.checkedAt : null);
      const metricsAgeHours = metricsCheckedAt
        ? (Date.parse(checkedAt) - Date.parse(metricsCheckedAt)) / 3_600_000
        : Number.POSITIVE_INFINITY;
      const filingChanged = filings[0]?.accessionNumber !== previous?.latestFiling?.accessionNumber;
      const needsMetricsRefresh = process.env.SEC_FORCE_FACTS === "1"
        || previous?.status !== "ok"
        || !Number.isFinite(metricsAgeHours)
        || metricsAgeHours >= SEC_FACTS_MAX_AGE_HOURS
        || filingChanged;

      let metrics = previous?.metrics ?? {};
      let metricHistory = previous?.metricHistory ?? {};
      let nextMetricsCheckedAt = metricsCheckedAt ?? null;
      let warnings = (previous?.warnings ?? []).filter((warning) => !warning.startsWith("Latest refresh failed;"));

      if (needsMetricsRefresh) {
        if (SEC_TRANSPORT === "reader") console.log(`[SEC ${slug}] refreshing Company Facts`);
        const companyFacts = await fetchSecJson(`${SEC_ROOT}/api/xbrl/companyfacts/CIK${cik}.json`);
        const normalizedMetrics = discardStaleMetrics(extractMetrics(companyFacts), checkedAt);
        metrics = normalizedMetrics.metrics;
        metricHistory = extractMetricHistory(companyFacts, metrics, checkedAt);
        nextMetricsCheckedAt = checkedAt;
        warnings = normalizedMetrics.warnings;
      }

      results[slug] = {
        status: "ok",
        provider: "SEC EDGAR",
        checkedAt,
        identifiers: { ticker, cik },
        entityName: submissions.name || match?.title || ticker,
        latestFiling: filings[0] ?? null,
        recentFilings: filings,
        metrics,
        metricHistory,
        metricsCheckedAt: nextMetricsCheckedAt,
        warnings,
      };
      consecutiveAccessDenied = 0;
      consecutiveReaderFailures = 0;
      if (SEC_TRANSPORT === "reader") console.log(`[SEC ${slug}] complete`);
    } catch (error) {
      consecutiveAccessDenied = error?.status === 403 ? consecutiveAccessDenied + 1 : 0;
      consecutiveReaderFailures = SEC_TRANSPORT === "reader" ? consecutiveReaderFailures + 1 : 0;
      results[slug] = {
        status: "error",
        provider: "SEC EDGAR",
        checkedAt,
        identifiers: { ticker, cik },
        latestFiling: null,
        recentFilings: [],
        metrics: {},
        metricHistory: {},
        warnings: [error instanceof Error ? error.message : String(error)],
      };
      if (consecutiveAccessDenied >= 3) {
        circuitError = "SEC access circuit opened after three consecutive HTTP 403 responses; remaining companies kept their last good snapshot";
      } else if (consecutiveReaderFailures >= 3) {
        circuitError = "SEC relay circuit opened after three consecutive failures; remaining companies kept their last good snapshot";
      }
      if (SEC_TRANSPORT === "reader") console.error(`[SEC ${slug}] failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    await wait(250);
  }

  const completedCount = Object.values(results).filter((company) => company.status === "ok").length;
  const failedCount = tracked.length - completedCount;
  return {
    source: {
      status: completedCount > 0 ? (failedCount > 0 ? "degraded" : "ok") : "error",
      provider: "SEC EDGAR",
      url: "https://www.sec.gov/edgar/sec-api-documentation",
      startedAt,
      completedAt: new Date().toISOString(),
      companyCount: tracked.length,
      completedCount,
      failedCount,
      identifierMode: missingLocalCik.length ? "local-cik-with-ticker-fallback" : "local-cik",
      transport: SEC_TRANSPORT === "reader" ? "Jina Reader relay" : "direct",
      ...(SEC_TRANSPORT === "reader" ? { relayUrl: SEC_READER_ROOT } : {}),
      ...((circuitError || tickerLookupError) ? { error: circuitError || tickerLookupError } : {}),
    },
    results,
  };
}
