/**
 * Netlify Function: get-data
 * GET /.netlify/functions/get-data
 *
 * Returns the latest equipment_data.json from Netlify Blobs.
 * Falls back to the static equipment_data.json file if no blob has been
 * uploaded yet (e.g. first deploy).
 */

import { getStore } from "@netlify/blobs";

export default async function handler(req) {
    if (req.method !== "GET") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { "Content-Type": "application/json" } }
        );
    }

    // Try Netlify Blobs first
    try {
        const store = getStore("equipment");
        const blob = await store.get("equipment_data", { type: "text" });

        if (blob !== null) {
            return new Response(blob, {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-cache"
                }
            });
        }
    } catch (err) {
        // Blob store unavailable or key not found — fall through to static fallback
        console.warn("Blob read failed, falling back to static file:", err?.message);
    }

    // Fallback: serve the static equipment_data.json bundled with the site
    try {
        const { readFile } = await import("node:fs/promises");
        const { join, dirname } = await import("node:path");
        const { fileURLToPath } = await import("node:url");

        // Resolve path relative to the publish directory (netlify/)
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const staticPath = join(__dirname, "..", "equipment_data.json");

        const content = await readFile(staticPath, "utf-8");

        return new Response(content, {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache"
            }
        });
    } catch (err) {
        console.error("Static fallback failed:", err);
        return new Response(
            JSON.stringify({ error: "No data available" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}

export const config = {
    path: "/api/get-data"
};
