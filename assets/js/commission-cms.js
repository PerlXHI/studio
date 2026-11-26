(function () {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const clean = value => String(value == null ? "" : value).trim();
  let cms = null;
  let dynamicFields = [];
  let activeFormVersion = null;
  let activeTerms = null;
  let staticFieldState = [];

  function hiddenInput(name, id) {
    let input = $("#" + id);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.id = id;
      $("#customForm")?.appendChild(input);
    }
    return input;
  }

  function makeField(field) {
    const wrap = document.createElement("div");
    wrap.className = "field cms-dynamic-field" + (field.wide || field.type === "textarea" ? " wide" : "");
    const id = "cms-commission-" + field.id;
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = clean(field.label) + (field.required ? " *" : "");
    wrap.appendChild(label);

    let control;
    if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.rows = Math.max(3, Math.min(8, Number(field.rows) || 4));
    } else if (field.type === "select") {
      control = document.createElement("select");
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = clean(field.placeholder) || "Choose an option";
      control.appendChild(placeholder);
      (Array.isArray(field.options) ? field.options : []).forEach(option => {
        const item = document.createElement("option");
        item.value = String(option);
        item.textContent = String(option);
        control.appendChild(item);
      });
    } else if (field.type === "checkbox") {
      const checkboxWrap = document.createElement("label");
      checkboxWrap.className = "cms-dynamic-checkbox";
      control = document.createElement("input");
      control.type = "checkbox";
      control.value = "true";
      control.name = field.id;
      control.id = id;
      control.required = Boolean(field.required);
      control.dataset.cmsAnswer = field.id;
      const text = document.createElement("span");
      text.textContent = clean(field.checkbox_label || field.label);
      checkboxWrap.append(control, text);
      wrap.replaceChildren(checkboxWrap);
      return wrap;
    } else {
      control = document.createElement("input");
      control.type = ["email","url","number","date"].includes(field.type) ? field.type : "text";
    }

    control.id = id;
    control.name = field.id;
    control.dataset.cmsAnswer = field.id;
    control.required = Boolean(field.required);
    if (field.placeholder && field.type !== "select") control.placeholder = String(field.placeholder);
    if (field.maxLength && ["text","textarea","email","url"].includes(field.type)) {
      control.maxLength = Math.min(2000, Math.max(1, Number(field.maxLength)));
    }
    if (field.minLength && ["text","textarea"].includes(field.type)) control.minLength = Math.min(2000, Number(field.minLength));
    if (field.min != null && field.type === "number") control.min = String(field.min);
    if (field.max != null && field.type === "number") control.max = String(field.max);
    wrap.appendChild(control);
    if (field.help) {
      const hint = document.createElement("small");
      hint.className = "cms-dynamic-field-hint";
      hint.textContent = String(field.help);
      wrap.appendChild(hint);
    }
    return wrap;
  }

  function ensureDynamicContainer() {
    const form = $("#customForm");
    if (!form) return null;
    let container = $("#cmsDynamicFields");
    if (!container) {
      container = document.createElement("div");
      container.id = "cmsDynamicFields";
      container.className = "cms-dynamic-fields";
      const serviceField = $("#orderType")?.closest(".field");
      if (serviceField) serviceField.insertAdjacentElement("afterend", container);
      else form.insertBefore(container, form.firstChild);
    }
    return container;
  }

  function setStaticFieldsEnabled(dynamic) {
    const form = $("#customForm");
    if (!form) return;
    const keep = new Set([
      $("#orderType")?.closest(".field"),
      $("#submitCommission")?.closest(".field")
    ].filter(Boolean));
    const candidates = Array.from(form.querySelectorAll(":scope > .field"));
    if (!staticFieldState.length) {
      staticFieldState = candidates.map(node => ({
        node,
        controls: Array.from(node.querySelectorAll("input,select,textarea,button")).map(control => ({ control, disabled: control.disabled }))
      }));
    }
    staticFieldState.forEach(entry => {
      if (keep.has(entry.node) || entry.node.id === "cmsDynamicFields") return;
      entry.node.hidden = Boolean(dynamic);
      entry.controls.forEach(item => { item.control.disabled = dynamic ? true : item.disabled; });
    });
  }

  function findPublishedForm(serviceId) {
    const forms = (cms?.commission_forms || []).filter(form => form.service_id === serviceId && form.is_active === true);
    for (const form of forms) {
      const version = (cms?.commission_form_versions || [])
        .filter(row => row.form_id === form.form_id && row.status === "published")
        .sort((a,b) => Number(b.version_number) - Number(a.version_number))[0];
      if (version) return { form, version };
    }
    return null;
  }

  function renderDynamicForm(serviceId) {
    const container = ensureDynamicContainer();
    if (!container) return;
    container.replaceChildren();
    const selected = findPublishedForm(serviceId);
    activeFormVersion = selected?.version || null;
    dynamicFields = Array.isArray(activeFormVersion?.schema?.fields) ? activeFormVersion.schema.fields : [];
    if (!selected) {
      container.hidden = true;
      setStaticFieldsEnabled(false);
      hiddenInput("form_version_id", "cmsFormVersionId").value = "";
      hiddenInput("answers", "cmsFormAnswers").value = "{}";
      return;
    }
    setStaticFieldsEnabled(true);
    container.hidden = false;
    if (selected.form.description) {
      const intro = document.createElement("p");
      intro.className = "cms-dynamic-form-intro";
      intro.textContent = selected.form.description;
      container.appendChild(intro);
    }
    dynamicFields.forEach(field => {
      if (!field || field.system === "type") return;
      container.appendChild(makeField(field));
    });
    hiddenInput("form_version_id", "cmsFormVersionId").value = activeFormVersion.form_version_id;
    hiddenInput("answers", "cmsFormAnswers").value = "{}";
  }

  function ensureTermsUI() {
    const form = $("#customForm");
    if (!form) return;
    let block = $("#cmsTermsAcceptance");
    if (!block) {
      block = document.createElement("div");
      block.id = "cmsTermsAcceptance";
      block.className = "field wide cms-terms-acceptance";
      block.innerHTML = '<div class="cms-terms-row"><label class="cms-terms-check"><input type="checkbox" id="cmsTermsAccepted" name="tos_accepted" value="true" required><span id="cmsTermsAgreementText">I have read and agree to the Terms of Service.</span></label><button type="button" class="cms-terms-read" id="cmsReadTerms">Read Terms of Service</button></div>';
      const note = $("#customForm .form-note");
      if (note) note.insertAdjacentElement("beforebegin", block);
      else $("#submitCommission")?.closest(".field")?.insertAdjacentElement("beforebegin", block);
      const dialog = document.createElement("dialog");
      dialog.id = "cmsTermsDialog";
      dialog.className = "cms-terms-dialog";
      dialog.innerHTML = '<div class="cms-terms-dialog-inner"><button type="button" class="cms-terms-close" aria-label="Close Terms">×</button><p class="eyebrow">PERIVELLE · TERMS OF SERVICE</p><h2 id="cmsTermsDialogTitle">Terms of Service</h2><p class="cms-terms-version"></p><div class="cms-terms-content"></div></div>';
      document.body.appendChild(dialog);
      dialog.querySelector(".cms-terms-close").addEventListener("click", () => dialog.close());
      dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
      $("#cmsReadTerms").addEventListener("click", () => dialog.showModal());
    }
    hiddenInput("tos_version_id", "cmsTosVersionId");
  }

  function applicableTerms(serviceId) {
    const versions = (cms?.tos_versions || []).filter(row => row.status === "published");
    return versions.find(row => row.service_id === serviceId) || versions.find(row => row.service_id == null) || null;
  }

  function renderTerms(serviceId) {
    ensureTermsUI();
    const block = $("#cmsTermsAcceptance");
    if (!block) return;
    const terms = applicableTerms(serviceId);
    activeTerms = terms;
    block.hidden = !terms;
    const checkbox = $("#cmsTermsAccepted");
    if (!terms) {
      checkbox.required = false;
      checkbox.checked = false;
      $("#cmsTosVersionId").value = "";
      return;
    }
    checkbox.required = true;
    checkbox.checked = false;
    $("#cmsTosVersionId").value = terms.tos_version_id;
    $("#cmsTermsAgreementText").textContent = clean(terms.agreement_text) || "I have read and agree to the Terms of Service.";
    const dialog = $("#cmsTermsDialog");
    $("#cmsTermsDialogTitle").textContent = terms.title || "Terms of Service";
    dialog.querySelector(".cms-terms-version").textContent = "Version " + terms.version_number + (terms.effective_at ? " · Effective " + new Date(terms.effective_at).toLocaleDateString() : "");
    const content = dialog.querySelector(".cms-terms-content");
    content.replaceChildren();
    const sections = (cms?.tos_sections || [])
      .filter(row => row.tos_version_id === terms.tos_version_id)
      .sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    sections.forEach(section => {
      const article = document.createElement("section");
      const heading = document.createElement("h3");
      heading.textContent = clean(section.heading);
      const body = document.createElement("p");
      body.textContent = clean(section.content_markdown);
      article.append(heading, body);
      content.appendChild(article);
    });
  }

  function configureServices() {
    const select = $("#orderType");
    const services = (cms?.services || []).slice().sort((a,b) => Number(a.display_order || 0) - Number(b.display_order || 0));
    if (!select || !services.length) return;
    const current = select.value;
    select.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a service";
    select.appendChild(placeholder);
    services.forEach(service => {
      const option = document.createElement("option");
      option.value = service.service_id;
      option.textContent = service.name;
      select.appendChild(option);
    });
    if (services.some(service => service.service_id === current)) select.value = current;
    else select.value = "";
    select.addEventListener("change", () => refreshForService());
  }

  function refreshForService() {
    const serviceId = $("#orderType")?.value || "";
    renderDynamicForm(serviceId);
    renderTerms(serviceId);
  }

  function prepareSubmission() {
    const form = $("#customForm");
    if (!form) return;
    const answers = {};
    dynamicFields.forEach(field => {
      if (!field || field.system === "type") return;
      const control = form.querySelector('[data-cms-answer="' + CSS.escape(field.id) + '"]');
      if (!control) return;
      answers[field.id] = field.type === "checkbox" ? control.checked : control.value;
    });
    const answerInput = hiddenInput("answers", "cmsFormAnswers");
    answerInput.value = JSON.stringify(answers);
    hiddenInput("service_id", "cmsServiceId").value = $("#orderType")?.value || "";
    hiddenInput("form_version_id", "cmsFormVersionId").value = activeFormVersion?.form_version_id || "";
    hiddenInput("tos_version_id", "cmsTosVersionId").value = activeTerms?.tos_version_id || "";
  }

  function init(data) {
    cms = data || window.perivellePublicCmsData || null;
    if (!cms) return;
    const form = $("#customForm");
    if (!form || form.dataset.cmsReady) return;
    form.dataset.cmsReady = "true";
    configureServices();
    refreshForService();
    form.addEventListener("submit", prepareSubmission, true);
  }

  document.addEventListener("perivelle-public-cms-ready", event => init(event.detail));
  if (window.perivellePublicCmsData) init(window.perivellePublicCmsData);
})();
