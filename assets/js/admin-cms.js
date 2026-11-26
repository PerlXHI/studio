(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { data: {}, resource: "producers", editing: null, loading: false, loaded: false };
  const definitions = [
    {
      id: "producers", label: "Producers", noun: "producer", keys: ["producer_id"], title: r => r.display_name || r.producer_id,
      subtitle: r => [r.alias, r.role_title].filter(Boolean).join(" · "),
      status: r => r.is_visible ? "Visible" : "Hidden",
      fields: [
        { key: "producer_id", label: "Producer ID", type: "text", required: true, hint: "2–50 lowercase letters, numbers, hyphens or underscores." },
        { key: "display_name", label: "Display name", type: "text", required: true },
        { key: "alias", label: "Alias", type: "text" },
        { key: "role_title", label: "Role / title", type: "text" },
        { key: "biography", label: "Biography", type: "textarea", wide: true },
        { key: "avatar_url", label: "Profile image URL", type: "upload", uploadCategory: "producers" },
        { key: "banner_url", label: "Banner image URL", type: "upload", uploadCategory: "producers" },
        { key: "social_links", label: "Social links (JSON object)", type: "json", default: "{}", wide: true, hint: 'Example: {"twitter":"https://x.com/...","soundcloud":"https://soundcloud.com/..."}' },
        { key: "specializations", label: "Specializations (one per line)", type: "tags", wide: true },
        { key: "genres", label: "Genres (one per line)", type: "tags" },
        { key: "equipment", label: "Equipment (JSON object)", type: "json", default: "{}", wide: true },
        { key: "credits", label: "Additional credits (JSON array)", type: "json", default: "[]", wide: true },
        { key: "commission_status", label: "Commission status", type: "select", options: [["not_listed","Not listed"],["open","Open"],["limited_slots","Limited slots"],["waitlist","Waitlist"],["closed","Closed"]], default: "not_listed" },
        { key: "appearance", label: "Appearance settings (JSON object)", type: "json", default: "{}", wide: true },
        { key: "is_visible", label: "Visible on the future public CMS", type: "boolean", default: true },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "categories", label: "Categories", noun: "category", keys: ["category_id"], title: r => r.name || r.category_id,
      subtitle: r => r.category_id, status: r => r.is_visible ? "Visible" : "Hidden",
      fields: [
        { key: "category_id", label: "Category ID", type: "text", required: true, hint: "Lowercase ID, e.g. cinematic-music." },
        { key: "name", label: "Category name", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", wide: true },
        { key: "is_visible", label: "Visible on the future public CMS", type: "boolean", default: true },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "works", label: "Works", noun: "work", keys: ["work_id"], title: r => r.title || r.work_id,
      subtitle: r => [r.slug, state.data.categories?.find(c => c.category_id === r.category_id)?.name].filter(Boolean).join(" · "),
      status: r => r.visibility === "published" ? "Published" : r.visibility === "archived" ? "Archived" : "Draft",
      fields: [
        { key: "work_id", label: "Work ID", type: "text", required: true, hint: "Stable identifier, lowercase with hyphens or underscores." },
        { key: "slug", label: "URL slug", type: "slug", required: true },
        { key: "title", label: "Work title", type: "text", required: true },
        { key: "category_id", label: "Category", type: "relation", relation: "categories", relationKey: "category_id", relationLabel: r => r.name, nullable: true, emptyLabel: "Uncategorized" },
        { key: "description", label: "Description", type: "textarea", wide: true },
        { key: "cover_image_url", label: "Cover image URL", type: "upload", uploadCategory: "portfolio" },
        { key: "video_url", label: "Video URL", type: "url" },
        { key: "audio_url", label: "Audio / MP3 URL", type: "url" },
        { key: "visibility", label: "Visibility", type: "select", options: [["draft","Draft"],["published","Published"],["archived","Archived"]], default: "draft" },
        { key: "is_featured", label: "Featured work", type: "boolean", default: false },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 },
        { key: "metadata", label: "Additional metadata (JSON object)", type: "json", default: "{}", wide: true }
      ]
    },
    {
      id: "services", label: "Services", noun: "service", keys: ["service_id"], title: r => r.name || r.service_id,
      subtitle: r => [r.slug, r.legacy_price_label || (r.starting_price != null ? r.currency + " " + r.starting_price : "")].filter(Boolean).join(" · "),
      status: r => r.status === "published" ? "Published" : r.status === "archived" ? "Archived" : "Draft",
      fields: [
        { key: "service_id", label: "Service ID", type: "text", required: true, hint: "Stable ID, lowercase with hyphens." },
        { key: "slug", label: "URL slug", type: "slug", required: true },
        { key: "name", label: "Service name", type: "text", required: true },
        { key: "short_description", label: "Short description", type: "text" },
        { key: "description", label: "Full description", type: "textarea", wide: true },
        { key: "thumbnail_url", label: "Thumbnail image URL", type: "upload", uploadCategory: "portfolio" },
        { key: "pricing_model", label: "Pricing model", type: "select", options: [["quote","Quote"],["fixed","Fixed price"],["starting_at","Starting at"],["packages","Packages"]], default: "quote" },
        { key: "starting_price", label: "Starting price", type: "number", nullable: true },
        { key: "currency", label: "Currency", type: "text", default: "USD" },
        { key: "legacy_price_label", label: "Legacy price label", type: "text", hint: "Preserves the old price text when no numeric price is set." },
        { key: "estimated_delivery_days", label: "Estimated delivery (days)", type: "number", integer: true, nullable: true },
        { key: "included_revisions", label: "Included revisions", type: "number", integer: true, nullable: true },
        { key: "deliverables", label: "Deliverables (one per line)", type: "tags", wide: true },
        { key: "client_requirements", label: "Client requirements (one per line)", type: "tags", wide: true },
        { key: "terms_markdown", label: "Service terms (Markdown)", type: "textarea", wide: true },
        { key: "faq", label: "FAQ (JSON array)", type: "json", default: "[]", wide: true, hint: 'Example: [{"question":"How long?","answer":"Usually 2 weeks."}]' },
        { key: "status", label: "Publication status", type: "select", options: [["draft","Draft"],["published","Published"],["archived","Archived"]], default: "draft" },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "service_packages", label: "Packages", noun: "package", keys: ["package_id"], title: r => r.name,
      subtitle: r => {
        const service = state.data.services?.find(s => s.service_id === r.service_id);
        return [service?.name || r.service_id, r.price_amount == null ? "Quote" : (r.currency || "USD") + " " + r.price_amount].join(" · ");
      },
      status: r => r.is_active ? "Active" : "Inactive",
      fields: [
        { key: "service_id", label: "Parent service", type: "relation", relation: "services", relationKey: "service_id", relationLabel: r => r.name, required: true },
        { key: "name", label: "Package name", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", wide: true },
        { key: "price_amount", label: "Price amount", type: "number", nullable: true },
        { key: "currency", label: "Currency", type: "text", default: "USD" },
        { key: "estimated_delivery_days", label: "Estimated delivery (days)", type: "number", integer: true, nullable: true },
        { key: "included_revisions", label: "Included revisions", type: "number", integer: true, nullable: true },
        { key: "deliverables", label: "Deliverables (JSON array)", type: "json", default: "[]", wide: true },
        { key: "is_active", label: "Active", type: "boolean", default: true },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "service_addons", label: "Add-ons", noun: "add-on", keys: ["addon_id"], title: r => r.name,
      subtitle: r => {
        const service = state.data.services?.find(s => s.service_id === r.service_id);
        return [service?.name || r.service_id, r.price_amount == null ? "Quote" : (r.currency || "USD") + " " + r.price_amount].join(" · ");
      },
      status: r => r.is_active ? "Active" : "Inactive",
      fields: [
        { key: "service_id", label: "Parent service", type: "relation", relation: "services", relationKey: "service_id", relationLabel: r => r.name, required: true },
        { key: "name", label: "Add-on name", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", wide: true },
        { key: "price_amount", label: "Price amount", type: "number", nullable: true },
        { key: "currency", label: "Currency", type: "text", default: "USD" },
        { key: "additional_delivery_days", label: "Additional delivery (days)", type: "number", integer: true, nullable: true },
        { key: "is_active", label: "Active", type: "boolean", default: true },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "tos_versions", label: "Terms of Service", noun: "Terms version", keys: ["tos_version_id"], title: r => (r.title || "Terms of Service") + " · v" + r.version_number,
      subtitle: r => r.service_id ? (state.data.services?.find(x => x.service_id === r.service_id)?.name || r.service_id) : "Global policy",
      status: r => r.status === "published" ? "Published" : r.status === "archived" ? "Archived" : "Draft",
      fields: [
        { key: "service_id", label: "Applies to service", type: "relation", relation: "services", relationKey: "service_id", relationLabel: r => r.name, nullable: true, emptyLabel: "Global Terms of Service" },
        { key: "version_number", label: "Version number", type: "number", integer: true, required: true, default: 1 },
        { key: "title", label: "Policy title", type: "text", required: true, default: "Terms of Service" },
        { key: "agreement_text", label: "Acceptance statement", type: "text", required: true, default: "I have read and agree to the Terms of Service." },
        { key: "status", label: "Status", type: "select", options: [["draft","Draft"],["published","Published"],["archived","Archived"]], default: "draft" },
        { key: "effective_at", label: "Effective date (ISO format)", type: "text", nullable: true, hint: "Optional ISO timestamp. Leave blank to publish immediately." },
        { key: "published_at", label: "Published at", type: "text", nullable: true }
      ]
    },
    {
      id: "tos_sections", label: "ToS sections", noun: "ToS section", keys: ["tos_section_id"], title: r => r.heading || r.section_key,
      subtitle: r => state.data.tos_versions?.find(x => x.tos_version_id === r.tos_version_id)?.title || r.tos_version_id,
      status: r => state.data.tos_versions?.find(x => x.tos_version_id === r.tos_version_id)?.status || "Unlinked",
      fields: [
        { key: "tos_version_id", label: "Terms version", type: "relation", relation: "tos_versions", relationKey: "tos_version_id", relationLabel: r => (r.title || "Terms") + " · v" + r.version_number, relationFilter: r => r.status === "draft", required: true },
        { key: "section_key", label: "Section key", type: "slug", required: true },
        { key: "heading", label: "Heading", type: "text", required: true },
        { key: "content_markdown", label: "Section content", type: "textarea", wide: true, hint: "Supports headings (#), bullets (-), bold (**text**) and italic (*text*)." },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "commission_forms", label: "Commission forms", noun: "commission form", keys: ["form_id"], title: r => r.name,
      subtitle: r => state.data.services?.find(x => x.service_id === r.service_id)?.name || r.service_id,
      status: r => r.is_active ? "Active" : "Inactive",
      fields: [
        { key: "service_id", label: "Service", type: "relation", relation: "services", relationKey: "service_id", relationLabel: r => r.name, required: true },
        { key: "name", label: "Form name", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", wide: true },
        { key: "is_active", label: "Active", type: "boolean", default: true },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    },
    {
      id: "commission_form_versions", label: "Form versions", noun: "form version", keys: ["form_version_id"], title: r => {
        const form = state.data.commission_forms?.find(x => x.form_id === r.form_id);
        return (form?.name || "Commission form") + " · v" + r.version_number;
      },
      subtitle: r => state.data.commission_forms?.find(x => x.form_id === r.form_id)?.service_id || r.form_id,
      status: r => r.status === "published" ? "Published" : r.status === "archived" ? "Archived" : "Draft",
      fields: [
        { key: "form_id", label: "Commission form", type: "relation", relation: "commission_forms", relationKey: "form_id", relationLabel: r => r.name, relationFilter: r => r.is_active === true, required: true },
        { key: "version_number", label: "Version number", type: "number", integer: true, required: true, default: 1 },
        { key: "status", label: "Status", type: "select", options: [["draft","Draft"],["published","Published"],["archived","Archived"]], default: "draft" },
        { key: "schema", label: "Form fields (JSON schema)", type: "json", wide: true, default: JSON.stringify({ fields: [
          { id: "name", label: "Name / stage name", type: "text", required: true, system: "name", maxLength: 80 },
          { id: "contact", label: "Discord username", type: "text", required: true, system: "contact", maxLength: 120 },
          { id: "license", label: "Usage / license preference", type: "select", required: true, system: "license", options: ["Non-Exclusive", "Exclusive / Full Buyout", "Not sure — please advise"] },
          { id: "moodBpm", label: "Genre / mood / BPM", type: "text", system: "moodBpm", maxLength: 180 },
          { id: "duration", label: "Duration / deliverables", type: "text", system: "duration", maxLength: 180 },
          { id: "character", label: "Project concept & creative direction", type: "textarea", required: true, system: "character", minLength: 20, maxLength: 1500 },
          { id: "reference", label: "References", type: "textarea", system: "reference", maxLength: 900 },
          { id: "deadline", label: "Preferred deadline", type: "date", system: "deadline" },
          { id: "budget", label: "Budget range", type: "text", system: "budget", maxLength: 100 },
          { id: "extra", label: "Additional notes", type: "textarea", system: "extra", maxLength: 900 }
        ] }, null, 2) }
      ]
    },
    {
      id: "work_producers", label: "Work credits", noun: "credit", keys: ["work_id","producer_id"],
      title: r => {
        const work = state.data.works?.find(w => w.work_id === r.work_id);
        const producer = state.data.producers?.find(p => p.producer_id === r.producer_id);
        return (work?.title || r.work_id) + " — " + (producer?.display_name || r.producer_id);
      },
      subtitle: r => r.credit_role || "Producer",
      status: () => "Linked",
      fields: [
        { key: "work_id", label: "Work", type: "relation", relation: "works", relationKey: "work_id", relationLabel: r => r.title, required: true },
        { key: "producer_id", label: "Producer", type: "relation", relation: "producers", relationKey: "producer_id", relationLabel: r => r.display_name, required: true },
        { key: "credit_role", label: "Credit role", type: "text", default: "Producer" },
        { key: "display_order", label: "Display order", type: "number", integer: true, default: 0 }
      ]
    }
  ];

  const byId = id => definitions.find(item => item.id === id) || definitions[0];
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const encodeParams = values => new URLSearchParams(values).toString();

  async function api(resource, method = "GET", body = null, keys = {}) {
    const params = { resource, ...keys };
    const response = await fetch("/api/admin-cms?" + encodeParams(params), {
      method,
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.message || "The CMS request failed.");
    return result;
  }

  function setNotice(message, tone = "info") {
    const node = $("#cmsNotice");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.tone = tone;
    node.classList.toggle("is-visible", Boolean(message));
  }

  async function loadData() {
    if (state.loading) return;
    state.loading = true;
    $("#cmsRecords").innerHTML = '<div class="cms-empty">Loading CMS records…</div>';
    try {
      const result = await api("all");
      state.data = result.data || {};
      state.loaded = true;
      renderRecords();
      setNotice("CMS records are up to date.", "success");
    } catch (error) {
      $("#cmsRecords").innerHTML = '<div class="cms-empty">Could not load the CMS records.</div>';
      setNotice(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  function activeDefinition() { return byId(state.resource); }
  function activeRecords() { return Array.isArray(state.data[state.resource]) ? state.data[state.resource] : []; }

  function renderResources() {
    $$("#cmsResourceNav [data-cms-resource]").forEach(button => {
      const active = button.dataset.cmsResource === state.resource;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      const count = $(`[data-cms-count="${button.dataset.cmsResource}"]`);
      if (count) count.textContent = (state.data[button.dataset.cmsResource] || []).length;
    });
  }

  function recordSummary(record, def, index) {
    const title = def.title(record);
    const subtitle = def.subtitle(record) || def.keys.map(key => record[key]).join(" · ");
    const status = def.status(record);
    const lockedSection = state.resource === "tos_sections" && status === "Published";
    const keyLabel = def.keys.map(key => record[key]).join(" / ");
    return `<article class="cms-record">
      <div class="cms-record-copy">
        <div class="cms-record-topline"><strong>${escapeHtml(title)}</strong><span class="cms-status">${escapeHtml(status)}</span></div>
        <p>${escapeHtml(subtitle)}</p>
        <small>${escapeHtml(keyLabel)}</small>
      </div>
      <div class="cms-record-actions">
        ${(["tos_versions","commission_form_versions"].includes(state.resource) && record.status === "draft") ? '<button class="btn" type="button" data-cms-publish="' + index + '">Publish</button>' : ""}
        ${(["tos_versions","commission_forms"].includes(state.resource)) ? '<button class="btn alt" type="button" data-cms-next-version="' + index + '">New version</button>' : ""}
        <button class="btn alt" type="button" data-cms-edit="${index}" ${(["tos_versions","commission_form_versions"].includes(state.resource) && record.status === "published") || lockedSection ? "disabled" : ""}>Edit</button>
        <button class="btn alt" type="button" data-cms-archive="${index}" ${lockedSection ? "disabled" : ""}>${state.resource === "work_producers" ? "Remove link" : "Archive"}</button>
      </div>
    </article>`;
  }

  function renderRecords() {
    const def = activeDefinition();
    const search = ($("#cmsSearch")?.value || "").trim().toLowerCase();
    const records = activeRecords();
    const visible = records.map((record, index) => ({ record, index })).filter(({ record }) => {
      return !search || JSON.stringify(record).toLowerCase().includes(search);
    });
    renderResources();
    $("#cmsCollectionTitle").textContent = def.label;
    $("#cmsCollectionMeta").textContent = records.length + (records.length === 1 ? " record" : " records");
    $("#cmsRecords").innerHTML = visible.length
      ? visible.map(({ record, index }) => recordSummary(record, def, index)).join("")
      : '<div class="cms-empty">' + (search ? "No records match this search." : "No records yet. Add the first one to get started.") + '</div>';
    $("#cmsAddRecord").textContent = "＋ Add " + def.noun;
  }

  function currentRelationOptions(field) {
    const rows = state.data[field.relation] || [];
    return typeof field.relationFilter === "function" ? rows.filter(field.relationFilter) : rows;
  }

  function renderField(field, value, editing) {
    const id = "cms-field-" + field.key;
    const val = value === undefined ? (field.default ?? (field.type === "json" ? "{}" : "")) : value;
    const disabled = editing && field.key && activeDefinition().keys.includes(field.key);
    const wide = field.wide ? " cms-field-wide" : "";
    const hint = field.hint ? '<small class="cms-field-hint">' + escapeHtml(field.hint) + "</small>" : "";
    if (field.type === "boolean") {
      return `<label class="cms-field cms-field-check${wide}" for="${id}">
        <input id="${id}" type="checkbox" data-cms-field="${field.key}" ${val === true ? "checked" : ""}>
        <span><strong>${escapeHtml(field.label)}</strong>${hint}</span>
      </label>`;
    }
    if (field.type === "select" || field.type === "relation") {
      let options = [];
      if (field.type === "select") options = field.options || [];
      else options = currentRelationOptions(field).map(row => [row[field.relationKey], field.relationLabel(row)]);
      const empty = field.nullable ? '<option value="">' + escapeHtml(field.emptyLabel || "None") + "</option>" : "";
      const optionHtml = options.map(([key, label]) => `<option value="${escapeHtml(key)}" ${String(val ?? "") === String(key) ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
      return `<label class="cms-field${wide}" for="${id}"><span>${escapeHtml(field.label)}${field.required ? " *" : ""}</span>
        <select id="${id}" data-cms-field="${field.key}" ${disabled ? "disabled" : ""}>${empty}${optionHtml}</select>${hint}</label>`;
    }
    if (field.type === "textarea" || field.type === "json" || field.type === "tags") {
      const textValue = field.type === "json" && typeof val !== "string" ? JSON.stringify(val, null, 2)
        : field.type === "tags" && Array.isArray(val) ? val.join("\n") : val;
      return `<label class="cms-field${wide}" for="${id}"><span>${escapeHtml(field.label)}${field.required ? " *" : ""}</span>
        <textarea id="${id}" data-cms-field="${field.key}" rows="${field.type === "json" ? 5 : 3}" ${disabled ? "disabled" : ""} placeholder="${field.type === "json" ? "Enter valid JSON…" : ""}">${escapeHtml(textValue)}</textarea>${hint}</label>`;
    }
    if (field.type === "upload") {
      return `<div class="cms-field cms-upload-field${wide}"><label for="${id}">${escapeHtml(field.label)}</label>
        <input id="${id}" type="url" data-cms-field="${field.key}" value="${escapeHtml(val)}" placeholder="https://…">
        <label class="cms-upload-trigger">Upload image <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" data-cms-upload="${field.key}" data-upload-category="${field.uploadCategory}"></label>
        <small class="cms-field-hint" data-upload-status="${field.key}">JPG, PNG, WebP or AVIF · max 10 MB</small>${hint}</div>`;
    }
    const inputType = field.type === "number" ? "number" : field.type === "url" ? "url" : "text";
    const extras = field.type === "number" ? `step="${field.integer ? "1" : "0.01"}" min="0"` : "";
    return `<label class="cms-field${wide}" for="${id}"><span>${escapeHtml(field.label)}${field.required ? " *" : ""}</span>
      <input id="${id}" type="${inputType}" data-cms-field="${field.key}" value="${escapeHtml(val)}" ${extras} ${disabled ? "disabled" : ""} ${field.required ? "required" : ""}>
      ${hint}</label>`;
  }

  function initCommissionFormBuilder() {
    const rawNode = $('[data-cms-field="schema"]', $("#cmsEditorFields"));
    if (!rawNode) return;
    const rawField = rawNode.closest(".cms-field");
    let parsed = {};
    try { parsed = JSON.parse(rawNode.value || "{}"); } catch {}
    let fields = Array.isArray(parsed.fields) ? parsed.fields.map(field => ({ ...field })) : [];

    const host = document.createElement("section");
    host.className = "cms-form-builder";
    const head = document.createElement("div");
    head.className = "cms-form-builder-head";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Form field builder";
    const hint = document.createElement("p");
    hint.textContent = "Add and arrange the questions clients will answer. Map the four required fields to Name, Contact, License and Creative brief.";
    copy.append(title, hint);
    head.appendChild(copy);
    const list = document.createElement("div");
    list.className = "cms-form-builder-list";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "btn alt cms-form-builder-add";
    add.textContent = "+ Add field";
    const advanced = document.createElement("details");
    advanced.className = "cms-form-builder-advanced";
    const summary = document.createElement("summary");
    summary.textContent = "Advanced JSON editor";
    host.append(head, list, add, advanced);
    rawField.before(host);
    advanced.append(summary, rawField);

    const types = ["text","textarea","select","checkbox","email","url","number","date"];
    const systems = ["","name","contact","license","moodBpm","duration","character","reference","deadline","budget","extra","type"];
    const labels = { "": "No mapping", name: "Client name", contact: "Discord contact", license: "License preference", moodBpm: "Genre / mood / BPM", duration: "Duration / deliverables", character: "Creative brief", reference: "References", deadline: "Preferred deadline", budget: "Budget", extra: "Additional notes", type: "Service (use service selector)" };

    function sync() {
      rawNode.value = JSON.stringify({ fields }, null, 2);
    }
    function control(labelText, value, type, onChange) {
      const wrap = document.createElement("label");
      wrap.className = "cms-form-builder-control" + (type === "textarea" ? " cms-form-builder-wide" : "");
      const label = document.createElement("span");
      label.textContent = labelText;
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type || "text";
      input.value = value == null ? "" : String(value);
      input.addEventListener("input", () => onChange(input.value));
      wrap.append(label, input);
      return wrap;
    }
    function selectControl(labelText, value, options, onChange) {
      const wrap = document.createElement("label");
      wrap.className = "cms-form-builder-control";
      const label = document.createElement("span");
      label.textContent = labelText;
      const select = document.createElement("select");
      options.forEach(option => {
        const item = document.createElement("option");
        item.value = option.value;
        item.textContent = option.label;
        select.appendChild(item);
      });
      select.value = value || "";
      select.addEventListener("change", () => onChange(select.value));
      wrap.append(label, select);
      return wrap;
    }
    function render() {
      list.replaceChildren();
      fields.forEach((field, index) => {
        const row = document.createElement("article");
        row.className = "cms-form-builder-item";
        const top = document.createElement("div");
        top.className = "cms-form-builder-item-head";
        const itemTitle = document.createElement("strong");
        itemTitle.textContent = "FIELD " + String(index + 1).padStart(2, "0");
        const actions = document.createElement("div");
        actions.className = "cms-form-builder-item-actions";
        [["↑", index > 0, () => { [fields[index - 1], fields[index]] = [fields[index], fields[index - 1]]; render(); }],
         ["↓", index < fields.length - 1, () => { [fields[index + 1], fields[index]] = [fields[index], fields[index + 1]]; render(); }],
         ["Remove", true, () => { fields.splice(index, 1); render(); }]].forEach(([label, enabled, action]) => {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = label;
          button.disabled = !enabled;
          button.addEventListener("click", action);
          actions.appendChild(button);
        });
        top.append(itemTitle, actions);

        const grid = document.createElement("div");
        grid.className = "cms-form-builder-grid";
        grid.append(
          control("Field ID", field.id, "text", value => { field.id = value.trim(); sync(); }),
          control("Question label", field.label, "text", value => { field.label = value; sync(); }),
          selectControl("Input type", field.type, types.map(value => ({ value, label: value })), value => { field.type = value; if (value === "select" && !Array.isArray(field.options)) field.options = ["Option 1","Option 2"]; render(); }),
          selectControl("System mapping", field.system, systems.map(value => ({ value, label: labels[value] })), value => { if (value) field.system = value; else delete field.system; sync(); })
        );
        const required = document.createElement("label");
        required.className = "cms-form-builder-required";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = field.required === true;
        check.addEventListener("change", () => { field.required = check.checked; sync(); });
        const requiredText = document.createElement("span");
        requiredText.textContent = "Required field";
        required.append(check, requiredText);
        grid.appendChild(required);
        grid.append(
          control("Placeholder", field.placeholder, "text", value => { field.placeholder = value; sync(); }),
          control("Helper text", field.help, "text", value => { field.help = value; sync(); }),
          control("Minimum length", field.minLength, "number", value => { if (value === "") delete field.minLength; else field.minLength = Number(value); sync(); }),
          control("Maximum length", field.maxLength, "number", value => { if (value === "") delete field.maxLength; else field.maxLength = Number(value); sync(); })
        );
        if (field.type === "number") {
          grid.append(
            control("Minimum value", field.min, "number", value => { if (value === "") delete field.min; else field.min = Number(value); sync(); }),
            control("Maximum value", field.max, "number", value => { if (value === "") delete field.max; else field.max = Number(value); sync(); })
          );
        }
        if (field.type === "select") {
          const options = control("Options (one per line)", Array.isArray(field.options) ? field.options.join("\n") : "", "textarea", value => {
            field.options = value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
            sync();
          });
          options.classList.add("cms-form-builder-wide");
          grid.appendChild(options);
        }
        row.append(top, grid);
        list.appendChild(row);
      });
      sync();
    }
    add.addEventListener("click", () => {
      let suffix = fields.length + 1;
      while (fields.some(field => field.id === "custom_field_" + suffix)) suffix += 1;
      fields.push({ id: "custom_field_" + suffix, label: "New question", type: "text", required: false });
      render();
    });
    render();
  }

  function openEditor(record = null) {
    const def = activeDefinition();
    state.editing = record ? { ...record } : null;
    $("#cmsEditorTitle").textContent = record ? "Edit " + def.noun : "Add " + def.noun;
    $("#cmsEditorFields").innerHTML = def.fields.map(field => renderField(field, record?.[field.key], Boolean(record))).join("");
    if (state.resource === "commission_form_versions") initCommissionFormBuilder();
    if (record && ["service_packages","service_addons"].includes(state.resource)) {
      $("#cmsEditorMeta").textContent = "Record ID: " + record[def.keys[0]];
    } else {
      $("#cmsEditorMeta").textContent = record ? def.keys.map(key => key + ": " + record[key]).join(" · ") : "New record";
    }
    $("#cmsEditor").classList.remove("hidden");
    $("#cmsEditor").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function serializeEditor() {
    const def = activeDefinition();
    const payload = {};
    for (const field of def.fields) {
      const node = $(`[data-cms-field="${field.key}"]`, $("#cmsEditorFields"));
      if (!node || node.disabled) continue;
      if (field.type === "boolean") payload[field.key] = node.checked;
      else if (field.type === "number") {
        payload[field.key] = node.value.trim() === "" ? null : (field.integer ? Number.parseInt(node.value, 10) : Number(node.value));
      } else if (field.type === "json") {
        try { payload[field.key] = JSON.parse(node.value || (field.default || "{}")); }
        catch { throw new Error('Field "' + field.label + '" must contain valid JSON.'); }
      } else if (field.type === "tags") {
        payload[field.key] = node.value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);
      } else {
        payload[field.key] = field.nullable && node.value.trim() === "" ? null : node.value.trim();
      }
    }
    if (!state.editing) {
      for (const key of def.keys) {
        const node = $(`[data-cms-field="${key}"]`, $("#cmsEditorFields"));
        if (node && !node.disabled) payload[key] = node.value.trim();
      }
    }
    return payload;
  }

  async function saveEditor() {
    const def = activeDefinition();
    let payload;
    try { payload = serializeEditor(); }
    catch (error) { setNotice(error.message, "error"); return; }
    for (const field of def.fields.filter(item => item.required)) {
      const node = $(`[data-cms-field="${field.key}"]`, $("#cmsEditorFields"));
      if (!node || !String(node.value || "").trim()) {
        setNotice("Please complete " + field.label + ".", "error");
        node?.focus();
        return;
      }
    }
    const saveButton = $("#cmsSaveRecord");
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";
    try {
      if (state.editing) {
        const keys = Object.fromEntries(def.keys.map(key => [key, state.editing[key]]));
        await api(state.resource, "PATCH", payload, keys);
      } else {
        await api(state.resource, "POST", payload);
      }
      $("#cmsEditor").classList.add("hidden");
      state.editing = null;
      await loadData();
      setNotice(def.noun[0].toUpperCase() + def.noun.slice(1) + " saved successfully.", "success");
    } catch (error) {
      setNotice(error.message, "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save changes";
    }
  }

  async function archiveRecord(index) {
    const def = activeDefinition();
    const record = activeRecords()[index];
    if (!record) return;
    const action = state.resource === "work_producers" ? "remove this producer credit" : "archive this " + def.noun;
    if (!window.confirm("Are you sure you want to " + action + "?")) return;
    const keys = Object.fromEntries(def.keys.map(key => [key, record[key]]));
    try {
      await api(state.resource, "DELETE", {}, keys);
      $("#cmsEditor").classList.add("hidden");
      state.editing = null;
      await loadData();
      setNotice(state.resource === "work_producers" ? "Credit link removed." : "Record archived. Its data remains in the database.", "success");
    } catch (error) {
      setNotice(error.message, "error");
    }
  }

  async function createNextVersion(index) {
    const record = activeRecords()[index];
    if (!record) return;
    try {
      if (state.resource === "tos_versions") {
        const siblings = (state.data.tos_versions || []).filter(row => row.service_id === record.service_id);
        const version = Math.max(0, ...siblings.map(row => Number(row.version_number) || 0)) + 1;
        const created = await api("tos_versions", "POST", {
          service_id: record.service_id || null, version_number: version, title: record.title || "Terms of Service",
          agreement_text: record.agreement_text || "I have read and agree to the Terms of Service.", status: "draft"
        });
        const next = created.data;
        const sections = (state.data.tos_sections || []).filter(row => row.tos_version_id === record.tos_version_id);
        for (const section of sections) {
          await api("tos_sections", "POST", {
            tos_version_id: next.tos_version_id, section_key: section.section_key, heading: section.heading,
            content_markdown: section.content_markdown || "", display_order: section.display_order || 0
          });
        }
        await loadData();
        state.resource = "tos_versions";
        renderRecords();
        setNotice("Draft Terms v" + version + " created with a copy of the previous sections. Edit the draft before publishing.", "success");
      } else {
        const siblings = (state.data.commission_form_versions || []).filter(row => row.form_id === record.form_id);
        const version = Math.max(0, ...siblings.map(row => Number(row.version_number) || 0)) + 1;
        const latest = siblings.slice().sort((a,b) => Number(b.version_number)-Number(a.version_number))[0];
        await api("commission_form_versions", "POST", {
          form_id: record.form_id, version_number: version, status: "draft",
          schema: latest?.schema || JSON.parse(byId("commission_form_versions").fields.find(field => field.key === "schema").default)
        });
        await loadData();
        state.resource = "commission_form_versions";
        renderRecords();
        setNotice("Draft form v" + version + " created. Edit its field schema, then publish it when ready.", "success");
      }
    } catch (error) { setNotice(error.message, "error"); }
  }

  async function publishVersion(index) {
    const record = activeRecords()[index];
    if (!record || record.status !== "draft") return;
    const resource = state.resource;
    const versions = state.data[resource] || [];
    if (resource === "tos_versions") {
      if (record.effective_at && Date.parse(record.effective_at) > Date.now()) {
        setNotice("This Terms version has a future effective date. Publish it when that date arrives.", "error");
        return;
      }
      const sections = (state.data.tos_sections || []).filter(row => row.tos_version_id === record.tos_version_id);
      if (!sections.length || sections.some(row => !String(row.content_markdown || "").trim())) {
        setNotice("Add at least one complete Terms section before publishing.", "error");
        return;
      }
    } else {
      const fields = record.schema?.fields;
      const allowed = ["text","textarea","select","checkbox","email","url","number","date"];
      if (!Array.isArray(fields) || !fields.length) { setNotice("Add at least one form field before publishing.", "error"); return; }
      const ids = new Set();
      for (const field of fields) {
        if (!field || !/^[a-z][a-zA-Z0-9_-]{0,39}$/.test(field.id || "") || !String(field.label || "").trim() || !allowed.includes(field.type)) {
          setNotice("Each form field needs a valid ID, label, and supported type.", "error"); return;
        }
        if (ids.has(field.id)) { setNotice("Form field IDs must be unique.", "error"); return; }
        ids.add(field.id);
        if (field.type === "select" && (!Array.isArray(field.options) || !field.options.length || field.options.some(option => typeof option !== "string" || !option.trim()))) {
          setNotice("Every select field needs at least one text option.", "error"); return;
        }
      }
      const systemKeys = ["name","contact","license","character"];
      const systems = new Set(fields.map(field => field.system));
      if (systemKeys.some(key => !systems.has(key))) {
        setNotice("The form must include the required system fields: name, contact, license, and character.", "error"); return;
      }
    }
    const scope = resource === "tos_versions" ? row => row.service_id === record.service_id : row => row.form_id === record.form_id;
    const current = versions.find(row => row.status === "published" && scope(row));
    try {
      if (current) {
        const key = resource === "tos_versions" ? { tos_version_id: current.tos_version_id } : { form_version_id: current.form_version_id };
        await api(resource, "PATCH", { status: "archived" }, key);
      }
      const key = resource === "tos_versions" ? { tos_version_id: record.tos_version_id } : { form_version_id: record.form_version_id };
      await api(resource, "PATCH", { status: "published", published_at: new Date().toISOString(), ...(resource === "tos_versions" && !record.effective_at ? { effective_at: new Date().toISOString() } : {}) }, key);
      await loadData();
      setNotice("Version published successfully. Previous published version archived.", "success");
    } catch (error) {
      if (current) {
        const key = resource === "tos_versions" ? { tos_version_id: current.tos_version_id } : { form_version_id: current.form_version_id };
        await api(resource, "PATCH", { status: "published" }, key).catch(() => {});
      }
      setNotice(error.message, "error");
    }
  }

  function bindEvents() {
    $("#cmsResourceNav").addEventListener("click", event => {
      const button = event.target.closest("[data-cms-resource]");
      if (!button) return;
      if (state.resource !== button.dataset.cmsResource) {
        $("#cmsEditor").classList.add("hidden");
        state.editing = null;
      }
      state.resource = button.dataset.cmsResource;
      renderRecords();
    });
    $("#cmsRecords").addEventListener("click", event => {
      const edit = event.target.closest("[data-cms-edit]");
      const archive = event.target.closest("[data-cms-archive]");
      const publish = event.target.closest("[data-cms-publish]");
      const nextVersion = event.target.closest("[data-cms-next-version]");
      if (edit) openEditor(activeRecords()[Number(edit.dataset.cmsEdit)]);
      if (archive) archiveRecord(Number(archive.dataset.cmsArchive));
      if (publish) publishVersion(Number(publish.dataset.cmsPublish));
      if (nextVersion) createNextVersion(Number(nextVersion.dataset.cmsNextVersion));
    });
    $("#cmsAddRecord").addEventListener("click", () => openEditor());
    const closeEditor = () => {
      $("#cmsEditor").classList.add("hidden");
      state.editing = null;
    };
    $("#cmsCancelEdit").addEventListener("click", closeEditor);
    $("#cmsCancelEditBottom").addEventListener("click", closeEditor);
    $("#cmsSaveRecord").addEventListener("click", saveEditor);
    $("#cmsRefresh").addEventListener("click", loadData);
    $("#cmsSearch").addEventListener("input", renderRecords);
    $("#cmsEditorFields").addEventListener("change", async event => {
      const input = event.target.closest("[data-cms-upload]");
      const file = input?.files?.[0];
      if (!file) return;
      const key = input.dataset.cmsUpload;
      const status = $("[data-upload-status='" + key + "']", $("#cmsEditorFields"));
      const field = $("[data-cms-field='" + key + "']", $("#cmsEditorFields"));
      input.disabled = true;
      if (status) status.textContent = "Uploading image…";
      try {
        if (typeof window.uploadAdminImage !== "function") throw new Error("Image upload is unavailable. Reload the admin dashboard.");
        const url = await window.uploadAdminImage(file, input.dataset.uploadCategory);
        if (field) field.value = url;
        if (status) status.textContent = "Image uploaded. Save the record to keep this URL.";
      } catch (error) {
        if (status) status.textContent = error.message;
        setNotice(error.message, "error");
      } finally {
        input.disabled = false;
        input.value = "";
      }
    });
  }

  function init() {
    const root = $("#cmsPanel");
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = "true";
    bindEvents();
    renderResources();
    document.addEventListener("admin-dashboard-loaded", () => {
      if (!$("#dashboard")?.classList.contains("hidden") && !state.loaded) loadData();
    });
    $("[data-tab='cms']")?.addEventListener("click", () => {
      if (!state.loaded) loadData();
    });
    if (!$("#dashboard")?.classList.contains("hidden")) loadData();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();