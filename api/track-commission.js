import { supabaseHeaders } from "./_admin.js";

const ALLOWED_STATUSES = [
  "Awaiting Review", "Quotation Sent", "Awaiting Payment", "In Production",
  "Revision", "Completed", "On Hold", "Cancelled", "Waiting for client response", "Demo ready — Awaiting feedback", "Preparing final delivery"
];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, message: "Method not allowed." });
  }

  const rawRequestId = String(req.query?.id || "").trim();
  const isLegacyId = /^PV-\d{8}-[A-F0-9]{6,24}$/i.test(rawRequestId);
  const requestId = isLegacyId ? rawRequestId.toUpperCase() : rawRequestId;
  const isReadableId = /^\d{6} - [\p{L}\p{N} '&.]{1,80} - [\p{L}\p{N} '&.]{1,80}(?: - \d{2,4})?$/u.test(requestId);
  if (!isLegacyId && !isReadableId) {
    return res.status(400).json({ ok: false, message: "Enter a valid Request ID." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ ok: false, message: "Tracking is temporarily unavailable." });
  }

  try {
    const query = new URLSearchParams({
      select: "request_id,status,status_note,created_at,updated_at,timeline,preview_url,delivery_url,quoted_price,quotation_note",
      request_id: "eq." + requestId,
      limit: "1"
    });
    const response = await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/commission_requests?" + query, {
      headers: supabaseHeaders(supabaseKey)
    });
    if (!response.ok) {
      return res.status(502).json({ ok: false, message: "We could not retrieve this request right now." });
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(404).json({ ok: false, message: "We could not find a request with that ID. Check the code and try again." });
    }
    const record = rows[0];
    return res.status(200).json({
      ok: true, requestId: record.request_id,
      status: ALLOWED_STATUSES.includes(record.status) ? record.status : "Awaiting Review",
      statusNote: record.status_note || "",
      previewUrl: record.preview_url || "", deliveryUrl: record.delivery_url || "", quotedPrice: record.quoted_price || "", quotationNote: record.quotation_note || "",
      createdAt: record.created_at, updatedAt: record.updated_at,
      timeline: Array.isArray(record.timeline) ? record.timeline : []
    });
  } catch {
    return res.status(502).json({ ok: false, message: "Tracking is temporarily unavailable. Please try again." });
  }
}