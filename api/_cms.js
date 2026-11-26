import { supabaseConfig, supabaseHeaders } from "./_admin.js";

const RESOURCES = {
  producers: {
    table: "producer_profiles",
    admin: "select=*&order=display_order.asc&limit=500",
    public: "select=producer_id,display_name,alias,role_title,biography,avatar_url,banner_url,social_links,specializations,genres,equipment,credits,commission_status,appearance,display_order&is_visible=eq.true&order=display_order.asc&limit=500"
  },
  categories: {
    table: "portfolio_categories",
    admin: "select=*&order=display_order.asc&limit=300",
    public: "select=category_id,name,description,display_order&is_visible=eq.true&order=display_order.asc&limit=300"
  },
  works: {
    table: "works",
    admin: "select=*&order=display_order.asc&limit=1000",
    public: "select=work_id,slug,title,description,category_id,cover_image_url,video_url,audio_url,is_featured,display_order,metadata&visibility=eq.published&order=display_order.asc&limit=1000"
  },
  work_producers: {
    table: "work_producers",
    admin: "select=*&order=display_order.asc&limit=2000",
    public: "select=work_id,producer_id,credit_role,display_order,work:works!inner(visibility)&work.visibility=eq.published&order=display_order.asc&limit=2000"
  },
  services: {
    table: "services",
    admin: "select=*&order=display_order.asc&limit=500",
    public: "select=service_id,slug,name,short_description,description,thumbnail_url,pricing_model,starting_price,currency,legacy_price_label,estimated_delivery_days,included_revisions,deliverables,client_requirements,terms_markdown,faq,display_order&status=eq.published&order=display_order.asc&limit=500"
  },
  service_packages: {
    table: "service_packages",
    admin: "select=*&order=display_order.asc&limit=1000",
    public: "select=package_id,service_id,name,description,price_amount,currency,estimated_delivery_days,included_revisions,deliverables,display_order,service:services!inner(service_id)&is_active=eq.true&service.status=eq.published&order=display_order.asc&limit=1000"
  },
  service_addons: {
    table: "service_addons",
    admin: "select=*&order=display_order.asc&limit=1000",
    public: "select=addon_id,service_id,name,description,price_amount,currency,additional_delivery_days,display_order,service:services!inner(service_id)&is_active=eq.true&service.status=eq.published&order=display_order.asc&limit=1000"
  },
  tos_versions: {
    table: "tos_versions",
    admin: "select=*&order=created_at.desc&limit=500",
    public: "select=tos_version_id,service_id,version_number,title,agreement_text,status,effective_at,published_at&status=eq.published&order=effective_at.desc&limit=500"
  },
  tos_sections: {
    table: "tos_sections",
    admin: "select=*&order=display_order.asc&limit=2000",
    public: "select=tos_section_id,tos_version_id,section_key,heading,content_markdown,display_order,version:tos_versions!inner(status,service_id)&version.status=eq.published&order=display_order.asc&limit=2000"
  },
  commission_forms: {
    table: "commission_forms",
    admin: "select=*&order=display_order.asc&limit=500",
    public: "select=form_id,service_id,name,description,is_active,display_order,service:services!inner(status)&is_active=eq.true&service.status=eq.published&order=display_order.asc&limit=500"
  },
  commission_form_versions: {
    table: "commission_form_versions",
    admin: "select=*&order=created_at.desc&limit=1000",
    public: "select=form_version_id,form_id,version_number,status,schema,published_at,form:commission_forms!inner(service_id,is_active,service:services!inner(status))&status=eq.published&form.is_active=eq.true&form.service.status=eq.published&order=version_number.desc&limit=1000"
  }
};

function createConfigError() {
  const error = new Error("CMS database connection is not configured.");
  error.status = 503;
  return error;
}

export function getCmsResourceNames(mode = "admin") {
  return Object.keys(RESOURCES).filter(name => mode === "admin" || typeof RESOURCES[name].public === "string");
}

export async function readCmsResource(resource, mode = "admin") {
  const config = RESOURCES[resource];
  if (!config || (mode === "public" && !config.public)) {
    const error = new Error("Unknown CMS resource.");
    error.status = 400;
    throw error;
  }

  const { url, key } = supabaseConfig();
  if (!url || !key) throw createConfigError();

  const query = mode === "public" ? config.public : config.admin;
  const response = await fetch(url + "/rest/v1/" + config.table + "?" + query, {
    headers: supabaseHeaders(key)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.details || "CMS data could not be loaded.");
    error.status = 502;
    error.resource = resource;
    throw error;
  }
  return Array.isArray(payload) ? payload : [];
}
