/**
 * Netlify Function: upload-data
 * POST /.netlify/functions/upload-data
 *
 * Accepts a multipart/form-data POST with a "file" field containing
 * equipment_data.json. Validates and writes it to Netlify Blobs so all
 * users see the updated data on their next page load.
 */

import { getStore } from "@netlify/blobs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export default async function handler(req) {
    // Only accept POST
    if (req.method !== "POST") {
        return new Response(
            JSON.stringify({ error: "Method not allowed" }),
            { status: 405, headers: { "Content-Type": "application/json" } }
        );
    }

    let fileText;

    try {
        // Parse multipart form data
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file) {
            return new Response(
                JSON.stringify({ error: "No file provided. Send a 'file' field." }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Check file size
        const arrayBuffer = await file.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
            return new Response(
                JSON.stringify({ error: "File exceeds 10 MB limit" }),
                { status: 413, headers: { "Content-Type": "application/json" } }
            );
        }

        fileText = new TextDecoder().decode(arrayBuffer);

    } catch (err) {
        return new Response(
            JSON.stringify({ error: "Failed to read uploaded file" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Validate JSON
    let data;
    try {
        data = JSON.parse(fileText);
    } catch {
        return new Response(
            JSON.stringify({ error: "Invalid JSON — file could not be parsed" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Validate required fields
    if (!Array.isArray(data.equipment)) {
        return new Response(
            JSON.stringify({ error: "Missing equipment array in JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (!data.metadata || typeof data.metadata !== "object" || Array.isArray(data.metadata)) {
        return new Response(
            JSON.stringify({ error: "Missing metadata object in JSON" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Write to Netlify Blobs
    try {
        const store = getStore("equipment");
        await store.set("equipment_data", fileText, {
            metadata: { contentType: "application/json" }
        });
    } catch (err) {
        console.error("Blob write failed:", err);
        return new Response(
            JSON.stringify({ error: "Storage write failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }

    return new Response(
        JSON.stringify({ ok: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    );
}

export const config = {
    path: "/api/upload-data"
};
