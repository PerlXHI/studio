import { supabaseConfig, supabaseHeaders } from "./_admin.js";

const RESOURCES = {
  producers: {
    table: "producer_profiles",
    key: ["producer_id"],
    required: ["producer_id", "display_name"],
    archive: { is_visible: false },
    fields: {
      display_name: { type: "text", max: 100 },
      alias: { type: "text", max: 80 },
      role_title: { type: "text", max: 120 },
      biography: { type: "text", max: 4000 },
      avatar_url: { type: "url", max: 1000 },
      banner_url: { type: "url", max: 1000 },
      social_links: { type: "object" },
      specializations: { type: "stringArray" },
      genres: { type: "stringArray" },
      equipment: { type: "object" },
      credits: { type: "array" },
      commission_status: { type: "enum", values: ["open", "limited_slots", "waitlist", "closed", "not_listed"] },
      appearance: { type: "object" },
      is_visible: { type: "boolean" },
      display_order: { type: "integer" }
    }
  },
  categories: {
    table: "portfolio_categories",
    key: ["category_id"],
    required: ["category_id", "name"],
    archive: { is_visible: false },
    fields: {
      name: { type: "text", max: 80 },
      description: { type: "text", max: 1000 },
      is_visible: { type: "boolean" },
      display_order: { type: "integer" }
    }
  },
  works: {
    table: "works",
    key: ["work_id"],
    required: ["work_id", "slug", "title"],
    archive: { visibility: "archived" },
    fields: {
      slug: { type: "slug", max: 120 },
      title: { type: "text", max: 140 },
      description: { type: "text", max: 5000 },
      category_id: { type: "text", max: 60, nullable: true },
      cover_image_url: { type: "url", max: 1200 },
      video_url: { type: "url", max: 1200 },
      audio_url: { type: "url", max: 1200 },
      visibility: { type: "enum", values: ["draft", "published", "archived"] },
      is_featured: { type: "boolean" },
      display_order: { type: "integer" },
      metadata: { type: "object" }
    }
  },
  services: {
    table: "services",
    key: ["service_id"],
    required: ["service_id", "slug", "name"],
    archive: { status: "archived" },
    fields: {
      slug: { type: "slug", max: 120 },
      name: { type: "text", max: 140 },
      short_description: { type: "text", max: 260 },
      description: { type: "text", max: 5000 },
      thumbnail_url: { type: "url", max: 1200 },
      pricing_model: { type: "enum", values: ["fixed", "starting_at", "packages", "quote"] },
      starting_price: { type: "number", nullable: true },
      currency: { type: "text", max: 8 },
      legacy_price_label: { type: "text", max: 120 },
      estimated_delivery_days: { type: "integer", nullable: true },
      included_revisions: { type: "integer", nullable: true },
      deliverables: { type: "array" },
      client_requirements: { type: "array" },
      terms_markdown: { type: "text", max: 12000 },
      faq: { type: "array" },
      status: { type: "enum", values: ["draft", "published", "archived"] },
      display_order: { type: "integer" }
    }
  },
  service_packages: {
    table: "service_packages",
    key: ["package_id"],
    required: ["service_id", "name"],
    archive: { is_active: false },
    fields: {
      service_id: { type: "text", max: 80 },
      name: { type: "text", max: 120 },
      description: { type: "text", max: 2000 },
      price_amount: { type: "number", nullable: true },
      currency: { type: "text", max: 8 },
      estimated_delivery_days: { type: "integer", nullable: true },
      included_revisions: { type: "integer", nullable: true },
      deliverables: { type: "array" },
      is_active: { type: "boolean" },
      display_order: { type: "integer" }
    }
  },
  service_addons: {
    table: "service_addons",
    key: ["addon_id"],
    required: ["service_id", "name"],
    archive: { is_active: false },
    fields: {
      service_id: { type: "text", max: 80 },
      name: { type: "text", max: 120 },
      description: { type: "text", max: 2000 },
      price_amount: { type: "number", nullable: true },
      currency: { type: "text", max: 8 },
      additional_delivery_days: { type: "integer", nullable: true },
      is_active: { type: "boolean" },
      display_order: { type: "integer" }
    }
  },
  tos_versions: {
    table: "tos_versions",
    key: ["tos_version_id"],
    required: ["version_number", "title", "agreement_text"],
    archive: { status: "archived" },
    fields: {
      service_id: { type: "text", max: 80, nullable: true },
      version_number: { type: "integer" },
      title: { type: "text", max: 160 },
      agreement_text: { type: "text", max: 500 },
      status: { type: "enum", values: ["draft", "published", "archived"] },
      effective_at: { type: "text", max: 60 },
      published_at: { type: "text", max: 60 }
    }
  },
  tos_sections: {
    table: "tos_sections",
    key: ["tos_section_id"],
    required: ["tos_version_id", "section_key", "heading"],
    hardDelete: true,
    fields: {
      tos_version_id: { type: "text", max: 80 },
      section_key: { type: "slug", max: 80 },
      heading: { type: "text", max: 180 },
      content_markdown: { type: "text", max: 16000 },
      display_order: { type: "integer" }
    }
  },
  commission_forms: {
    table: "commission_forms",
    key: ["form_id"],
    required: ["service_id", "name"],
    archive: { is_active: false },
    fields: {
      service_id: { type: "text", max: 80 },
      name: { type: "text", max: 140 },
      description: { type: "text", max: 1000 },
      is_active: { type: "boolean" },
      display_order: { type: "integer" }
    }
  },
  commission_form_versions: {
    table: "commission_form_versions",
    key: ["form_version_id"],
    required: ["form_id", "version_number", "schema"],
    archive: { status: "archived" },
    fields: {
      form_id: { type: "text", max: 80 },
      version_number: { type: "integer" },
      status: { type: "enum", values: ["draft", "published", "archived"] },
      schema: { type: "object" },
      published_at: { type: "text", max: 60 }
    }
  },
  work_producers: {
    table: "work_producers",
    key: ["work_id", "producer_id"],
    required: ["work_id", "producer_id"],
    hardDelete: true,
    fields: {
      credit_role: { type: "text", max: 80 },
      display_order: { type: "integer" }
    }
  }
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function cleanText(value, max) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (text.length > max) fail("One or more text fields exceed the allowed length.");
  return text;
}

