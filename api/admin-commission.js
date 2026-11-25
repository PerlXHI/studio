const ALLOWED_STATUSES = ["Awaiting Review","Quotation Sent","Awaiting Payment","In Production","Revision","Completed","On Hold","Cancelled","Waiting for client response","Demo ready — Awaiting feedback","Preparing final delivery"];
const EDITABLE = ["status","status_note","price_amount","price_currency","quotation_note","preview_url","delivery_url","internal_note"];
const clean = (v,max=2000) => String(v ?? "").replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g,"").trim().slice(0,max);
function validUrl(value) {
  if (!value) return true;
  try { const u = new URL(value); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; }
}
async function authorize(req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\\s+/i,"").trim();
  const url = process.env.SUPABASE_URL, anon = process.env.SUPABASE_ANON_KEY, adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!token || !url || !anon || !adminEmail) return null;
  const response = await fetch(url.replace(/\\/$/,"") + "/auth/v1/user", { headers: { apikey: anon, Authorization: "Bearer " + token } });
  if (!response.ok) return null;
  const user = await response.json();
  return user && String(user.email || "").toLowerCase() === adminEmail ? user : null;
}
export default async function handler(req,res) {
  if (!["GET","PATCH"].includes(req.method)) { res.setHeader("Allow","GET, PATCH"); return res.status(405).json({ok:false,message:"Method not allowed."}); }
  const user = await authorize(req).catch(()=>null);
  if (!user) return res.status(401).json({ok:false,message:"Admin sign-in required."});
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ok:false,message:"Database connection is not configured."});
  const base = url.replace(/\\/$/,"") + "/rest/v1/commission_requests";
  const headers = { apikey:key, Authorization:"Bearer "+key, "Content-Type":"application/json" };
  if (req.method === "GET") {
    const q = new URLSearchParams({select:"request_id,status,status_note,created_at,updated_at,client_name,discord_contact,service_type,license_preference,mood_bpm,duration,project_concept,references_text,preferred_deadline,budget_range,additional_notes,price_amount,price_currency,quotation_note,preview_url,delivery_url,internal_note",order:"created_at.desc",limit:"100"});
    const search = clean(req.query?.q,80).toUpperCase();
    if (search) q.set("or", "(request_id.ilike.*"+search+"*,client_name.ilike.*"+search+"*,discord_contact.ilike.*"+search+"*)");
    const status = clean(req.query?.status,40);
    if (status && ALLOWED_STATUSES.includes(status)) q.set("status","eq."+status);
    const response = await fetch(base+"?"+q,{headers});
    if (!response.ok) return res.status(502).json({ok:false,message:"Could not load commission requests."});
    return res.status(200).json({ok:true,requests:await response.json()});
  }
  let data=req.body;
  if(typeof data==="string"){try{data=JSON.parse(data)}catch{return res.status(400).json({ok:false,message:"Invalid request body."})}}
  const requestId=clean(data?.requestId,40).toUpperCase();
  if(!/^PV-\\d{8}-[A-F0-9]{6,24}$/.test(requestId)) return res.status(400).json({ok:false,message:"Invalid Request ID."});
  const patch={};
  if (data.status !== undefined) { if(!ALLOWED_STATUSES.includes(data.status)) return res.status(400).json({ok:false,message:"Invalid status."}); patch.status=data.status; }
  for (const [field,max] of [["status_note",1000],["quotation_note",2000],["preview_url",1000],["delivery_url",1000],["internal_note",2000],["price_currency",8]]) {
    if(data[field]!==undefined) patch[field]=clean(data[field],max);
  }
  if(data.price_amount!==undefined){ if(data.price_amount===""||data.price_amount===null) patch.price_amount=null; else {const n=Number(data.price_amount);if(!Number.isFinite(n)||n<0||n>100000000000)return res.status(400).json({ok:false,message:"Enter a valid quotation amount."});patch.price_amount=n;} }
  for(const field of ["preview_url","delivery_url"]) if(patch[field]!==undefined&&!validUrl(patch[field])) return res.status(400).json({ok:false,message:"Preview and delivery links must be valid http or https URLs."});
  if(!Object.keys(patch).length) return res.status(400).json({ok:false,message:"No editable fields were provided."});
  const response=await fetch(base+"?request_id=eq."+encodeURIComponent(requestId),{method:"PATCH",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify(patch)});
  if(!response.ok) return res.status(502).json({ok:false,message:"Could not save commission changes."});
  const rows=await response.json();
  if(!rows.length) return res.status(404).json({ok:false,message:"Request ID was not found."});
  return res.status(200).json({ok:true,request:rows[0]});
}
