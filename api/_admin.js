import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "pv_admin_session";
const SESSION_SECONDS = 8 *  60 *  60;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}
function sign(value) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}
export function makeSession() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000) + SESSION_SECONDS })).toString("base64url");
  return payload + "." + sign(payload);
}
export function isAdmin(req) {
  if (!secret()) return false;
  const raw = String(req.headers.cookie || "").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
  if (!raw) return false;
  let token; try { token = decodeURIComponent(raw.slice(COOKIE.length+1)); } catch { return false; }
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = sign(parts[0]);
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a,b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0],"base64url").toString("utf8"));
    return Number(payload.exp) > Math.floor(Date.now()/1000);
  } catch { return false; }
}
export function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", COOKIE+"="+encodeURIComponent(token)+"; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age="+SESSION_SECONDS);
}
export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", COOKIE+"=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
}
export function supabaseConfig() {
  return { url: (process.env.SUPABASE_URL||"").replace(/\/$/,""), key: process.env.SUPABASE_SERVICE_ROLE_KEY||"" };
}
export function json(res, status, body) {
  return res.status(status).json(body);
}
