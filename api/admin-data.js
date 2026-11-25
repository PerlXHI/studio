import { isAdmin, supabaseConfig, supabaseHeaders, hasTrustedOrigin } from "./_admin.js";

const STATUSES=["Awaiting Review","Quotation Sent","Awaiting Payment","In Production","Revision","Completed","On Hold","Cancelled","Waiting for client response","Demo ready — Awaiting feedback","Preparing final delivery"];
const STATUS_NOTES={
  "Awaiting Review":"Request received",
  "Quotation Sent":"Check Discord",
  "Awaiting Payment":"Payment required",
  "In Production":"Work in progress",
  "Revision":"Adjustments in progress",
  "Completed":"Final files ready",
  "On Hold":"Temporarily paused",
  "Cancelled":"Request cancelled",
  "Waiting for client response":"Waiting for client response",
  "Demo ready — Awaiting feedback":"Demo ready — Awaiting feedback",
  "Preparing final delivery":"Preparing final delivery"
};
const KEYS=["service_prices","studio_links","portfolio_videos","portfolio_categories","studio_producers","freebies","commission_status","audio_player"];
function storageObjectPath(rawUrl,projectUrl){
  if(!rawUrl)return "";
  try{
    const parsed=new URL(String(rawUrl));
    const project=new URL(projectUrl);
    if(parsed.protocol!=="https:"||parsed.origin!==project.origin)return "";
    const prefix="/storage/v1/object/public/freebies/";
    if(!parsed.pathname.startsWith(prefix))return "";
    const encodedPath=parsed.pathname.slice(prefix.length);
    if(!encodedPath||encodedPath.split("/").some(part=>!part||part==="."||part===".."))return "";
    return encodedPath.split("/").map(part=>decodeURIComponent(part)).join("/");
  }catch{return ""}
}
function studioAssetObjectPath(rawUrl,projectUrl){
  if(!rawUrl)return "";
  try{const parsed=new URL(String(rawUrl)),project=new URL(projectUrl),prefix="/storage/v1/object/public/studio-assets/";if(parsed.protocol!=="https:"||parsed.origin!==project.origin||!parsed.pathname.startsWith(prefix))return "";const encoded=parsed.pathname.slice(prefix.length);if(!encoded||encoded.split("/").some(part=>!part||part==="."||part===".."))return "";return encoded.split("/").map(part=>decodeURIComponent(part)).join("/")}catch{return ""}
}
function collectStudioAssetPaths(value,projectUrl,paths=new Set()){
  if(typeof value==="string"){const path=studioAssetObjectPath(value,projectUrl);if(path)paths.add(path)}
  else if(Array.isArray(value))value.forEach(item=>collectStudioAssetPaths(item,projectUrl,paths));
  else if(value&&typeof value==="object")Object.values(value).forEach(item=>collectStudioAssetPaths(item,projectUrl,paths));
  return paths;
}
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
        if(body.status!==undefined){if(!STATUSES.includes(body.status))return res.status(400).json({ok:false,message:"Invalid status."});patch.status=body.status;patch.status_note=STATUS_NOTES[body.status];}
        for(const field of ["preview_url","delivery_url","quoted_price","quotation_note","admin_note"]) {
          if(body[field]!==undefined) {
            const value=String(body[field]??"").trim();
            if(value.length>1600)return res.status(400).json({ok:false,message:"A field is too long."});
            if(["preview_url","delivery_url"].includes(field) && value && !/^https:\/\//i.test(value))return res.status(400).json({ok:false,message:"Links must use HTTPS."});
            if(field==="quoted_price" && value && !/^[0-9.,\sA-Za-zRp$+-]{1,40}$/.test(value))return res.status(400).json({ok:false,message:"Invalid quoted price."});
            patch[field]=value;
          }
        }
        if(body.production_updates!==undefined){const lines=String(body.production_updates??"").split(/\r?\n/).map(value=>value.trim()).filter(Boolean);if(lines.length>20||lines.some(value=>value.length>220))return res.status(400).json({ok:false,message:"Use up to 20 progress updates, each no longer than 220 characters."});patch.production_updates=lines.map(text=>({text,at:new Date().toISOString()}));}
        if(!id||!Object.keys(patch).length)return res.status(400).json({ok:false,message:"No order changes supplied."});
        const response=await db("commission_requests?request_id=eq."+encodeURIComponent(id),{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify(patch)});
        if(!response.ok)throw new Error("Update failed");
        const rows=await response.json(); if(!rows.length)return res.status(404).json({ok:false,message:"Order not found."});
        return res.status(200).json({ok:true,order:rows[0]});
      }
      if(body.kind==="setting") {
        if(!KEYS.includes(body.key))return res.status(400).json({ok:false,message:"Unknown setting."});
        const value=body.value;
        if(body.key==="commission_status"){
          const item=value||{};
          const allowed=["Open","Limited slots","Waitlist","Closed"];
          if(!allowed.includes(String(item.status||"")))return res.status(400).json({ok:false,message:"Choose a valid commission status."});
          if(String(item.batch||"").length>60||String(item.slots||"").length>80)return res.status(400).json({ok:false,message:"Commission status details are too long."});
        }
        if(body.key==="studio_links"){for(const [name,item] of Object.entries(value||{})){if(!item)continue;if(name==="email"){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(item)))return res.status(400).json({ok:false,message:"Enter a valid contact email address."});}else if(!/^https:\/\//i.test(String(item)))return res.status(400).json({ok:false,message:"Studio links must use HTTPS URLs."});}}
        if(body.key==="portfolio_videos" && Array.isArray(value)){
          const allowed=["youtube.com","www.youtube.com","youtube-nocookie.com","www.youtube-nocookie.com","youtu.be","vimeo.com","www.vimeo.com","player.vimeo.com"];
          
          for(const item of value){
            const urls=Array.isArray(item.videos)?item.videos:(item.url?[item.url]:[]);
            if(urls.length>30)return res.status(400).json({ok:false,message:"A category can contain up to 30 video previews."});
            for(const rawUrl of urls){let parsed;try{parsed=new URL(String(rawUrl))}catch{return res.status(400).json({ok:false,message:"Enter a valid YouTube or Vimeo URL."})}if(parsed.protocol!=="https:"||!allowed.includes(parsed.hostname.toLowerCase()))return res.status(400).json({ok:false,message:"Portfolio previews must use HTTPS YouTube or Vimeo URLs."});}
            if(item.featured&&!urls.includes(item.featured))return res.status(400).json({ok:false,message:"Featured video must match one of the category preview URLs."});
            if(item.video_assignments!==undefined&&!Array.isArray(item.video_assignments))return res.status(400).json({ok:false,message:"Producer credits must be a list of video assignments."});
            const assignments=Array.isArray(item.video_assignments)?item.video_assignments:[];
            if(assignments.length>30)return res.status(400).json({ok:false,message:"A category can contain up to 30 producer credits."});
            const assignedUrls=new Set();
            for(const assignment of assignments){
              const assignedUrl=String(assignment&&assignment.url||"");
              const creator=String(assignment&&assignment.creator||"");
              if(!urls.includes(assignedUrl))return res.status(400).json({ok:false,message:"Each producer credit must match a video URL in the same category."});
              if(!/^[a-z0-9][a-z0-9_-]{1,49}$/.test(creator))return res.status(400).json({ok:false,message:"Choose a valid producer for each video credit."});
              if(assignedUrls.has(assignedUrl))return res.status(400).json({ok:false,message:"Each video can only be credited once per category."});
              assignedUrls.add(assignedUrl);
            }
          }
        }
        if(body.key==="freebies" && Array.isArray(value)){
          const allowedCategories=["bgm","sound-alerts","stinger"];
          const allowedArtists=["Perivelle Studio","bybi","rei","yoz"];
          if(value.length>100)return res.status(400).json({ok:false,message:"The Freebies library can contain up to 100 releases."});
          const ids=new Set();
          for(const item of value){
            const id=String(item&&item.id||"").trim();
            const title=String(item&&item.title||"").trim();
            const category=String(item&&item.category||"");
            const artist=String(item&&item.artist||"");
            const date=String(item&&item.release_date||"");
            const description=String(item&&item.description||"");
            const downloadUrl=String(item&&item.download_url||"").trim();
            const previewUrl=String(item&&item.preview_url||"").trim();
            const coverUrl=String(item&&item.cover_url||"").trim();
            const usageNote=String(item&&item.usage_note||"");
            if(!id||id.length>120||!/^[a-zA-Z0-9_-]+$/.test(id))return res.status(400).json({ok:false,message:"Each freebie needs a valid unique release ID."});
            if(ids.has(id))return res.status(400).json({ok:false,message:"Each freebie must have a unique release ID."});
            ids.add(id);
            if(!title||title.length>100)return res.status(400).json({ok:false,message:"Each freebie needs a title up to 100 characters."});
            if(!allowedCategories.includes(category))return res.status(400).json({ok:false,message:"Choose BGM, Sound Alerts, or Stinger as the audio type."});
            if(!allowedArtists.includes(artist))return res.status(400).json({ok:false,message:"Choose a valid artist or Perivelle Studio as the credit."});
            if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(new Date(date+"T00:00:00Z").getTime())||new Date(date+"T00:00:00Z").toISOString().slice(0,10)!==date)return res.status(400).json({ok:false,message:"Each freebie needs a valid release date."});
            if(description.length>420||usageNote.length>700)return res.status(400).json({ok:false,message:"The description or usage notes are too long."});
            if(typeof item.published!=="boolean")return res.status(400).json({ok:false,message:"Set each release to published or draft."});
            let parsedDownload;try{parsedDownload=new URL(downloadUrl)}catch{return res.status(400).json({ok:false,message:"Enter a direct download file URL."})}
            if(parsedDownload.protocol!=="https:")return res.status(400).json({ok:false,message:"Freebie download links must use HTTPS."});
            for(const [label,rawUrl] of [["preview",previewUrl],["cover",coverUrl]]){
              if(!rawUrl)continue;
              let parsed;try{parsed=new URL(rawUrl)}catch{return res.status(400).json({ok:false,message:"Enter a valid HTTPS "+label+" URL or leave it blank."})}
              if(parsed.protocol!=="https:")return res.status(400).json({ok:false,message:"Freebie "+label+" links must use HTTPS."});
            }
          }
        }
        if(body.key==="audio_player"){
          const audioSettings=value&&typeof value==="object"?value:{};
          const tracks=Array.isArray(audioSettings.tracks)?audioSettings.tracks:[];
          if(tracks.length>12)return res.status(400).json({ok:false,message:"The player supports up to 12 tracks."});
          for(const track of tracks){
            const title=String(track.title||"").trim(),artist=String(track.artist||"").trim(),src=String(track.src||"").trim(),cover=String(track.cover||"").trim();
            if(!title||title.length>80||artist.length>80)return res.status(400).json({ok:false,message:"Each audio track needs a title (up to 80 characters) and an artist name up to 80 characters."});
            let parsed;try{parsed=new URL(src)}catch{return res.status(400).json({ok:false,message:"Enter a valid direct audio file URL for every track."})}
            if(parsed.protocol!=="https:")return res.status(400).json({ok:false,message:"Audio files must use HTTPS URLs."});
            if(cover){let image;try{image=new URL(cover)}catch{return res.status(400).json({ok:false,message:"Enter a valid cover image URL or leave it blank."})}if(image.protocol!=="https:")return res.status(400).json({ok:false,message:"Cover images must use HTTPS URLs."});}
          }
          if(audioSettings.enabled!==undefined&&typeof audioSettings.enabled!=="boolean")return res.status(400).json({ok:false,message:"Player visibility must be enabled or disabled."});
        }
        if(!value||typeof value!=="object")return res.status(400).json({ok:false,message:"Setting value must be an object or array."});
        let removedStorageFiles=0;
        let storageCleanupWarning="";
        let removedPaths=new Set();
        let removedAssetPaths=new Set();
        if(body.key==="freebies" && Array.isArray(value)){
          const currentResponse=await db("studio_settings?setting_key=eq.freebies&select=setting_value");
          if(!currentResponse.ok)throw new Error("Could not read the current Freebies list.");
          const currentRows=await currentResponse.json();
          const previous=Array.isArray(currentRows[0]?.setting_value)?currentRows[0].setting_value:[];
          const nextPaths=new Set();
          for(const item of value) for(const field of ["download_url","preview_url","cover_url"]){
            const path=storageObjectPath(item?.[field],url);
            if(path)nextPaths.add(path);
          }
          for(const item of previous) for(const field of ["download_url","preview_url","cover_url"]){
            const path=storageObjectPath(item?.[field],url);
            if(path&&!nextPaths.has(path))removedPaths.add(path);
          }
        }
        if(body.key==="studio_producers"){
          const currentResponse=await db("studio_settings?select=setting_key,setting_value");
          if(!currentResponse.ok)throw new Error("Could not inspect existing studio image references.");
          const currentRows=await currentResponse.json();
          const previous=currentRows.find(row=>row.setting_key===body.key)?.setting_value;
          const oldPaths=collectStudioAssetPaths(previous,url);
          const nextSettings=currentRows.map(row=>row.setting_key===body.key?{...row,setting_value:value}:row);
          if(!currentRows.some(row=>row.setting_key===body.key))nextSettings.push({setting_key:body.key,setting_value:value});
          const retained=collectStudioAssetPaths(nextSettings,url);
          for(const path of oldPaths)if(!retained.has(path))removedAssetPaths.add(path);
        }
        const payload={setting_key:body.key,setting_value:value};
        const response=await db("studio_settings?on_conflict=setting_key",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify(payload)});
        if(!response.ok)throw new Error("Setting save failed");
        if(removedPaths.size){
          try {
            const deleteResponse=await fetch(url+"/storage/v1/object/freebies",{
              method:"DELETE",
              headers:supabaseHeaders(key,{"Content-Type":"application/json"}),
              body:JSON.stringify({prefixes:[...removedPaths]})
            });
            if(deleteResponse.ok){
              const deletedItems=await deleteResponse.json().catch(()=>null);
              removedStorageFiles=Array.isArray(deletedItems)?deletedItems.length:0;
              if(removedStorageFiles<removedPaths.size)storageCleanupWarning="The Freebies list was saved. Storage accepted the cleanup request, but deletion of every old file could not be confirmed.";
            } else storageCleanupWarning="The Freebies list was saved, but some old files could not be deleted from Storage.";
          } catch {
            storageCleanupWarning="The Freebies list was saved, but Storage cleanup could not connect. Please check for unused files in the freebies bucket.";
          }
        }
        if(removedAssetPaths.size){
          try{
            const deleted=await fetch(url+"/storage/v1/object/studio-assets",{method:"DELETE",headers:supabaseHeaders(key,{"Content-Type":"application/json"}),body:JSON.stringify({prefixes:[...removedAssetPaths]})});
            if(deleted.ok){const items=await deleted.json().catch(()=>null);removedStorageFiles+=Array.isArray(items)?items.length:0;if(!Array.isArray(items)||items.length<removedAssetPaths.size)storageCleanupWarning="Settings saved. Some old image files may remain in studio-assets Storage."}
            else storageCleanupWarning="Settings saved, but some old images could not be deleted from studio-assets Storage.";
          }catch{storageCleanupWarning="Settings saved, but image cleanup could not connect to Storage."}
        }
        return res.status(200).json({ok:true,removedStorageFiles,warning:storageCleanupWarning});
      }
      return res.status(400).json({ok:false,message:"Unknown update type."});
    } catch { return res.status(502).json({ok:false,message:"Could not save changes. Check the database schema and try again."}); }
  }
  res.setHeader("Allow","GET, PATCH");
  return res.status(405).json({ok:false,message:"Method not allowed."});
}
