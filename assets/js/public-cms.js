(function () {
  "use strict";

  const toArray = value => Array.isArray(value) ? value : [];
  const cleanString = value => String(value == null ? "" : value).trim();

  function safeHttps(value) {
    try {
      const url = new URL(String(value || ""));
      return url.protocol === "https:" ? url.href : "";
    } catch (error) {
      return "";
    }
  }

  function mapWorkCredits(work, creditsByWork) {
    return (creditsByWork.get(work.work_id) || []).map(credit => ({
      producer_id: credit.producer_id,
      role: cleanString(credit.credit_role) || "Producer"
    }));
  }

  function mapWorkCredit(work, creditsByWork) {
    const credits = mapWorkCredits(work, creditsByWork);
    return credits.length ? credits[0].producer_id : "";
  }

  function mapCreatorIds(work, creditsByWork) {
    return mapWorkCredits(work, creditsByWork).map(credit => credit.producer_id);
  }

  function projectPublicCmsSettings(legacySettings, cmsData) {
    const settings = legacySettings && typeof legacySettings === "object" ? legacySettings : {};
    const required = [
      "producers", "categories", "works", "work_producers",
      "services", "service_packages", "service_addons"
    ];
    if (!cmsData || !required.every(key => Array.isArray(cmsData[key]))) return settings;

    const producers = toArray(cmsData.producers);
    const categories = toArray(cmsData.categories);
    const works = toArray(cmsData.works);
    const creditsByWork = new Map();

    toArray(cmsData.work_producers).forEach(credit => {
      if (!credit || !credit.work_id || !credit.producer_id) return;
      const current = creditsByWork.get(credit.work_id) || [];
      current.push(credit);
      creditsByWork.set(credit.work_id, current);
    });
    creditsByWork.forEach(credits => credits.sort((a, b) =>
      Number(a.display_order || 0) - Number(b.display_order || 0)
    ));

    const portfolioCategories = categories.map(category => ({
      id: category.category_id,
      name: category.name,
      active: true
    }));

    const portfolioVideos = categories.map(category => {
      const categoryWorks = works.filter(work => work.category_id === category.category_id);
      const videoWorks = categoryWorks.filter(work => {
        const legacySource = work.metadata && work.metadata.legacy_source;
        return Boolean(work.video_url) && (!work.is_featured || legacySource === "portfolio_videos");
      });
      const audioWorks = categoryWorks.filter(work =>
        !work.video_url && Boolean(work.audio_url || work.cover_image_url)
      );

      const videoAssignments = [];
      videoWorks.forEach(work => {
        const creators = mapCreatorIds(work, creditsByWork);
        if (creators.length) {
          videoAssignments.push({ url: work.video_url, creator: creators[0], creators });
        }
      });

      return {
        id: category.category_id,
        name: category.name,
        videos: videoWorks.map(work => work.video_url),
        video_assignments: videoAssignments,
        video_works: videoWorks.map(work => ({
          work_id: work.work_id,
          title: work.title,
          description: work.description,
          metadata: work.metadata || {},
          creator: mapWorkCredit(work, creditsByWork),
          creators: mapCreatorIds(work, creditsByWork),
          credits: mapWorkCredits(work, creditsByWork)
        })),
        audio_works: audioWorks.filter(work => work.is_featured !== true).map(work => ({
          work_id: work.work_id,
          title: work.title,
          description: work.description,
          cover_image_url: work.cover_image_url,
          audio_url: work.audio_url,
          creator: mapWorkCredit(work, creditsByWork),
          creators: mapCreatorIds(work, creditsByWork),
          credits: mapWorkCredits(work, creditsByWork)
        }))
      };
    });

    const featuredPortfolio = works
      .filter(work => {
        const legacySource = work.metadata && work.metadata.legacy_source;
        return work.is_featured === true && legacySource !== "portfolio_videos";
      })
      .map(work => ({
        id: work.work_id,
        title: work.title,
        category: work.category_id || "",
        description: work.description || "",
        image: work.cover_image_url || "",
        video_url: work.video_url || "",
        audio_url: work.audio_url || "",
        creator: mapWorkCredit(work, creditsByWork),
        creators: mapCreatorIds(work, creditsByWork),
        credits: mapWorkCredits(work, creditsByWork),
        active: true
      }));

    const studioProducers = producers.map(producer => ({
      id: producer.producer_id,
      name: producer.display_name,
      role: producer.role_title || "",
      bio: producer.biography || "",
      tags: toArray(producer.specializations).length
        ? producer.specializations
        : toArray(producer.genres),
      photo: safeHttps(producer.avatar_url),
      active: true
    }));

    const services = toArray(cmsData.services);
    const servicePrices = services.map(service => ({
      name: service.name,
      price: service.legacy_price_label || (
        service.starting_price == null
          ? ""
          : (service.currency || "USD") + " " + service.starting_price
      )
    }));

    return Object.assign({}, settings, {
      portfolio_categories: portfolioCategories,
      portfolio_videos: portfolioVideos,
      featured_portfolio: featuredPortfolio,
      studio_producers: studioProducers,
      service_prices: servicePrices,
      cms_services: services,
      cms_service_packages: toArray(cmsData.service_packages),
      cms_service_addons: toArray(cmsData.service_addons),
      cms_tos_versions: toArray(cmsData.tos_versions),
      cms_tos_sections: toArray(cmsData.tos_sections),
      cms_commission_forms: toArray(cmsData.commission_forms),
      cms_commission_form_versions: toArray(cmsData.commission_form_versions)
    });
  }

  function formatAmount(amount, currency) {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric)) return "";
    const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(numeric);
    return (currency || "USD") + " " + formatted;
  }

  function servicePriceLabel(service, packages) {
    const legacyLabel = cleanString(service.legacy_price_label);
    if (legacyLabel) return "STARTING AT · " + legacyLabel;

    if (service.starting_price != null) {
      const amount = formatAmount(service.starting_price, service.currency || "USD");
      if (service.pricing_model === "fixed") return "FIXED PRICE · " + amount;
      return "STARTING AT · " + amount;
    }
    if (service.pricing_model === "packages" && packages.length) return "PACKAGES AVAILABLE";
    return "CONTACT FOR A QUOTE";
  }

  function itemLabel(value) {
    if (typeof value === "string") return cleanString(value);
    if (!value || typeof value !== "object") return "";
    return cleanString(value.label || value.name || value.title);
  }

  function createOptionRows(title, rows, type) {
    if (!rows.length) return null;
    const section = document.createElement("section");
    section.className = "cms-service-options cms-service-options-" + type;
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("div");
    list.className = "cms-service-option-list";

    rows.forEach(row => {
      const item = document.createElement("article");
      item.className = "cms-service-option";
      const top = document.createElement("div");
      top.className = "cms-service-option-top";
      const name = document.createElement("strong");
      name.textContent = cleanString(row.name || "Option");
      const price = document.createElement("span");
      price.textContent = row.price_amount == null
        ? "Contact for a quote"
        : formatAmount(row.price_amount, row.currency || "USD");
      top.append(name, price);
      item.appendChild(top);

      if (cleanString(row.description)) {
        const description = document.createElement("p");
        description.textContent = row.description;
        item.appendChild(description);
      }

      const meta = [];
      if (row.estimated_delivery_days != null) meta.push(row.estimated_delivery_days + " day delivery");
      if (row.included_revisions != null) meta.push(row.included_revisions + " revisions");
      if (row.additional_delivery_days != null) meta.push("+" + row.additional_delivery_days + " delivery days");
      if (meta.length) {
        const note = document.createElement("small");
        note.textContent = meta.join(" · ");
        item.appendChild(note);
      }

      const deliverables = toArray(row.deliverables).map(itemLabel).filter(Boolean);
      if (deliverables.length) {
        const list = document.createElement("ul");
        deliverables.forEach(label => {
          const entry = document.createElement("li");
          entry.textContent = label;
          list.appendChild(entry);
        });
        item.appendChild(list);
      }
      list.appendChild(item);
    });

    section.append(heading, list);
    return section;
  }

  function createServiceCard(service) {
    const card = document.createElement("article");
    card.className = "service-card cms-service-card";
    card.dataset.serviceSlug = cleanString(service.slug);

    const art = document.createElement("div");
    art.className = "service-art service-art-bgm";
    art.setAttribute("role", "img");
    art.setAttribute("aria-label", cleanString(service.name) + " service artwork");

    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "PERIVELLE SERVICE";

    const title = document.createElement("h3");
    const description = document.createElement("p");
    const price = document.createElement("span");
    price.className = "starting";

    card.append(art, eyebrow, title, description, price);
    return card;
  }

  let serviceDialog;
  function ensureServiceDialog() {
    if (serviceDialog) return serviceDialog;
    serviceDialog = document.createElement("dialog");
    serviceDialog.className = "cms-service-dialog";
    serviceDialog.setAttribute("aria-labelledby", "cmsServiceDialogTitle");
    serviceDialog.innerHTML = '<div class="cms-service-dialog-inner"><button class="cms-service-dialog-close" type="button" aria-label="Close service details">×</button><div class="cms-service-dialog-art"></div><div class="cms-service-dialog-content"><p class="eyebrow cms-service-dialog-eyebrow">PERIVELLE SERVICE</p><h2 id="cmsServiceDialogTitle"></h2><p class="cms-service-dialog-description"></p><p class="cms-service-dialog-price"></p><div class="cms-service-dialog-options"></div><a class="cms-service-dialog-cta" href="#custom">Start a commission <span aria-hidden="true">↗</span></a></div></div>';
    document.body.appendChild(serviceDialog);
    serviceDialog.querySelector(".cms-service-dialog-close").addEventListener("click", () => serviceDialog.close());
    serviceDialog.addEventListener("click", event => { if (event.target === serviceDialog) serviceDialog.close(); });
    serviceDialog.querySelector(".cms-service-dialog-cta").addEventListener("click", () => serviceDialog.close());
    return serviceDialog;
  }

  function createServiceMetaSection(service) {
    const items = [];
    if (service.estimated_delivery_days != null) items.push(["Estimated delivery", service.estimated_delivery_days + " days"]);
    if (service.included_revisions != null) items.push(["Included revisions", service.included_revisions]);
    if (!items.length) return null;
    const section = document.createElement("section");
    section.className = "cms-service-options cms-service-meta-section";
    const heading = document.createElement("h4");
    heading.textContent = "At a glance";
    const list = document.createElement("div");
    list.className = "cms-service-meta-list";
    items.forEach(([label, value]) => {
      const item = document.createElement("div");
      const name = document.createElement("small");
      name.textContent = label;
      const detail = document.createElement("strong");
      detail.textContent = String(value);
      item.append(name, detail);
      list.appendChild(item);
    });
    section.append(heading, list);
    return section;
  }

  function createServiceTextSection(title, values) {
    const rows = toArray(values).map(itemLabel).filter(Boolean);
    if (!rows.length) return null;
    const section = document.createElement("section");
    section.className = "cms-service-options cms-service-text-section";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const list = document.createElement("ul");
    rows.forEach(value => {
      const item = document.createElement("li");
      item.textContent = value;
      list.appendChild(item);
    });
    section.append(heading, list);
    return section;
  }

  function createServiceTermsSection(value) {
    const text = cleanString(value);
    if (!text) return null;
    const section = document.createElement("section");
    section.className = "cms-service-options cms-service-terms-section";
    const heading = document.createElement("h4");
    heading.textContent = "Service terms";
    const body = document.createElement("p");
    body.textContent = text;
    section.append(heading, body);
    return section;
  }

  function createServiceFaqSection(items) {
    const rows = toArray(items).filter(item => item && cleanString(item.question) && cleanString(item.answer));
    if (!rows.length) return null;
    const section = document.createElement("section");
    section.className = "cms-service-options cms-service-faq-section";
    const heading = document.createElement("h4");
    heading.textContent = "Frequently asked questions";
    section.appendChild(heading);
    rows.forEach(item => {
      const entry = document.createElement("article");
      const question = document.createElement("strong");
      question.textContent = cleanString(item.question);
      const answer = document.createElement("p");
      answer.textContent = cleanString(item.answer);
      entry.append(question, answer);
      section.appendChild(entry);
    });
    return section;
  }

  function showServiceDetails(service, packages, addons, card) {
    const dialog = ensureServiceDialog();
    const title = cleanString(service.name) || "Audio service";
    dialog.querySelector("#cmsServiceDialogTitle").textContent = title;
    dialog.querySelector(".cms-service-dialog-description").textContent = cleanString(service.description) || cleanString(service.short_description) || "Get in touch with our team to discuss this service.";
    dialog.querySelector(".cms-service-dialog-price").textContent = servicePriceLabel(service, packages);
    const art = dialog.querySelector(".cms-service-dialog-art");
    art.replaceChildren();
    const sourceArt = card && card.querySelector(".service-art");
    if (sourceArt) {
      const image = sourceArt.querySelector("img");
      if (image && safeHttps(image.src)) { const clone = document.createElement("img"); clone.src = safeHttps(image.src); clone.alt = title + " artwork"; art.appendChild(clone); }
      else art.className = "cms-service-dialog-art " + Array.from(sourceArt.classList).filter(name => name.startsWith("service-art-")).join(" ");
    }
    const options = dialog.querySelector(".cms-service-dialog-options");
    options.replaceChildren();
    const packageSection = createOptionRows("Packages", packages, "packages");
    const addonSection = createOptionRows("Add-ons", addons, "addons");
    if (packageSection) options.appendChild(packageSection);
    if (addonSection) options.appendChild(addonSection);
    const meta = createServiceMetaSection(service);
    const deliverables = createServiceTextSection("Deliverables", service.deliverables);
    const requirements = createServiceTextSection("What we need from you", service.client_requirements);
    const terms = createServiceTermsSection(service.terms_markdown);
    const faq = createServiceFaqSection(service.faq);
    [meta, deliverables, requirements, terms, faq].forEach(section => { if (section) options.appendChild(section); });
    if (!options.childElementCount) { const note = document.createElement("p"); note.className = "cms-service-dialog-note"; note.textContent = "Package details and optional add-ons can be discussed with our team when you request a quote."; options.appendChild(note); }
    dialog.showModal();
  }
  function renderCmsServices(services, packages, addons) {
    const grid = document.querySelector(".page-view[data-page='services'] .service-grid");
    if (!grid) return;

    const existing = Array.from(grid.querySelectorAll(".service-card"));
    const bySlug = new Map();
    existing.forEach(card => {
      const slug = cleanString(card.dataset.serviceSlug);
      if (slug) bySlug.set(slug, card);
    });

    const used = new Set();
    const serviceRows = toArray(services).slice().sort((a, b) =>
      Number(a.display_order || 0) - Number(b.display_order || 0)
    );

    serviceRows.forEach((service, index) => {
      const slug = cleanString(service.slug);
      if (!slug) return;
      const card = bySlug.get(slug) || createServiceCard(service);
      card.classList.add("cms-service-card");
      used.add(card);
      card.hidden = false;
      card.dataset.serviceSlug = slug;

      const art = card.querySelector(".service-art");
      if (art) {
        const imageUrl = safeHttps(service.thumbnail_url);
        let image = art.querySelector("img.cms-service-art-image");
        if (imageUrl) {
          if (!image) {
            image = document.createElement("img");
            image.className = "cms-service-art-image";
            image.loading = "lazy";
            art.appendChild(image);
          }
          image.src = imageUrl;
          image.alt = cleanString(service.name) + " service artwork";
          art.classList.add("has-cms-art");
        } else if (image) {
          image.remove();
          art.classList.remove("has-cms-art");
        }
      }

      const eyebrow = card.querySelector("p.eyebrow");
      if (eyebrow && card.classList.contains("cms-service-card")) {
        eyebrow.textContent = "SERVICE " + String(index + 1).padStart(2, "0");
      }
      const title = card.querySelector("h3");
      if (title) title.textContent = cleanString(service.name);

      const shortDescription = cleanString(service.short_description);
      const fullDescription = cleanString(service.description);
      const summary = shortDescription || fullDescription;
      let description = card.querySelector("p.cms-service-summary") || card.querySelector("p:not(.eyebrow)");
      if (summary) {
        if (!description) {
          description = document.createElement("p");
          card.insertBefore(description, card.querySelector(".starting"));
        }
        description.classList.add("cms-service-summary");
        description.textContent = summary;
      }

      const oldLongDescription = card.querySelector(".cms-service-long-description");
      if (oldLongDescription) oldLongDescription.remove();

      const servicePackages = toArray(packages).filter(row => row.service_id === service.service_id);
      const serviceAddons = toArray(addons).filter(row => row.service_id === service.service_id);
      const oldOptions = card.querySelector(".cms-service-options-group");
      if (oldOptions) oldOptions.remove();

      const legacyRequestLink = card.querySelector("a.service-request");
      if (legacyRequestLink) legacyRequestLink.remove();
      let priceNode = card.querySelector(".starting");
      if (!priceNode) {
        priceNode = document.createElement("span");
        priceNode.className = "starting";
        card.appendChild(priceNode);
      }
      priceNode.textContent = servicePriceLabel(service, servicePackages);
      let detailsButton = card.querySelector(".cms-service-details-button");
      if (!detailsButton) {
        detailsButton = document.createElement("button");
        detailsButton.type = "button";
        detailsButton.className = "cms-service-details-button";
        detailsButton.textContent = "Explore service";
        detailsButton.setAttribute("aria-haspopup", "dialog");
        card.appendChild(detailsButton);
      }
      detailsButton.onclick = () => showServiceDetails(service, servicePackages, serviceAddons, card);
      grid.appendChild(card);
    });

    existing.forEach(card => {
      if (!used.has(card)) card.hidden = true;
    });

    if (!serviceRows.length) {
      let empty = grid.querySelector(".cms-services-empty");
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "cms-services-empty";
        empty.textContent = "Our service catalogue is being updated.";
        grid.appendChild(empty);
      }
    } else {
      const empty = grid.querySelector(".cms-services-empty");
      if (empty) empty.remove();
    }
  }

  window.perivelleApplyPublicCms = projectPublicCmsSettings;
  window.perivelleRenderCmsServices = renderCmsServices;
})();