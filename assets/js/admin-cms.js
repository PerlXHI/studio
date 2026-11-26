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
    const keyLabel = def.keys.map(key => record[key]).join(" / ");
    return `<article class="cms-record">
      <div class="cms-record-copy">
        <div class="cms-record-topline"><strong>${escapeHtml(title)}</strong><span class="cms-status">${escapeHtml(status)}</span></div>
        <p>${escapeHtml(subtitle)}</p>
        <small>${escapeHtml(keyLabel)}</small>
      </div>
      <div class="cms-record-actions">
        <button class="btn alt" type="button" data-cms-edit="${index}">Edit</button>
        <button class="btn alt" type="button" data-cms-archive="${index}">${state.resource === "work_producers" ? "Remove link" : "Archive"}</button>
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
    $("#cmsEditor").classList.add("hidden");
    state.editing = null;
  }

  function currentRelationOptions(field) {
    return state.data[field.relation] || [];
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

  function openEditor(record = null) {
    const def = activeDefinition();
    state.editing = record ? { ...record } : null;
    $("#cmsEditorTitle").textContent = record ? "Edit " + def.noun : "Add " + def.noun;
    $("#cmsEditorFields").innerHTML = def.fields.map(field => renderField(field, record?.[field.key], Boolean(record))).join("");
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
      await loadData();
      setNotice(state.resource === "work_producers" ? "Credit link removed." : "Record archived. Its data remains in the database.", "success");
    } catch (error) {
      setNotice(error.message, "error");
    }
  }

  function bindEvents() {
    $("#cmsResourceNav").addEventListener("click", event => {
      const button = event.target.closest("[data-cms-resource]");
      if (!button) return;
      state.resource = button.dataset.cmsResource;
      renderRecords();
    });
    $("#cmsRecords").addEventListener("click", event => {
      const edit = event.target.closest("[data-cms-edit]");
      const archive = event.target.closest("[data-cms-archive]");
      if (edit) openEditor(activeRecords()[Number(edit.dataset.cmsEdit)]);
      if (archive) archiveRecord(Number(archive.dataset.cmsArchive));
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