import { fetchJson, wait } from "../lib/http.mjs";

const SEC_ROOT = "https://data.sec.gov";
const SEC_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";
const TRACKED_FORMS = new Set(["10-K", "10-K/A", "10-Q", "10-Q/A", "8-K", "20-F", "20-F/A", "6-K"]);

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
  return { "User-Agent": `investment-map/0.1 (${contact})` };
}

function cikKey(cik) {
  return String(cik).padStart(10, "0");
}

function resolveTickerMap(rawTickers) {
  return new Map(
    Object.values(rawTickers).map((entry) => [entry.ticker.toUpperCase(), entry]),
  );
}

function latestFiling(submissions) {
  const recent = submissions?.filings?.recent;
  if (!recent?.form) return null;

  for (let index = 0; index < recent.form.length; index += 1) {
    if (!TRACKED_FORMS.has(recent.form[index])) continue;
    const accessionNumber = recent.accessionNumber[index];
    const primaryDocument = recent.primaryDocument[index];
    const cik = String(submissions.cik).replace(/^0+/, "");
    return {
      form: recent.form[index],
      filedAt: recent.filingDate[index],
      reportDate: recent.reportDate[index] || null,
      accessionNumber,
      title: recent.primaryDocDescription[index] || `${recent.form[index]} filing`,
      url: `${SEC_ARCHIVES}/${cik}/${accessionNumber.replaceAll("-", "")}/${primaryDocument}`,
    };
  }

  return null;
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

export async function updateSecCompanies(companyIdentifiers) {
  const startedAt = new Date().toISOString();
  const results = {};
  const tracked = Object.entries(companyIdentifiers).filter(([, identifiers]) => identifiers.secTicker);

  try {
    const rawTickers = await fetchJson("https://www.sec.gov/files/company_tickers.json", {
      headers: secHeaders(),
    });
    const tickerMap = resolveTickerMap(rawTickers);

    for (const [slug, identifiers] of tracked) {
      const ticker = identifiers.secTicker.toUpperCase();
      const match = tickerMap.get(ticker);
      const checkedAt = new Date().toISOString();

      if (!match) {
        results[slug] = {
          status: "error",
          provider: "SEC EDGAR",
          checkedAt,
          identifiers: { ticker },
          warnings: [`Ticker ${ticker} was not found in SEC company_tickers.json`],
        };
        continue;
      }

      try {
        const cik = cikKey(match.cik_str);
        const [submissions, companyFacts] = await Promise.all([
          fetchJson(`${SEC_ROOT}/submissions/CIK${cik}.json`, { headers: secHeaders() }),
          fetchJson(`${SEC_ROOT}/api/xbrl/companyfacts/CIK${cik}.json`, { headers: secHeaders() }),
        ]);
        const normalizedMetrics = discardStaleMetrics(extractMetrics(companyFacts), checkedAt);

        results[slug] = {
          status: "ok",
          provider: "SEC EDGAR",
          checkedAt,
          identifiers: { ticker, cik },
          entityName: submissions.name || match.title,
          latestFiling: latestFiling(submissions),
          metrics: normalizedMetrics.metrics,
          warnings: normalizedMetrics.warnings,
        };
      } catch (error) {
        results[slug] = {
          status: "error",
          provider: "SEC EDGAR",
          checkedAt,
          identifiers: { ticker, cik: cikKey(match.cik_str) },
          warnings: [error instanceof Error ? error.message : String(error)],
        };
      }

      await wait(140);
    }

    return {
      source: {
        status: "ok",
        provider: "SEC EDGAR",
        url: "https://www.sec.gov/edgar/sec-api-documentation",
        startedAt,
        completedAt: new Date().toISOString(),
        companyCount: tracked.length,
      },
      results,
    };
  } catch (error) {
    return {
      source: {
        status: "error",
        provider: "SEC EDGAR",
        url: "https://www.sec.gov/edgar/sec-api-documentation",
        startedAt,
        completedAt: new Date().toISOString(),
        companyCount: tracked.length,
        error: error instanceof Error ? error.message : String(error),
      },
      results,
    };
  }
}
