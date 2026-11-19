import { timingSafeEqual, createHmac } from "node:crypto";
import { makeSession, setSessionCookie, clearSessionCookie, isAdmin, hasTrustedOrigin, supabaseConfig, supabaseHeaders } from "./_admin.js";

function same(a,b) {
  const x=Buffer.from(String(a)), y=Buffer.from(String(b));
  return x.length===y.length && timingSafeEqual(x,y);
}
async function rateLimit(req, action) {
  const { url, key } = supabaseConfig();
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (!url || !key || !secret) throw new Error("Login protection is not configured.");
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown").trim();
  const fingerprint = createHmac("sha256", secret).update(ip).digest("hex");
  const response = await fetch(url.replace(/\\/$/, "") + "/rest/v1/rpc/pv_admin_login_rate_limit", {
    method: "POST",
    headers: { ...supabaseHeaders(key), "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: fingerprint, p_action: action })
  });
  if (!response.ok) throw new Error("Login protection is temporarily unavailable.");
  return response.json();
}
export default async function handler(req,res) {
  if (req.method==="GET") return res.status(200).json({ok:true,authenticated:isAdmin(req)});
  if (req.method!=="POST") { res.setHeader("Allow","GET, POST, DELETE"); return res.status(405).json({ok:false,message:"Method not allowed."}); }
  if (!hasTrustedOrigin(req)) return res.status(403).json({ok:false,message:"Origin not allowed."});
  if (req.query?.action==="logout" || req.body?.action==="logout") {
    clearSessionCookie(res);
    return res.status(200).json({ok:true});
  }
  let body=req.body; if(typeof body==="string"){try{body=JSON.parse(body)}catch{return res.status(400).json({ok:false,message:"Invalid request."})}}
  const password=String(body?.password||"");
  const expected=process.env.ADMIN_PASSWORD||"";
  if (!expected || !process.env.ADMIN_SESSION_SECRET) return res.status(503).json({ok:false,message:"Admin login is not configured. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel."});
  let limit;
  try { limit = await rateLimit(req,"check"); }
  catch { return res.status(503).json({ok:false,message:"Login protection is temporarily unavailable. Please try again later."}); }
  if (limit?.locked) return res.status(429).json({ok:false,message:"Too many failed attempts. Please try again in 15 minutes."});
  if (!same(password,expected)) {
    try {
      const failed = await rateLimit(req,"fail");
      if (failed?.locked) return res.status(429).json({ok:false,message:"Too many failed attempts. Please try again in 15 minutes."});
    } catch { return res.status(503).json({ok:false,message:"Login protection is temporarily unavailable. Please try again later."}); }
    return res.status(401).json({ok:false,message:"Incorrect password."});
  }
  try { await rateLimit(req,"success"); }
  catch { return res.status(503).json({ok:false,message:"Login protection is temporarily unavailable. Please try again later."}); }
  setSessionCookie(res,makeSession());
  return res.status(200).json({ok:true});
}
