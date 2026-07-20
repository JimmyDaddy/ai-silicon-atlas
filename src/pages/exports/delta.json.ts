import type { APIRoute } from "astro";
import { deltaSnapshot } from "../../data/delta";

export const prerender = true;

export const GET: APIRoute = () => new Response(`${JSON.stringify(deltaSnapshot, null, 2)}\n`, {
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  },
});
