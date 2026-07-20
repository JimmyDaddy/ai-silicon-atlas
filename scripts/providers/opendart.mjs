import { fetchJson, wait } from "../lib/http.mjs";

const DART_API = "https://opendart.fss.or.kr/api/list.json";

function compactDate(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export async function updateDartCompanies(companyIdentifiers) {
  const startedAt = new Date().toISOString();
  const apiKey = process.env.DART_API_KEY;
  const tracked = Object.entries(companyIdentifiers).filter(([, identifiers]) => identifiers.dartCorpCode);
  const results = {};

  if (!apiKey) {
    for (const [slug, identifiers] of tracked) {
      results[slug] = {
        status: "unconfigured",
        provider: "OpenDART",
        checkedAt: startedAt,
        identifiers: { corpCode: identifiers.dartCorpCode },
        warnings: ["DART_API_KEY is not configured"],
      };
    }
    return {
      source: {
        status: "unconfigured",
        provider: "OpenDART",
        url: "https://engopendart.fss.or.kr/",
        startedAt,
        completedAt: new Date().toISOString(),
        companyCount: tracked.length,
      },
      results,
    };
  }

  const startDate = new Date();
  startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);

  for (const [slug, identifiers] of tracked) {
    const checkedAt = new Date().toISOString();
    const params = new URLSearchParams({
      crtfc_key: apiKey,
      corp_code: identifiers.dartCorpCode,
      bgn_de: compactDate(startDate),
      end_de: compactDate(new Date()),
      page_count: "20",
      sort: "date",
      sort_mth: "desc",
    });

    try {
      const payload = await fetchJson(`${DART_API}?${params}`);
      if (payload.status !== "000") {
        throw new Error(`OpenDART ${payload.status}: ${payload.message}`);
      }
      const filing = payload.list?.[0] ?? null;
      results[slug] = {
        status: "ok",
        provider: "OpenDART",
        checkedAt,
        identifiers: { corpCode: identifiers.dartCorpCode },
        entityName: filing?.corp_name ?? null,
        latestFiling: filing
          ? {
              form: filing.report_nm,
              filedAt: filing.rcept_dt.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
              reportDate: null,
              accessionNumber: filing.rcept_no,
              title: filing.report_nm,
              url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${filing.rcept_no}`,
            }
          : null,
        metrics: {},
        warnings: [],
      };
    } catch (error) {
      results[slug] = {
        status: "error",
        provider: "OpenDART",
        checkedAt,
        identifiers: { corpCode: identifiers.dartCorpCode },
        warnings: [error instanceof Error ? error.message : String(error)],
      };
    }

    await wait(180);
  }

  return {
    source: {
      status: "ok",
      provider: "OpenDART",
      url: "https://engopendart.fss.or.kr/",
      startedAt,
      completedAt: new Date().toISOString(),
      companyCount: tracked.length,
    },
    results,
  };
}
