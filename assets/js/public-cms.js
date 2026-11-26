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

  function firstCredit(creditsByWork, workId) {
    const credits = creditsByWork.get(workId) || [];
    return credits[0] || null;
  }

  function mapWorkCredit(work, creditsByWork) {
    const credit = firstCredit(creditsByWork, work.work_id);
    return credit ? credit.producer_id : "";
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
        const producerId = mapWorkCredit(work, creditsByWork);
        if (producerId) videoAssignments.push({ url: work.video_url, creator: producerId });
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
          creator: mapWorkCredit(work, creditsByWork)
        })),
        audio_works: audioWorks.map(work => ({
          work_id: work.work_id,
          title: work.title,
          description: work.description,
          cover_image_url: work.cover_image_url,
          audio_url: work.audio_url,
          creator: mapWorkCredit(work, creditsByWork)
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
      photo: producer.avatar_url || "",
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
      cms_service_addons: toArray(cmsData.service_addons)
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
      if (shortDescription && fullDescription && shortDescription !== fullDescription) {
        const longDescription = document.createElement("p");
        longDescription.className = "cms-service-long-description";
        longDescription.textContent = fullDescription;
        const priceNode = card.querySelector(".starting");
        card.insertBefore(longDescription, priceNode || null);
      }

      const servicePackages = toArray(packages).filter(row => row.service_id === service.service_id);
      const serviceAddons = toArray(addons).filter(row => row.service_id === service.service_id);
      const oldOptions = card.querySelector(".cms-service-options-group");
      if (oldOptions) oldOptions.remove();

      const options = document.createElement("div");
      options.className = "cms-service-options-group";
      const packageSection = createOptionRows("Packages", servicePackages, "packages");
      const addonSection = createOptionRows("Add-ons", serviceAddons, "addons");
      if (packageSection) options.appendChild(packageSection);
      if (addonSection) options.appendChild(addonSection);
      if (options.childElementCount) {
        const priceNode = card.querySelector(".starting");
        card.insertBefore(options, priceNode || null);
      }

      let priceNode = card.querySelector(".starting");
      if (!priceNode) {
        priceNode = document.createElement("span");
        priceNode.className = "starting";
        card.appendChild(priceNode);
      }
      priceNode.textContent = servicePriceLabel(service, servicePackages);
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