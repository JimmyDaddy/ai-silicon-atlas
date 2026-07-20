import type { APIRoute } from "astro";
import { buildAiExport } from "../../lib/ai-export";

export const prerender = true;

export const GET: APIRoute = () => new Response(`${JSON.stringify(buildAiExport(), null, 2)}\n`, {
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  },
});

