export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method not allowed." });
  }

  const origin = req.headers.origin;
  if (origin) {
    try {
      const host = new URL(origin).hostname;
      if (host !== "perivelle.vercel.app") {
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

  const embed = {
    title: "New Commission Request",
    description: "A new request has been submitted through the Perivelle website.",
    color: 0x9B8BDA,
    fields: fields.map(([name, value]) => ({ name, value: value || "—", inline: false })),
    footer: { text: "PERIVELLE STUDIO · Awaiting Review" },
    timestamp: new Date().toISOString()
  };

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } })
    });

    if (!discordResponse.ok) {
      return res.status(502).json({ ok: false, message: "Discord could not receive the request. Please try again later." });
    }

    return res.status(200).json({ ok: true, message: "Your commission request has been sent to Perivelle." });
  } catch {
    return res.status(502).json({ ok: false, message: "Unable to send your request right now. Please try again later." });
  }
}