function normalizeValue(field, value) {
  const config = field;
  if (value === null && config.nullable) return null;
  if (config.type === "boolean") {
    if (typeof value !== "boolean") fail("Boolean fields must be true or false.");
    return value;
  }
  if (config.type === "number" || config.type === "integer") {
    if (value === "" || value === null || value === undefined) {
      if (config.nullable) return null;
      fail("A numeric field is missing.");
    }
    const number = Number(value);
    if (!Number.isFinite(number) || (config.type === "integer" && !Number.isSafeInteger(number))) {
      fail("Enter a valid number.");
    }
    if (number < 0) fail("Prices and numeric values cannot be negative.");
    return number;
  }
  if (config.type === "enum") {
    const normalized = cleanText(value, 80);
    if (!config.values.includes(normalized)) fail("A selected option is not supported.");
    return normalized;
  }
  if (config.type === "object" || config.type === "array" || config.type === "stringArray") {
    let parsed = value;
    if (typeof value === "string") {
      try { parsed = JSON.parse(value); } catch { fail("A JSON field contains invalid JSON."); }
    }
    if (config.type === "object" && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) {
      fail("This field must contain a JSON object.");
    }
    if ((config.type === "array" || config.type === "stringArray") && !Array.isArray(parsed)) {
      fail("This field must contain a JSON array.");
    }
    if (config.type === "stringArray") {
      if (parsed.some(item => typeof item !== "string")) fail("This list can only contain text values.");
      return parsed.map(item => cleanText(item, 160));
    }
    return parsed;
  }
  const normalized = cleanText(value, config.max || 2000);
  if (config.type === "slug" && normalized && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) {
    fail("Slug must use lowercase letters, numbers and single hyphens.");
  }
  if (config.type === "url" && normalized) {
    let parsed;
    try { parsed = new URL(normalized); } catch { fail("Enter a valid HTTP or HTTPS URL."); }
    if (!["https:", "http:"].includes(parsed.protocol)) fail("Only HTTP and HTTPS URLs are allowed.");
  }
  return normalized;
}

function validateIdentifiers(resource, values) {
  if (resource === "works" && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(values.work_id || "")) {
    fail("Work ID must use lowercase letters, numbers, hyphens or underscores.");
  }
  if (resource === "producers" && !/^[a-z0-9][a-z0-9_-]{1,49}$/.test(values.producer_id || "")) {
    fail("Producer ID must use lowercase letters, numbers, hyphens or underscores.");
  }
  if (resource === "categories" && !/^[a-z0-9][a-z0-9_-]{0,59}$/.test(values.category_id || "")) {
    fail("Category ID must use lowercase letters, numbers, hyphens or underscores.");
  }
  if (resource === "services" && !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(values.service_id || "")) {
    fail("Service ID must use lowercase letters, numbers, hyphens or underscores.");
  }
}

