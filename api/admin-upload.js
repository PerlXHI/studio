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
    const errorText = await response.text().catch(() => "");
    let detail = {};
    try { detail = JSON.parse(errorText); } catch {}
    const reason = String(detail.message || detail.error || detail.hint || errorText || "");
    const bucketMissing = response.status === 400 && /bucket not found/i.test(reason);
    if (!bucketMissing) {
      throw new Error("Could not check the Supabase Storage bucket. HTTP " + response.status + ": " + (reason || "No error details were returned by Supabase.").slice(0, 500));
    }
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
  if (!["POST","DELETE"].includes(req.method)) {
    res.setHeader("Allow", "POST, DELETE");
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

  const { url, key } = supabaseConfig();
  if (!url || !key) return send(res, 503, { ok: false, message: "Supabase server configuration is missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel." });

  if (req.method === "DELETE") {
    const path = String(body.path || "");
    if (!/^(bgm|sound-alerts|stinger)\/\d{4}\/\d{2}\/[a-zA-Z0-9_-]+\.mp3$/.test(path)) {
      return send(res, 400, { ok: false, message: "Invalid staged Freebies file path." });
    }
    try {
      const settingsResponse = await fetch(url + "/rest/v1/studio_settings?setting_key=eq.freebies&select=setting_value", {
        headers: supabaseHeaders(key)
      });
      if (!settingsResponse.ok) return send(res, 502, { ok: false, message: "Could not verify whether this file is already in use." });
      const rows = await settingsResponse.json();
      const releases = Array.isArray(rows[0]?.setting_value) ? rows[0].setting_value : [];
      const isUsed = releases.some(item => ["download_url","preview_url","cover_url"].some(field => {
        try {
          const parsed = new URL(String(item?.[field] || ""));
          const project = new URL(url);
          const prefix = "/storage/v1/object/public/freebies/";
          return parsed.origin === project.origin && parsed.pathname.startsWith(prefix) &&
            parsed.pathname.slice(prefix.length).split("/").map(decodeURIComponent).join("/") === path;
        } catch { return false; }
      }));
      if (isUsed) return send(res, 409, { ok: false, message: "This file is already used by a saved Freebies release." });
      const deleted = await fetch(url + "/storage/v1/object/" + BUCKET + "/" + encodePath(path), {
        method: "DELETE",
        headers: supabaseHeaders(key)
      });
      if (!deleted.ok && deleted.status !== 404) return send(res, 502, { ok: false, message: "Could not remove the unused file from Supabase Storage." });
      return send(res, 200, { ok: true, deleted: deleted.status !== 404 });
    } catch (error) {
      console.error("[admin-upload] Unused file cleanup failed", { name: error?.name || "Error" });
      return send(res, 502, { ok: false, message: "Could not remove the unused file from Supabase Storage." });
    }
  }

  if (body.assetType === "image") {
    const fileName=String(body.fileName||"").trim(),mimeType=String(body.mimeType||"").toLowerCase(),fileSize=Number(body.fileSize),category=String(body.category||"");
    const allowedTypes=new Set(["image/jpeg","image/png","image/webp","image/avif"]);
    if(!["producers","portfolio"].includes(category))return send(res,400,{ok:false,message:"Choose a valid image destination."});
    if(!fileName||!allowedTypes.has(mimeType))return send(res,400,{ok:false,message:"Use a JPG, PNG, WebP, or AVIF image."});
    if(!Number.isSafeInteger(fileSize)||fileSize<=0||fileSize>10*1024*1024)return send(res,400,{ok:false,message:"Images must be between 1 byte and 10 MB."});
    try{
      const bucket="studio-assets",bucketUrl=url+"/storage/v1/bucket/"+bucket;
      let check=await fetch(bucketUrl,{headers:supabaseHeaders(key)});
      if(!check.ok){
        if(check.status!==404 && check.status!==400)throw new Error("Could not check the studio-assets bucket.");
        const create=await fetch(url+"/storage/v1/bucket",{method:"POST",headers:supabaseHeaders(key,{"Content-Type":"application/json"}),body:JSON.stringify({id:bucket,name:bucket,public:true,file_size_limit:10*1024*1024,allowed_mime_types:[...allowedTypes]})});
        if(!create.ok&&create.status!==409){const detail=await create.json().catch(()=>({}));throw new Error(detail.message||"Could not create the public studio-assets bucket.");}
      }else{const bucketInfo=await check.json().catch(()=>({}));if(bucketInfo.public!==true)throw new Error("The studio-assets bucket exists but is private. Make it public in Supabase Storage.");}
      const extension=mimeType==="image/jpeg"?"jpg":mimeType.split("/")[1],base=fileName.replace(/\\/g,"/").split("/").pop().replace(/\.[^.]+$/,"").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g,"-").slice(0,55)||"image";
      const now=new Date(),path=category+"/"+now.getUTCFullYear()+"/"+String(now.getUTCMonth()+1).padStart(2,"0")+"/"+base+"-"+randomUUID().slice(0,8)+"."+extension;
      const encoded=encodePath(path),signedResponse=await fetch(url+"/storage/v1/object/upload/sign/"+bucket+"/"+encoded,{method:"POST",headers:supabaseHeaders(key,{"Content-Type":"application/json"}),body:JSON.stringify({upsert:false})});
      const signed=await signedResponse.json().catch(()=>({}));if(!signedResponse.ok||!signed.token)return send(res,502,{ok:false,message:signed.message||"Could not prepare the image upload."});
      const uploadUrl=url+"/storage/v1/object/upload/sign/"+bucket+"/"+encoded+"?token="+encodeURIComponent(signed.token);
      return send(res,200,{ok:true,bucket,path,uploadUrl,publicUrl:url+"/storage/v1/object/public/"+bucket+"/"+encoded,maxFileSize:10*1024*1024});
    }catch(error){console.error("[admin-upload] Image upload preparation failed",{name:error?.name||"Error"});return send(res,502,{ok:false,message:error.message||"Could not prepare the image upload."});}
  }
  const fileName = String(body.fileName || "").trim();
  const fileSize = Number(body.fileSize);
  const category = String(body.category || "");
  if (!fileName || !/\.mp3$/i.test(fileName)) return send(res, 400, { ok: false, message: "Choose an MP3 file (.mp3)." });
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
    return send(res, 400, { ok: false, message: "MP3 files must be between 1 byte and 50 MB." });
  }
  if (!CATEGORIES.has(category)) return send(res, 400, { ok: false, message: "Choose BGM, Sound Alerts, or Stinger." });

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
