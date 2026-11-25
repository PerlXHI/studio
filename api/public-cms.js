import { getCmsResourceNames, readCmsResource } from "./_cms.js";

function send(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ok: false, message: "Method not allowed." });
  }

  const resource = String(req.query?.resource || "all");
  const available = getCmsResourceNames("public");
  if (resource !== "all" && !available.includes(resource)) {
    return send(res, 400, { ok: false, message: "Unknown public CMS resource." });
  }

  try {
    const names = resource === "all" ? available : [resource];
    const entries = await Promise.all(names.map(async name => [name, await readCmsResource(name, "public")]));
    const data = Object.fromEntries(entries);
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    res.setHeader("Vary", "Accept-Encoding");
    return send(res, 200, { ok: true, data });
  } catch (error) {
    console.error("[public-cms] Published CMS data read failed", { resource: error.resource || resource, status: error.status || 500 });
    return send(res, error.status || 502, {
      ok: false,
      message: error.status === 503
        ? error.message
        : "Published CMS data is not ready. Confirm that the Phase 1 Supabase migration has been applied."
    });
  }
}
