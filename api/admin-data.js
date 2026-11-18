import { isAdmin, supabaseConfig, supabaseHeaders, hasTrustedOrigin } from "./_admin.js";

const STATUSES=["Awaiting Review","Quotation Sent","Awaiting Payment","In Production","Revision","Completed","On Hold","Cancelled"];
const KEYS=["service_prices","catalog_products","studio_links"];
async function db(path,options={}) {
  const {url,key}=supabaseConfig();
  return fetch(url+"/rest/v1/"+path,{...options,headers:supabaseHeaders(key,{"Content-Type":"application/json",...(options.headers||{})})});
}
export default async function handler(req,res) {
  if (!isAdmin(req)) return res.status(401).json({ok:false,message:"Please sign in to the admin dashboard."});
  if (req.method === "PATCH" && !hasTrustedOrigin(req)) return res.status(403).json({ok:false,message:"Origin not allowed."});
  const {url,key}=supabaseConfig();
  if (!url||!key) return res.status(503).json({ok:false,message:"Supabase server configuration is missing."});
  if (req.method==="GET") {
    try {
      const [ordersResponse,settingsResponse]=await Promise.all([
        db("commission_requests?select=*&order=created_at.desc&limit=200"),
        db("studio_settings?select=setting_key,setting_value")
      ]);
      if (!ordersResponse.ok||!settingsResponse.ok) throw new Error("Database read failed");
      const [orders,rows]=await Promise.all([ordersResponse.json(),settingsResponse.json()]);
      const settings={}; for(const row of rows) settings[row.setting_key]=row.setting_value;
      return res.status(200).json({ok:true,orders,settings});
    } catch { return res.status(502).json({ok:false,message:"Could not load dashboard data."}); }
  }
  if (req.method==="PATCH") {
    let body=req.body;
    if(typeof body==="string"){try{body=JSON.parse(body)}catch{return res.status(400).json({ok:false,message:"Invalid JSON."})}}
    if(!body||typeof body!=="object") return res.status(400).json({ok:false,message:"Invalid request."});
    try {
      if(body.kind==="archive") {
        const rawId=String(body.requestId||"").trim();
        const legacy=/^PV-\d{8}-[A-F0-9]{6,24}$/i.test(rawId);
        const id=legacy?rawId.toUpperCase():rawId;
        const readable=/^\d{6} - [\p{L}\p{N} '&.]{1,80} - [\p{L}\p{N} '&.]{1,80}(?: - \d{2,4})?$/u.test(id);
        if((!legacy&&!readable)||typeof body.archived!=="boolean")return res.status(400).json({ok:false,message:"Invalid archive request."});
        const response=await db("commission_requests?request_id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({is_archived:body.archived})});
        if(!response.ok)throw new Error("Archive update failed");
        const rows=await response.json();if(!rows.length)return res.status(404).json({ok:false,message:"Order not found."});
        return res.status(200).json({ok:true,order:rows[0]});
      }
      if(body.kind==="order") {
        const rawId=String(body.requestId||"").trim();
        const id=/^PV-\\d{8}-[A-F0-9]{6,24}$/i.test(rawId)?rawId.toUpperCase():rawId;
        const patch={};
        if(body.status!==undefined){if(!STATUSES.includes(body.status))return res.status(400).json({ok:false,message:"Invalid status."});patch.status=body.status;}
        for(const field of ["status_note","preview_url","delivery_url","quoted_price","quotation_note","admin_note"]) {
          if(body[field]!==undefined) {
            const value=String(body[field]??"").trim();
            if(value.length>1600)return res.status(400).json({ok:false,message:"A field is too long."});
            if(["preview_url","delivery_url"].includes(field) && value && !/^https:\/\//i.test(value))return res.status(400).json({ok:false,message:"Links must use HTTPS."});
            if(field==="quoted_price" && value && !/^[0-9.,\sA-Za-zRp$+-]{1,40}$/.test(value))return res.status(400).json({ok:false,message:"Invalid quoted price."});
            patch[field]=value;
          }
        }
        if(!id||!Object.keys(patch).length)return res.status(400).json({ok:false,message:"No order changes supplied."});
        const response=await db("commission_requests?request_id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});
        if(!response.ok)throw new Error("Update failed");
        const rows=await response.json(); if(!rows.length)return res.status(404).json({ok:false,message:"Order not found."});
        return res.status(200).json({ok:true,order:rows[0]});
      }
      if(body.kind==="setting") {
        if(!KEYS.includes(body.key))return res.status(400).json({ok:false,message:"Unknown setting."});
        const value=body.value;
        if(body.key==="studio_links"){for(const item of Object.values(value||{})){if(item&&!/^https:\/\//i.test(String(item)))return res.status(400).json({ok:false,message:"Studio links must use HTTPS URLs."});}}
        if(body.key==="catalog_products" && Array.isArray(value)){for(const item of value){if(item.preview&&!/^https:\/\//i.test(String(item.preview)))return res.status(400).json({ok:false,message:"Audio preview links must use HTTPS URLs."});}}
        if(!value||typeof value!=="object")return res.status(400).json({ok:false,message:"Setting value must be an object or array."});
        const payload={setting_key:body.key,setting_value:value};
        const response=await db("studio_settings?on_conflict=setting_key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
        if(!response.ok)throw new Error("Setting save failed");
        return res.status(200).json({ok:true});
      }
      return res.status(400).json({ok:false,message:"Unknown update type."});
    } catch { return res.status(502).json({ok:false,message:"Could not save changes. Check the database schema and try again."}); }
  }
  res.setHeader("Allow","GET, PATCH");
  return res.status(405).json({ok:false,message:"Method not allowed."});
}
