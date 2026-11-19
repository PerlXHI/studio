import { createHash } from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed." });
  }

  const origin = req.headers.origin;
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      const requestHost = String(req.headers.host || "").toLowerCase();
      const originHost = parsedOrigin.host.toLowerCase();
      const isLocalhost = parsedOrigin.hostname === "localhost" || parsedOrigin.hostname === "127.0.0.1";
      if ((!isLocalhost && parsedOrigin.protocol !== "https:") || !requestHost || originHost !== requestHost) {
        return res.status(403).json({ ok: false, message: "Origin not allowed." });
      }
    } catch {
      return res.status(403).json({ ok: false, message: "Invalid origin." });
    }
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return res.status(503).json({ ok: false, message: "Commission delivery is not configured yet." });
  }

  let data = req.body;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch {
      return res.status(400).json({ ok: false, message: "Invalid request body." });
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return res.status(400).json({ ok: false, message: "Invalid request body." });
  }

  const clean = (value, max = 1000) =>
    String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

  // Quietly discard bot submissions caught by the hidden honeypot field.
  if (clean(data.website, 120)) return res.status(200).json({ ok: true });


  const fields = [
    ["Name / stage name", clean(data.name, 80)],
    ["Discord username", clean(data.contact, 120)],
    ["Service type", clean(data.type, 120)],
    ["Usage / license preference", clean(data.license, 120)],
    ["Genre / mood / BPM", clean(data.moodBpm, 180) || "—"],
    ["Duration / deliverables", clean(data.duration, 180) || "—"],
    ["Project concept & creative direction", clean(data.character, 1500)],
    ["References", clean(data.reference, 900) || "—"],
    ["Preferred deadline", clean(data.deadline, 40) || "—"],
    ["Budget range", clean(data.budget, 100) || "—"],
    ["Additional notes", clean(data.extra, 900) || "—"]
  ];

  if (!fields[0][1] || !fields[1][1] || !fields[2][1] || !fields[3][1] || fields[6][1].length < 20) {
    return res.status(400).json({ ok: false, message: "Please complete all required fields." });
  }

  // Shared, persistent rate limit: 3 valid submissions per IP every 15 minutes.
  // The IP is hashed with a server-side secret; the raw address is never stored.
  const forwardedFor = String(req.headers["x-forwarded-for"] || "");
  const clientIp = (forwardedFor.split(",")[0] || String(req.headers["x-real-ip"] || "")).trim();
  const rateLimitSecret = process.env.COMMISSION_RATE_LIMIT_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!clientIp || !rateLimitSecret) {
    return res.status(503).json({ ok: false, message: "The commission form is temporarily unavailable. Please try again later." });
  }
  const ipHash = createHash("sha256").update(rateLimitSecret + ":" + clientIp).digest("hex");
  try {
    const limitResponse = await fetch(supabaseUrlForRateLimit(), {
      method: "POST",
      headers: { ...databaseHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ p_ip_hash: ipHash, p_limit: 3, p_window_seconds: 900 })
    });
    if (!limitResponse.ok) {
      const detail = (await limitResponse.text().catch(() => "")).slice(0, 500);
      console.error("[commission] Rate limit check failed", { status: limitResponse.status, response: detail });
      return res.status(503).json({ ok: false, message: "The commission form is temporarily unavailable. Please try again later." });
    }
    const limitRows = await limitResponse.json();
    const limit = Array.isArray(limitRows) ? limitRows[0] : limitRows;
    if (!limit || limit.allowed !== true) {
      const retryAfter = Math.max(1, Number(limit?.retry_after) || 900);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ ok: false, message: "Too many requests from this network. Please wait 15 minutes before submitting another commission request." });
    }
  } catch (error) {
    console.error("[commission] Rate limit request failed", { name: error?.name || "Error" });
    return res.status(503).json({ ok: false, message: "The commission form is temporarily unavailable. Please try again later." });
  }

  const idPart = (value, max = 80) => clean(value, max).normalize("NFKC").replace(/-/g, " ").replace(/[^\p{L}\p{N} '&.]/gu, "").replace(/\s+/g, " ").trim().slice(0, max) || "Unknown";
  const dateParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const dateCode = ["year", "month", "day"].map(key => dateParts.find(part => part.type === key)?.value || "").join("");
  const baseRequestId = dateCode + " - " + idPart(fields[2][1]) + " - " + idPart(fields[0][1]);
  let requestId = baseRequestId;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ ok: false, message: "Commission tracking is not configured yet. Please contact Perivelle." });
  }

  const supabaseRestUrl = supabaseUrl.replace(/\\/$/, "");
  const supabaseUrlForRateLimit = () => supabaseRestUrl + "/rest/v1/rpc/consume_commission_rate_limit";

  const createdAt = new Date().toISOString();
  // Supabase secret keys (sb_secret_...) are API keys, not JWTs:
  // send them through apikey only. Legacy service_role JWTs use both headers.
  const databaseHeaders = {
    "Content-Type": "application/json",
    "apikey": supabaseKey,
    ...(supabaseKey.startsWith("sb_secret_") ? {} : { "Authorization": "Bearer " + supabaseKey })
  };
  try {
    let saveResponse;
    for (let attempt = 0; attempt < 10; attempt++) {
      saveResponse = await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/commission_requests", {
        method: "POST",
        headers: { ...databaseHeaders, "Prefer": "return=minimal" },
        body: JSON.stringify({
          request_id: requestId,
          brief: {
            name: fields[0][1], contact: fields[1][1], type: fields[2][1], license: fields[3][1],
            moodBpm: fields[4][1], duration: fields[5][1], character: fields[6][1],
            reference: fields[7][1], deadline: fields[8][1], budget: fields[9][1], extra: fields[10][1]
          },
          status: "Awaiting Review",
          status_note: "Your request has been received and is waiting for our team to review it.",
          timeline: [{ status: "Awaiting Review", at: createdAt, note: "Your request has been received." }]
        })
      });
      if (saveResponse.status !== 409) break;
      requestId = baseRequestId + " - " + String(attempt + 2).padStart(2, "0");
    }
    if (!saveResponse.ok) {
      const errorBody = (await saveResponse.text().catch(() => "")).slice(0, 2000);
      console.error("[commission] Supabase insert failed", {
        status: saveResponse.status,
        statusText: saveResponse.statusText,
        response: errorBody
      });
      return res.status(502).json({
        ok: false,
        message: "We could not register your tracking ID. Please try again later.",
        diagnostic: "SUPABASE_INSERT_" + saveResponse.status
      });
    }
  } catch (error) {
    console.error("[commission] Supabase request threw an error", {
      name: error?.name || "Error",
      message: error?.message || "Unknown fetch error"
    });
    return res.status(502).json({ ok: false, message: "Commission tracking is temporarily unavailable. Please try again later." });
  }
  const embed = {
    title: "New Commission Request",
    description: `A new request has been submitted through the Perivelle website.\nRequest ID: **${requestId}**`,
    color: 0x9B8BDA,
    fields: [
      { name: "Request ID", value: requestId, inline: true },
      { name: "Current Status", value: "Awaiting Review", inline: true },
      ...fields.map(([name, value]) => ({ name, value: value || "—", inline: false }))
    ],
    footer: { text: "PERIVELLE STUDIO · Status: Awaiting Review" },
    timestamp: new Date().toISOString()
  };

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } })
    });

    if (!discordResponse.ok) {
      await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/commission_requests?request_id=eq." + encodeURIComponent(requestId), {
        method: "DELETE",
        headers: databaseHeaders
      }).catch(() => {});
      return res.status(502).json({ ok: false, message: "Discord could not receive the request. Please try again later." });
    }

    return res.status(200).json({ ok: true, requestId, status: "Awaiting Review", message: "Your commission request has been sent to Perivelle." });
  } catch {
    await fetch(supabaseUrl.replace(/\/$/, "") + "/rest/v1/commission_requests?request_id=eq." + encodeURIComponent(requestId), {
      method: "DELETE",
      headers: databaseHeaders
    }).catch(() => {});
    return res.status(502).json({ ok: false, message: "Unable to send your request right now. Please try again later." });
  }
}
