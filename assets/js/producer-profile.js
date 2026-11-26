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
    const inner = make("div", "producer-profile-inner");
    const close = make("button", "producer-profile-close", "×");
    close.type = "button";
    close.setAttribute("aria-label", "Close producer profile");
    close.addEventListener("click", () => dialog.close());
    inner.appendChild(close);
    dialog.appendChild(inner);
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

  function openProfile(producerId) {
    const producers = Array.isArray(window.perivelleProducerData) ? window.perivelleProducerData : [];
    const producer = producers.find(item => clean(item.id) === clean(producerId));
    if (!producer) return;
    const dialog = getDialog();
    const inner = dialog.querySelector(".producer-profile-inner");
    inner.querySelectorAll(":scope > :not(.producer-profile-close)").forEach(node => node.remove());

    const header = make("header", "producer-profile-header");
    const avatar = make("div", "producer-profile-avatar");
    const photo = safeUrl(producer.photo);
    if (photo) {
      const img = document.createElement("img");
      img.src = photo;
      img.alt = clean(producer.name) + " portrait";
      img.loading = "lazy";
      avatar.appendChild(img);
    } else avatar.textContent = clean(producer.name).slice(0,1).toUpperCase() || "?";

    const heading = make("div");
    heading.append(
      make("p", "producer-profile-eyebrow", "PERIVELLE SOUND COLLECTIVE"),
      make("h2", "producer-profile-name", clean(producer.name)),
      make("p", "producer-profile-role", clean(producer.role) || "Music Producer")
    );
    header.append(avatar, heading);
    inner.appendChild(header);

    if (clean(producer.bio)) inner.appendChild(make("p", "producer-profile-bio", clean(producer.bio)));

    const tags = Array.isArray(producer.tags) ? producer.tags.map(clean).filter(Boolean) : [];
    if (tags.length) {
      const tagList = make("div", "producer-profile-tags");
      tags.forEach(tag => tagList.appendChild(make("span", "", tag)));
      inner.appendChild(tagList);
    }

    const projects = creditedWorks(producer);
    const section = make("section", "producer-profile-works");
    section.appendChild(make("h3", "", "Selected works"));
    if (projects.length) {
      const list = make("div", "producer-profile-work-list");
      projects.forEach(({work,category,role}) => {
        const link = make("a", "producer-profile-work");
        link.href = "#portfolio?creator=" + encodeURIComponent(producer.id);
        const copy = make("span");
        copy.append(make("strong", "", clean(work.title) || "Untitled work"),
          make("small", "", category + (role ? " · " + role : "")));
        link.append(copy, make("em", "", "View works ↗"));
        list.appendChild(link);
      });
      section.appendChild(list);
    } else {
      section.appendChild(make("p", "producer-profile-bio", "Selected projects will appear here once this producer is credited in the CMS."));
    }
    inner.appendChild(section);

    const actions = make("div", "producer-profile-actions");
    const worksLink = make("a", "", "Explore portfolio ↗");
    worksLink.href = "#portfolio?creator=" + encodeURIComponent(producer.id);
    actions.appendChild(worksLink);
    inner.appendChild(actions);

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  document.addEventListener("click", event => {
    const card = event.target.closest(".page-view[data-page='team'] .team-card[data-producer-id]");
    if (!card) return;
    event.preventDefault();
    openProfile(card.dataset.producerId);
  });
  window.perivelleOpenProducerProfile = openProfile;
})();