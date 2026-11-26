function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function safeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch { fail("Commission form answers are invalid."); }
  }
  return {};
}

async function readRows(baseUrl, headers, table, params) {
  const response = await fetch(baseUrl + "/rest/v1/" + table + "?" + params.toString(), { headers });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    console.error("[commission-cms] CMS read failed", { table, status: response.status, detail });
    fail("The commission form could not be verified. Please refresh and try again.", 503);
  }
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function cleanAnswer(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
}

function validateFieldValue(field, raw) {
  const type = field.type;
  const maxLength = Math.min(2000, Math.max(1, Number(field.maxLength) || (type === "textarea" ? 1500 : 500)));
  if (type === "checkbox") {
    const value = raw === true || raw === "true" || raw === "on" || raw === "1";
    if (field.required && !value) fail("Please complete: " + field.label + ".");
    return value;
  }
  const value = cleanAnswer(raw, maxLength);
  if (field.required && !value) fail("Please complete: " + field.label + ".");
  if (value.length < (Number(field.minLength) || 0)) fail(field.label + " is too short.");
  if (!value) return "";
  if (type === "select" && (!Array.isArray(field.options) || !field.options.includes(value))) {
    fail("Choose a valid option for " + field.label + ".");
  }
  if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail("Enter a valid email address for " + field.label + ".");
  if (type === "url") {
    let parsed;
    try { parsed = new URL(value); } catch { fail("Enter a valid link for " + field.label + "."); }
    if (!["https:","http:"].includes(parsed.protocol)) fail("Only HTTP and HTTPS links are accepted for " + field.label + ".");
  }
  if (type === "number") {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) fail("Enter a valid number for " + field.label + ".");
    if (field.min != null && numeric < Number(field.min)) fail(field.label + " is below the minimum.");
    if (field.max != null && numeric > Number(field.max)) fail(field.label + " is above the maximum.");
    return numeric;
  }
  if (type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("Enter a valid date for " + field.label + ".");
  return value;
}

export async function validateCmsCommissionSubmission({ data, baseUrl, headers }) {
  const serviceId = String(data.service_id || "").trim();
  let service = null;
  if (serviceId) {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(serviceId)) fail("Choose a valid service.");
    const serviceParams = new URLSearchParams({
      select: "service_id,name,status",
      service_id: "eq." + serviceId,
      status: "eq.published",
      limit: "1"
    });
    service = (await readRows(baseUrl, headers, "services", serviceParams))[0] || null;
    if (!service) fail("This service is no longer accepting commission requests. Please refresh the page.");
    data.type = service.name;
  }

  let formSnapshot = null;
  let answers = {};
  let customFields = [];
  if (data.form_version_id) {
    if (!serviceId) fail("Select a service before submitting this form.");
    const formParams = new URLSearchParams({
      select: "form_version_id,form_id,version_number,schema,form:commission_forms!inner(service_id,is_active)",
      form_version_id: "eq." + String(data.form_version_id),
      status: "eq.published",
      "form.is_active": "eq.true",
      limit: "1"
    });
    const formVersion = (await readRows(baseUrl, headers, "commission_form_versions", formParams))[0] || null;
    if (!formVersion || formVersion.form?.service_id !== serviceId) {
      fail("This commission form has changed. Refresh the page and try again.");
    }
    const schemaFields = formVersion.schema?.fields;
    if (!Array.isArray(schemaFields) || !schemaFields.length || schemaFields.length > 40) {
      fail("The published commission form is not configured correctly. Please contact Perivelle.", 503);
    }
    const rawAnswers = safeObject(data.answers);
    const allowedTypes = ["text","textarea","select","checkbox","email","url","number","date"];
    const seen = new Set();
    const systemValues = {};
    for (const field of schemaFields) {
      if (!field || !/^[a-z][a-zA-Z0-9_-]{0,39}$/.test(field.id || "") ||
          !String(field.label || "").trim() || !allowedTypes.includes(field.type) || seen.has(field.id)) {
        fail("The published commission form contains an invalid field. Please contact Perivelle.", 503);
      }
      seen.add(field.id);
      const raw = Object.prototype.hasOwnProperty.call(rawAnswers, field.id) ? rawAnswers[field.id] : data[field.id];
      const value = validateFieldValue(field, raw);
      answers[field.id] = value;
      if (field.system && ["name","contact","license","moodBpm","duration","character","reference","deadline","budget","extra"].includes(field.system)) {
        systemValues[field.system] = value;
      }
      customFields.push({ name: cleanAnswer(field.label, 100) || field.id, value: cleanAnswer(value, 900) || "—" });
    }
    for (const key of ["name","contact","license","character"]) {
      if (!String(systemValues[key] ?? "").trim()) fail("The commission form is missing a required contact or brief field. Please contact Perivelle.", 503);
    }
    for (const [key, value] of Object.entries(systemValues)) data[key] = value;
    formSnapshot = {
      form_id: formVersion.form_id,
      form_version_id: formVersion.form_version_id,
      version_number: formVersion.version_number,
      schema: formVersion.schema
    };
  }

  let tosSnapshot = null;
  let tosVersionId = null;
  let tosAcceptedAt = null;
  if (serviceId) {
    const specificParams = new URLSearchParams({
      select: "tos_version_id,service_id,version_number,title,agreement_text,effective_at,published_at",
      service_id: "eq." + serviceId,
      status: "eq.published",
      limit: "1"
    });
    const globalParams = new URLSearchParams({
      select: "tos_version_id,service_id,version_number,title,agreement_text,effective_at,published_at",
      service_id: "is.null",
      status: "eq.published",
      limit: "1"
    });
    const [specific, global] = await Promise.all([
      readRows(baseUrl, headers, "tos_versions", specificParams),
      readRows(baseUrl, headers, "tos_versions", globalParams)
    ]);
    const applicable = specific[0] || global[0] || null;
    if (applicable) {
      if (String(data.tos_version_id || "") !== applicable.tos_version_id ||
          !(data.tos_accepted === true || data.tos_accepted === "true" || data.tos_accepted === "on")) {
        fail("Please review and accept the current Terms of Service before submitting.");
      }
      const sectionParams = new URLSearchParams({
        select: "section_key,heading,content_markdown,display_order",
        tos_version_id: "eq." + applicable.tos_version_id,
        order: "display_order.asc",
        limit: "200"
      });
      const sections = await readRows(baseUrl, headers, "tos_sections", sectionParams);
      if (!sections.length || sections.some(section => !String(section.content_markdown || "").trim())) {
        fail("The current Terms of Service is temporarily unavailable. Please contact Perivelle.", 503);
      }
      tosVersionId = applicable.tos_version_id;
      tosAcceptedAt = new Date().toISOString();
      tosSnapshot = {
        tos_version_id: applicable.tos_version_id,
        version_number: applicable.version_number,
        title: applicable.title,
        agreement_text: applicable.agreement_text,
        effective_at: applicable.effective_at,
        sections
      };
    }
  }

  return {
    serviceId: service?.service_id || null,
    serviceName: service?.name || String(data.type || ""),
    formVersionId: formSnapshot?.form_version_id || null,
    tosVersionId,
    tosAcceptedAt,
    answers,
    submissionSnapshot: { form: formSnapshot, terms: tosSnapshot },
    customFields
  };
}
