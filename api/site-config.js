import { supabaseConfig, supabaseHeaders } from "./_admin.js";
export default async function handler(req,res) {
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({ok:false});}
  const {url,key}=supabaseConfig();
  if(!url||!key)return res.status(200).json({ok:true,settings:{}});
  try {
    const response=await fetch(url+"/rest/v1/studio_settings?select=setting_key,setting_value",{
      headers:supabaseHeaders(key)
    });
    if(!response.ok)return res.status(200).json({ok:true,settings:{}});
    const rows=await response.json(),settings={};
    for(const row of rows)settings[row.setting_key]=row.setting_value;
    if(Array.isArray(settings.freebies))settings.freebies=settings.freebies.filter(item=>item&&item.published===true);
    res.setHeader("Cache-Control","public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({ok:true,settings});
  } catch { return res.status(200).json({ok:true,settings:{}}); }
}
