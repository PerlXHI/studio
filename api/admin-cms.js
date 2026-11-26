import { isAdmin, hasTrustedOrigin } from "./_admin.js";
import { getCmsResourceNames, readCmsResource } from "./_cms.js";
import { getMutableCmsResources, createCmsRecord, updateCmsRecord, archiveCmsRecord } from "./_cms-write.js";

function send(res, status, body) {
  return res.status(status).json(body);
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return null; }
  }
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

export default async function handler(req, res) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return send(res, 405, { ok: false, message: "Method not allowed." });
  }
  if (!isAdmin(req)) return send(res, 401, { ok: false, message: "Please sign in to the admin dashboard." });
  if (req.method !== "GET" && !hasTrustedOrigin(req)) {
    return send(res, 403, { ok: false, message: "Origin not allowed." });
  }

  const resource = String(req.query?.resource || "all");
  const body = req.method === "GET" ? {} : parseBody(req);
  if (req.method !== "GET" && !body) return send(res, 400, { ok: false, message: "Invalid JSON request body." });

  try {
    if (req.method === "GET") {
      const available = getCmsResourceNames("admin");
      if (resource !== "all" && !available.includes(resource)) {
        return send(res, 400, { ok: false, message: "Unknown CMS resource." });
      }
      const names = resource === "all" ? available : [resource];
      const entries = await Promise.all(names.map(async name => [name, await readCmsResource(name, "admin")]));
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Vary", "Cookie");
      return send(res, 200, { ok: true, data: Object.fromEntries(entries) });
    }

    if (!getMutableCmsResources().includes(resource)) {
      return send(res, 400, { ok: false, message: "This CMS resource is read-only or unknown." });
    }
    let rows;
    if (req.method === "POST") rows = await createCmsRecord(resource, body);
    else if (req.method === "PATCH") rows = await updateCmsRecord(resource, req.query, body);
    else rows = await archiveCmsRecord(resource, req.query, body);

    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Vary", "Cookie");
    return send(res, 200, { ok: true, data: Array.isArray(rows) ? rows[0] || null : rows });
  } catch (error) {
    const status = error.status || 502;
    if (status >= 500) console.error("[admin-cms] Request failed", { resource, method: req.method, status });
    return send(res, status, {
      ok: false,
      message: status === 503 ? error.message : (status < 500 ? error.message : "CMS data could not be loaded or saved.")
    });
  }
}
