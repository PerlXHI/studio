import { randomUUID } from "node:crypto";
import { isAdmin, supabaseConfig, supabaseHeaders, hasTrustedOrigin } from "./_admin.js";

const BUCKET = "freebies";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const CATEGORIES = new Set(["bgm", "sound-alerts", "stinger"]);

function send(res, status, body) {
  return res.status(status).json(body);
}
function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}
function safeBaseName(name) {
  const raw = String(name || "").replace(/\\/g, "/").split("/").pop() || "free-audio";
  const withoutExtension = raw.slice(0, -4);
  const clean = withoutExtension.normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return clean || "free-audio";
}
async function ensurePublicBucket(url, key, fileSize) {
  const headers = supabaseHeaders(key);
  const bucketUrl = url + "/storage/v1/bucket/" + BUCKET;
  let response = await fetch(bucketUrl, { headers });
  if (response.ok) {
    const bucket = await response.json().catch(() => ({}));
    if (bucket.public !== true) {
      throw new Error("The “freebies” Storage bucket already exists but is private. Make it public in Supabase Storage, then try again.");
    }
    const limit = Number(bucket.file_size_limit || 0);
    if (limit > 0 && fileSize > limit) {
      throw new Error("This Storage bucket has a lower file-size limit than your MP3. Increase its limit in Supabase Storage.");
    }
    return;
  }
  if (response.status !== 404) {
    throw new Error("Could not check the Supabase Storage bucket. " + response.status);
  }
  response = await fetch(url + "/storage/v1/bucket", {
    method: "POST",
    headers: supabaseHeaders(key, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: MAX_FILE_SIZE,
      allowed_mime_types: ["audio/mpeg"]
    })
  });
  if (response.ok || response.status === 409) return;
  const detail = await response.json().catch(() => ({}));
  throw new Error(detail.message || detail.error || "Could not create the public Freebies Storage bucket.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, message: "Method not allowed." });
  }
  if (!isAdmin(req)) return send(res, 401, { ok: false, message: "Please sign in to the admin dashboard." });
  if (!hasTrustedOrigin(req)) return send(res, 403, { ok: false, message: "Origin not allowed." });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return send(res, 400, { ok: false, message: "Invalid upload request." }); }
  }
  if (!body || typeof body !== "object") return send(res, 400, { ok: false, message: "Invalid upload request." });

  const fileName = String(body.fileName || "").trim();
  const fileSize = Number(body.fileSize);
  const category = String(body.category || "");
  if (!fileName || !/\.mp3$/i.test(fileName)) return send(res, 400, { ok: false, message: "Choose an MP3 file (.mp3)." });
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    return send(res, 400, { ok: false, message: "MP3 files must be between 1 byte and 50 MB." });
  }
  if (!CATEGORIES.has(category)) return send(res, 400, { ok: false, message: "Choose BGM, Sound Alerts, or Stinger." });

  const { url, key } = supabaseConfig();
  if (!url || !key) return send(res, 503, { ok: false, message: "Supabase server configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel." });

  try {
    await ensurePublicBucket(url, key, fileSize);
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const path = category + "/" + year + "/" + month + "/" + safeBaseName(fileName) + "-" + randomUUID().slice(0, 8) + ".mp3";
    const encoded = encodePath(path);
    const signedResponse = await fetch(url + "/storage/v1/object/upload/sign/" + BUCKET + "/" + encoded, {
      method: "POST",
      headers: supabaseHeaders(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ upsert: false })
    });
    const signedData = await signedResponse.json().catch(() => ({}));
    if (!signedResponse.ok) {
      return send(res, 502, { ok: false, message: signedData.message || signedData.error || "Supabase could not prepare a signed upload URL." });
    }
    const token = String(signedData.token || "");
    if (!token) return send(res, 502, { ok: false, message: "Supabase did not return an upload token." });
    const uploadUrl = url + "/storage/v1/object/upload/sign/" + BUCKET + "/" + encoded + "?token=" + encodeURIComponent(token);
    const publicUrl = url + "/storage/v1/object/public/" + BUCKET + "/" + encoded;
    return send(res, 200, { ok: true, bucket: BUCKET, path, uploadUrl, publicUrl, maxFileSize: MAX_FILE_SIZE });
  } catch (error) {
    return send(res, 502, { ok: false, message: error.message || "Could not prepare the MP3 upload." });
  }
}
