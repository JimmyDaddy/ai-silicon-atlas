import type { APIRoute } from "astro";
import { buildLlmsTxt } from "../lib/ai-export";

export const prerender = true;

export const GET: APIRoute = () => new Response(buildLlmsTxt(), {
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  },
});