function normalizePayload(resource, raw, creating) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("Request body must be a JSON object.");
  const config = RESOURCES[resource];
  const allowed = new Set([...config.key, ...Object.keys(config.fields)]);
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key) || (!creating && config.key.includes(key))) {
      fail("Request contains a field that cannot be changed.");
    }
  }
  const result = {};
  for (const key of config.key) {
    if (creating && raw[key] !== undefined) result[key] = cleanText(raw[key], 120);
  }
  for (const [key, field] of Object.entries(config.fields)) {
    if (raw[key] !== undefined) result[key] = normalizeValue(field, raw[key]);
  }
  if (creating) {
    for (const field of config.required) {
      if (result[field] === undefined || result[field] === null || result[field] === "") {
        fail("Please complete all required fields.");
      }
    }
    validateIdentifiers(resource, result);
  } else {
    // Keep partial updates flexible, but never allow a required value to be blanked.
    for (const field of config.required) {
      if (config.key.includes(field) || raw[field] === undefined) continue;
      if (result[field] === null || (typeof result[field] === "string" && result[field] === "")) {
        fail("Required fields cannot be empty.");
      }
    }
  }
  if (!creating && !Object.keys(result).length) fail("No editable fields were provided.");
  return result;
}

function getFilters(resource, query, body = {}) {
  const config = RESOURCES[resource];
  const filters = {};
  for (const key of config.key) {
    const value = query?.[key] ?? (key === config.key[0] ? query?.id : undefined) ?? body?.[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      fail("A record ID is required.");
    }
    filters[key] = cleanText(value, 120);
  }
  validateIdentifiers(resource, filters);
  return filters;
}

async function validateFormServiceChange(filters, payload) {
  if (payload.service_id === undefined) return;
  const { url, key } = supabaseConfig();
  if (!url || !key) fail("CMS database connection is not configured.", 503);
  const base = url.replace(/\/$/, "");
  const headers = supabaseHeaders(key);
  const formParams = new URLSearchParams({ select: "service_id", form_id: "eq." + filters.form_id, limit: "1" });
  const formResponse = await fetch(base + "/rest/v1/commission_forms?" + formParams.toString(), { headers });
  const forms = await formResponse.json().catch(() => []);
  if (!formResponse.ok || !Array.isArray(forms) || !forms[0]) fail("Commission form could not be checked.", 502);
  if (forms[0].service_id === payload.service_id) return;
  const versionParams = new URLSearchParams({
    select: "form_version_id", form_id: "eq." + filters.form_id, status: "eq.published", limit: "1"
  });
  const versionResponse = await fetch(base + "/rest/v1/commission_form_versions?" + versionParams.toString(), { headers });
  const versions = await versionResponse.json().catch(() => []);
  if (!versionResponse.ok) fail("Published form versions could not be checked.", 502);
  if (Array.isArray(versions) && versions.length) {
    fail("A form with a published version cannot be reassigned to another service. Create a new commission form instead.");
  }
}

