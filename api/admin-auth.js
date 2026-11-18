import { timingSafeEqual } from "node:crypto";
import { makeSession, setSessionCookie, clearSessionCookie, isAdmin } from "./_admin.js";

function same(a,b) {
  const x=Buffer.from(String(a)), y=Buffer.from(String(b));
  return x.length===y.length && timingSafeEqual(x,y);
}
export default async function handler(req,res) {
  if (req.method==="GET") return res.status(200).json({ok:true,authenticated:isAdmin(req)});
  if (req.method!=="POST") { res.setHeader("Allow","GET, POST, DELETE"); return res.status(405).json({ok:false,message:"Method not allowed."}); }
  if (req.query?.action==="logout" || req.body?.action==="logout") {
    clearSessionCookie(res);
    return res.status(200).json({ok:true});
  }
  let body=req.body; if(typeof body==="string"){try{body=JSON.parse(body)}catch{return res.status(400).json({ok:false,message:"Invalid request."})}}
  if (req.headers.origin) { try { if (new URL(req.headers.origin).hostname !== "perivelle.vercel.app") return res.status(403).json({ok:false,message:"Origin not allowed."}); } catch { return res.status(403).json({ok:false,message:"Invalid origin."}); } }
  const password=String(body?.password||"");
  const expected=process.env.ADMIN_PASSWORD||"";
  if (!expected || !process.env.ADMIN_SESSION_SECRET) return res.status(503).json({ok:false,message:"Admin login is not configured. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel."});
  if (!same(password,expected)) return res.status(401).json({ok:false,message:"Incorrect password."});
  setSessionCookie(res,makeSession());
  return res.status(200).json({ok:true});
}
