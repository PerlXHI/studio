(function () {
  "use strict";

  const clean = value => String(value == null ? "" : value).trim();
  const safeUrl = value => {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return url.protocol === "https:" ? url.href : "";
    } catch (_) { return ""; }
  };

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function getDialog() {
    let dialog = document.getElementById("producerProfileDialog");
    if (dialog) return dialog;
    dialog = make("dialog", "producer-profile-dialog");
    dialog.id = "producerProfileDialog";
    dialog.setAttribute("aria-labelledby", "producerProfileName");
    // Let the modal scroll natively: Lenis (smooth scroll) must not hijack
    // wheel events over this dialog, or the page behind scrolls instead.
    dialog.setAttribute("data-lenis-prevent", "");
    const inner = make("div", "producer-profile-inner");
    const close = make("button", "producer-profile-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close producer profile");
    // SVG, not the "×" glyph: a glyph's ink is never optically centred in
    // its em box, so it always sat off-centre in the circle on some fonts.
    close.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
    close.addEventListener("click", () => dialog.close());
    dialog.appendChild(inner);
    // Close is a direct child of the dialog (not of the scrolling inner),
    // so it always paints above the header/content and never sits under it.
    dialog.appendChild(close);
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function creditedWorks(producer) {
    const data = window.perivellePublicCmsData || {};
    const works = Array.isArray(data.works) ? data.works : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const credits = Array.isArray(data.work_producers) ? data.work_producers : [];
    const categoryName = id => {
      const category = categories.find(item => item.category_id === id);
      return category ? clean(category.name) : "Selected work";
    };
    return works.map(work => {
      const matching = credits.filter(credit => credit.work_id === work.work_id && credit.producer_id === producer.id);
      if (!matching.length) return null;
      const roles = matching.map(credit => clean(credit.credit_role)).filter(Boolean);
      return { work, category: categoryName(work.category_id), role: roles.join(" / ") };
    }).filter(Boolean).sort((a,b) => Number(b.work.is_featured) - Number(a.work.is_featured) ||
      Number(a.work.display_order || 0) - Number(b.work.display_order || 0));
  }

  function openProfile(producerId, card) {
    const producers = Array.isArray(window.perivelleProducerData) ? window.perivelleProducerData : [];
    const producer = producers.find(item => clean(item.id) === clean(producerId)) || (card ? {
      id: producerId,
      name: clean(card.querySelector(".team-info h3")?.textContent) || "Producer Name",
      role: clean(card.querySelector(".team-info .eyebrow")?.textContent) || "Music Producer",
      bio: clean(card.querySelector(".team-bio")?.textContent),
      photo: card.querySelector(".team-avatar img")?.src || "",
      tags: Array.from(card.querySelectorAll(".team-tags span")).map(tag => clean(tag.textContent))
    } : null);
    if (!producer) return;
    const dialog = getDialog();
    const inner = dialog.querySelector(".producer-profile-inner");
    inner.replaceChildren();

    // <div>, not <header>: the site's global `header` element rules (with
    // !important) would paint over this panel and hide the gradient.
    const header = make("div", "producer-profile-header");
    const avatar = make("div", "producer-profile-avatar");
    const photo = safeUrl(producer.photo);
    if (photo) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = clean(producer.name) + " portrait";
      img.loading = "lazy";
      // A dead photo URL must fall back to the initial tile, never a
      // broken-image icon with clipped alt text.
      img.addEventListener("error", function(){ avatar.textContent = clean(producer.name).slice(0,1).toUpperCase() || "?"; });
      avatar.appendChild(img);
    } else avatar.textContent = clean(producer.name).slice(0,1).toUpperCase() || "?";

    const heading = make("div");
    heading.append(
      make("p", "producer-profile-eyebrow", "PERIVELLE SOUND COLLECTIVE"),
      make("h2", "producer-profile-name", clean(producer.name) || "Producer Name"),
      make("p", "producer-profile-role", clean(producer.role) || "Music Producer · Role placeholder")
    );
    header.append(avatar, heading);
    inner.appendChild(header);

    inner.appendChild(make("p", "producer-profile-bio", clean(producer.bio) ||
      "A short introduction about this producer will appear here. Share their sound, creative approach, and the kind of projects they love working on."));

    // Only show tags that actually have values; an empty label-only pill
    // looks unfinished, so with no tags the whole row is omitted.
    const tags = Array.isArray(producer.tags) ? producer.tags.map(clean).filter(Boolean) : [];
    if (tags.length) {
      const tagList = make("div", "producer-profile-tags");
      tags.forEach(tag => tagList.appendChild(make("span", "", tag)));
      inner.appendChild(tagList);
    }

    // Only show "Selected works" when the producer actually has linked
    // works; generic placeholder boxes make the modal look unfinished.
    const projects = creditedWorks(producer);
    if (projects.length) {
      const section = make("section", "producer-profile-works");
      section.appendChild(make("h3", "", "Selected works"));
      const list = make("div", "producer-profile-work-list");
      projects.forEach(({work,category,role}) => {
        const link = make("a", "producer-profile-work");
        link.href = "#portfolio?creator=" + encodeURIComponent(producer.id);
        link.addEventListener("click", () => { if (dialog.open) dialog.close(); });
        const copy = make("span");
        copy.append(make("strong", "", clean(work.title) || "Untitled work"),
          make("small", "", category + (role ? " · " + role : "")));
        link.append(copy, make("em", "", "View works ↗"));
        list.appendChild(link);
      });
      section.appendChild(list);
      inner.appendChild(section);
    }

    const actions = make("div", "producer-profile-actions");
    const worksLink = make("a", "", "Explore portfolio ↗");
    worksLink.href = "#portfolio?creator=" + encodeURIComponent(producer.id);
    // Close the profile first, then let the existing SPA/hash navigation run normally.
    worksLink.addEventListener("click", () => { if (dialog.open) dialog.close(); });
    actions.appendChild(worksLink);
    inner.appendChild(actions);

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    // The dialog is reused: always open it scrolled to the top.
    dialog.scrollTop = 0;
  }

  // Capture the click before the site's hash/SPA navigation handler can route to Works.
  document.addEventListener("click", event => {
    const card = event.target.closest(".team-card[data-producer-id]");
    if (!card || !card.closest(".page-view[data-page='team']")) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    openProfile(card.dataset.producerId, card);
  }, true);
  window.perivelleOpenProducerProfile = openProfile;
})();