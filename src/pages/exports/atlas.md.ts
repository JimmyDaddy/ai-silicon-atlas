import type { APIRoute } from "astro";
import { buildAiMarkdown } from "../../lib/ai-export";

export const prerender = true;

export const GET: APIRoute = () => new Response(buildAiMarkdown(), {
  headers: {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  },
});

