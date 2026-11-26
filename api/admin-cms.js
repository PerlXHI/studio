import { isAdmin } from "./_admin.js";
import { getCmsResourceNames, readCmsResource } from "./_cms.js";

function send(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return send(res, 405, { ok: false, message: "Method not allowed." });
  }
  if (!isAdmin(req)) return send(res, 401, { ok: false, message: "Please sign in to the admin dashboard." });
  const resource = String(req.query?.resource || "all");
  const available = getCmsResourceNames("admin");
  if (resource !== "all" && !available.includes(resource)) {
    return send(res, 400, { ok: false, message: "Unknown CMS resource." });
  }

  try {
    const names = resource === "all" ? available : [resource];
    const entries = await Promise.all(names.map(async name => [name, await readCmsResource(name, "admin")]));
    const data = Object.fromEntries(entries);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Cookie");
    return send(res, 200, { ok: true, data });
  } catch (error) {
    console.error("[admin-cms] Data read failed", { resource: error.resource || resource, status: error.status || 500 });
    return send(res, error.status || 502, {
      ok: false,
      message: error.status === 503
        ? error.message
        : "CMS data could not be loaded. Confirm that the Phase 1 Supabase migration has been applied."
    });
  }
}