async function validatePublication(resource, filters, payload) {
  if (payload.status !== "published") return;
  const { url, key } = supabaseConfig();
  if (!url || !key) fail("CMS database connection is not configured.", 503);
  const headers = supabaseHeaders(key);
  if (resource === "commission_form_versions") {
    const params = new URLSearchParams({ select: "schema,status", form_version_id: "eq." + filters.form_version_id, limit: "1" });
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/commission_form_versions?" + params.toString(), { headers });
    const rows = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(rows) || !rows[0] || rows[0].status !== "draft") {
      fail("Only a saved draft form version can be published.", 400);
    }
    const schema = payload.schema || rows[0].schema;
    const fields = schema?.fields;
    const allowed = ["text","textarea","select","checkbox","email","url","number","date"];
    if (!Array.isArray(fields) || !fields.length || fields.length > 40) fail("Add between 1 and 40 commission form fields before publishing.");
    const ids = new Set();
    for (const field of fields) {
      if (!field || !/^[a-z][a-zA-Z0-9_-]{0,39}$/.test(field.id || "") ||
          ["form_version_id","service_id","tos_version_id","tos_accepted","answers","website"].includes(field.id) ||
          !cleanText(field.label || "", 160) || !allowed.includes(field.type) || ids.has(field.id)) {
        fail("Every commission form field needs a unique ID, label and supported field type.");
      }
      ids.add(field.id);
      if (field.type === "select" && (!Array.isArray(field.options) || !field.options.length || field.options.length > 50 ||
          field.options.some(option => typeof option !== "string" || !option.trim() || option.length > 160))) {
        fail("Every select field needs 1–50 valid text options.");
      }
      if (field.system && !["name","contact","license","moodBpm","duration","character","reference","deadline","budget","extra","type"].includes(field.system)) {
        fail("A commission form contains an unsupported system field.");
      }
      if (field.maxLength != null && (!Number.isInteger(Number(field.maxLength)) || Number(field.maxLength) < 1 || Number(field.maxLength) > 2000)) {
        fail("A commission form field has an invalid maximum length.");
      }
    }
    const systems = new Set();
    const systemTypes = { name: ["text","textarea"], contact: ["text","email"], license: ["text","select"], character: ["text","textarea"] };
    for (const field of fields) {
      if (!field.system) continue;
      if (systems.has(field.system)) fail("Each commission form system field can only appear once.");
      systems.add(field.system);
      if (systemTypes[field.system] && !systemTypes[field.system].includes(field.type)) {
        fail("A required contact or brief system field uses an unsupported field type.");
      }
    }
    for (const requiredSystem of ["name","contact","license","character"]) {
      if (!systems.has(requiredSystem)) fail("The form must include required system fields: name, contact, license and character.");
    }
  } else if (resource === "tos_versions") {
    const versionParams = new URLSearchParams({ select: "status", tos_version_id: "eq." + filters.tos_version_id, limit: "1" });
    const versionResponse = await fetch(url.replace(/\/$/, "") + "/rest/v1/tos_versions?" + versionParams.toString(), { headers });
    const versions = await versionResponse.json().catch(() => []);
    if (!versionResponse.ok || !Array.isArray(versions) || !versions[0] || versions[0].status !== "draft") {
      fail("Only a saved draft Terms version can be published.", 400);
    }
    const params = new URLSearchParams({
      select: "tos_section_id,heading,content_markdown",
      tos_version_id: "eq." + filters.tos_version_id,
      order: "display_order.asc",
      limit: "200"
    });
    const response = await fetch(url.replace(/\/$/, "") + "/rest/v1/tos_sections?" + params.toString(), { headers });
    const sections = await response.json().catch(() => []);
    if (!response.ok) fail("Terms sections could not be checked before publishing.", 502);
    if (!Array.isArray(sections) || !sections.length || sections.some(section => !String(section.content_markdown || "").trim())) {
      fail("Add at least one complete Terms section before publishing.");
    }
  }
}

async function sendDb(resource, method, payload, filters) {
  const config = RESOURCES[resource];
  const { url, key } = supabaseConfig();
  if (!url || !key) fail("CMS database connection is not configured.", 503);
  const params = new URLSearchParams();
  if (filters) for (const [field, value] of Object.entries(filters)) params.set(field, "eq." + value);
  params.set("select", "*");
  const endpoint = url + "/rest/v1/" + config.table + "?" + params.toString();
  const response = await fetch(endpoint, {
    method,
    headers: supabaseHeaders(key, {
      "Content-Type": "application/json",
      Prefer: "return=representation"
    }),
    ...(payload ? { body: JSON.stringify(payload) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 409 || result.code === "23505" || result.code === "23503") {
      fail("This record conflicts with existing data or a linked record.", 409);
    }
    if (result.code === "23514" || result.code === "22P02" || result.code === "22001") {
      fail("Some values do not satisfy the database rules.", 400);
    }
    console.error("[admin-cms] Write failed", { resource, method, status: response.status, code: result.code || "unknown" });
    fail("CMS changes could not be saved. Check the field values and database connection.", 502);
  }
  if (method !== "POST" && Array.isArray(result) && result.length === 0) {
    fail("The requested record was not found.", 404);
  }
  return result;
}

export function getMutableCmsResources() {
  return Object.keys(RESOURCES);
}

export async function createCmsRecord(resource, raw) {
  if (!RESOURCES[resource]) fail("This CMS resource cannot be changed.");
  const payload = normalizePayload(resource, raw, true);
  if (["tos_versions","commission_form_versions"].includes(resource) && payload.status === "published") {
    fail("Create a draft version first, then publish it after review.");
  }
  return sendDb(resource, "POST", payload);
}

export async function updateCmsRecord(resource, query, raw) {
  if (!RESOURCES[resource]) fail("This CMS resource cannot be changed.");
  const filters = getFilters(resource, query, raw);
  const payload = normalizePayload(resource, raw, false);
  if (resource === "commission_forms") await validateFormServiceChange(filters, payload);
  await validatePublication(resource, filters, payload);
  return sendDb(resource, "PATCH", payload, filters);
}

export async function archiveCmsRecord(resource, query, raw = {}) {
  const config = RESOURCES[resource];
  if (!config) fail("This CMS resource cannot be changed.");
  const filters = getFilters(resource, query, raw);
  if (config.hardDelete) return sendDb(resource, "DELETE", null, filters);
  return sendDb(resource, "PATCH", config.archive, filters);
}
