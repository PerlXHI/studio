/* PERIVELLE PUBLIC SITE — SMALL ENHANCEMENTS
   Pasang di akhir <body>, setelah script yang sudah ada:
   <script src="assets/js/site-enhancements.js" defer></script> */
(function(){
  "use strict";

  /* 1. Hanya satu audio yang berbunyi pada satu waktu
        (player mengambang, Featured Portfolio, dan Freebies). */
  document.addEventListener("play",function(e){
    if(!e.target||e.target.tagName!=="AUDIO")return;
    document.querySelectorAll("audio").forEach(function(a){
      if(a!==e.target&&!a.paused)a.pause();
    });
  },true);

  /* 2. "Request this service": buka form komisi dengan layanan terpilih.
        Urutan sama dengan kartu di halaman Services. */
  var OPTIONS=["Custom BGM","Sound Alerts","Lore / Cinematic Music","Original Song (OG Song)","VTuber Debut Bundle"];
  document.querySelectorAll('.page-view[data-page="services"] .service-card').forEach(function(card,i){
    if(card.classList.contains("cms-service-card")||card.dataset.serviceSlug||!OPTIONS[i]||card.querySelector(".service-request"))return;
    var a=document.createElement("a");
    a.className="service-request";
    a.href="#commission-request";
    a.dataset.service=OPTIONS[i];
    a.textContent="Request this service";
    card.appendChild(a);
  });
  document.addEventListener("click",function(e){
    var a=e.target.closest&&e.target.closest("a.service-request");
    if(!a)return;
    var select=document.getElementById("orderType");
    if(select){select.value=a.dataset.service;select.dispatchEvent(new Event("change",{bubbles:true}))}
  });

  /* 3. Form komisi: tanggal tidak boleh di masa lalu + draft otomatis.
        Draft hanya tersimpan di perangkat pengunjung dan dihapus
        setelah form berhasil dikirim (form.reset()). */
  var form=document.getElementById("customForm");
  if(form){
    var deadline=document.getElementById("deadline");
    if(deadline){var t=new Date();deadline.min=new Date(t.getTime()-t.getTimezoneOffset()*60000).toISOString().slice(0,10)}
    var KEY="pv_commission_draft";
    var ids=["customerName","customerContact","orderType","licenseType","moodBpm","duration","character","reference","deadline","budget","extra"];
    try{
      var saved=JSON.parse(localStorage.getItem(KEY)||"{}");
      ids.forEach(function(id){var el=document.getElementById(id);if(el&&saved[id]&&!el.value)el.value=saved[id]});
    }catch(err){}
    var timer;
    form.addEventListener("input",function(){
      clearTimeout(timer);
      timer=setTimeout(function(){
        var out={};
        ids.forEach(function(id){var el=document.getElementById(id);if(el&&el.value)out[id]=el.value});
        try{localStorage.setItem(KEY,JSON.stringify(out))}catch(err){}
      },400);
    });
    form.addEventListener("reset",function(){try{localStorage.removeItem(KEY)}catch(err){}});
  }

  /* 4. Skip link (tanpa hash, agar router tidak pindah ke Home). */
  var skip=document.createElement("a");
  skip.className="skip-link";skip.href="#main-content";skip.textContent="Skip to content";
  skip.addEventListener("click",function(e){
    e.preventDefault();
    var main=document.getElementById("main-content");
    if(main){main.setAttribute("tabindex","-1");main.focus()}
  });
  document.body.insertBefore(skip,document.body.firstChild);

  /* 5. Router index.html memperbarui data-active-view pada <html>. */
  var root=document.documentElement,last=root.dataset.activeView||"";
  new MutationObserver(function(){
    var now=root.dataset.activeView||"";
    if(!now||now===last)return;
    last=now;
    var view=document.querySelector('.page-view[data-page="'+now+'"]:not([hidden])');
    var heading=view&&view.querySelector("h1,h2");
    if(heading){heading.setAttribute("tabindex","-1");heading.focus({preventScroll:true})}
  }).observe(root,{attributes:true,attributeFilter:["data-active-view"]});

  /* 6. Smooth scroll (Lenis): inertial wheel scrolling.
        Lenis loads from CDN; if the CDN is unreachable or the
        user prefers reduced motion, nothing changes — the CSS
        scroll-behavior:smooth fallback stays active. */
  (function(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    function start(){
      if(typeof Lenis==="undefined")return;
      try{
        var lenis=new Lenis({duration:1.15,smoothWheel:true});
        window.__perivelleLenis=lenis;
        var raf=function(time){lenis.raf(time);requestAnimationFrame(raf)};
        requestAnimationFrame(raf);
      }catch(err){/* fall back to CSS smooth scroll */}
    }
    if(typeof Lenis!=="undefined"){start();return;}
    var s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js";
    s.defer=true;
    s.onload=start;
    document.head.appendChild(s);
  })();

  /* 7. Reveal on scroll: cards and section heads fade/slide in when
        they enter the viewport. No-op without IntersectionObserver
        or when the user prefers reduced motion — content stays
        fully visible in both cases. */
  (function(){
    if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    if(typeof IntersectionObserver==="undefined")return;
    var SELECTOR=".pv-work-card,.service-card,.pv-section-head,.pv-team-avatar,.pv-about-copy";
    var root=document.documentElement;
    root.classList.add("js-reveal");
    var observer=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting)return;
        var el=entry.target;
        observer.unobserve(el);
        el.classList.add("is-visible");
        setTimeout(function(){el.removeAttribute("data-reveal");el.style.transitionDelay="";},1000);
      });
    },{threshold:.12,rootMargin:"0px 0px -8% 0px"});
    function tag(scope){
      (scope||document).querySelectorAll(SELECTOR).forEach(function(el){
        if(el.hasAttribute("data-reveal")||el.classList.contains("is-visible"))return;
        var parent=el.parentNode;
        var siblings=parent?Array.prototype.filter.call(parent.children,function(s){return s.matches&&s.matches(SELECTOR)}):[el];
        el.setAttribute("data-reveal","");
        el.style.transitionDelay=Math.min(Math.max(siblings.indexOf(el),0)*70,280)+"ms";
        observer.observe(el);
      });
    }
    tag(document);
    /* Re-scan when the router switches views (new content enters). */
    var lastView=root.dataset.activeView||"";
    new MutationObserver(function(){
      var now=root.dataset.activeView||"";
      if(!now||now===lastView)return;
      lastView=now;
      tag(document);
    }).observe(root,{attributes:true,attributeFilter:["data-active-view"]});
  })();

  /* 8. Floating widgets (Contact Us pill, audio dock) get out of the way:
        they slide away while the user scrolls down or reads the footer,
        so they never cover headings, cards or the copyright line. They
        return when the user scrolls back up. Never hide while the contact
        menu is open or the audio panel is expanded/playing. */
  (function(){
    var widget=document.getElementById("contactWidget");
    var dock=document.getElementById("pvAudioDock");
    var footer=document.querySelector("footer");
    if(!widget&&!dock)return;
    var footerVisible=false,lastY=window.scrollY||0,scrollHidden=false;
    function dockBusy(){
      if(!dock)return false;
      return dock.classList.contains("is-open")||dock.classList.contains("is-playing")||dock.matches(":hover,:focus-within");
    }
    function menuOpen(){
      if(!widget)return false;
      var menu=document.getElementById("contactMenu");
      return !!menu&&!menu.hidden;
    }
    function apply(){
      var hideFooter=footerVisible;
      if(widget)widget.classList.toggle("is-hidden",(hideFooter||scrollHidden)&&!menuOpen());
      if(dock)dock.classList.toggle("is-hidden",hideFooter||(scrollHidden&&!dockBusy()));
    }
    if(footer&&"IntersectionObserver" in window){
      new IntersectionObserver(function(entries){
        footerVisible=!!(entries[0]&&entries[0].isIntersecting);
        apply();
      },{rootMargin:"0px 0px -40px 0px"}).observe(footer);
    }
    window.addEventListener("scroll",function(){
      var y=window.scrollY||0;
      scrollHidden=y>140&&y>lastY;
      lastY=y;
      apply();
    },{passive:true});
  })();

  /* 9. A dead avatar/photo URL must never show a broken-image icon: swap
        it for the initial-letter tile instead (team cards, producer
        modal, home avatar strip). Capture phase, so it catches the error
        before the browser paints the broken icon. */
  document.addEventListener("error",function(event){
    var img=event.target;
    if(!img||img.tagName!=="IMG"||img.dataset.fallbackDone)return;
    var box=img.closest(".producer-profile-avatar,.team-avatar,.pv-team-avatar");
    if(!box)return;
    img.dataset.fallbackDone="true";
    var name=(img.alt||"").replace(/ portrait$/i,"").trim();
    if(!name){
      var card=img.closest("[data-producer-id]");
      if(card)name=card.getAttribute("data-producer-id")||"";
    }
    if(!name){
      var link=img.closest("[aria-label]");
      if(link){
        var label=link.getAttribute("aria-label")||"";
        var words=label.trim().split(/\s+/);
        name=words[words.length-1]||"";
      }
    }
    var tile=document.createElement("span");
    tile.textContent=(name.slice(0,1).toUpperCase()||"?");
    img.replaceWith(tile);
  },true);

  /* 10. "Contact" links (navbar CTA + footer Company) open the floating
        contact menu instead of navigating to the commission form.
        They used to point at #custom, so every Contact click landed on
        the commission tab. The menu shows the real contact options
        (Discord / X / VGen / Email) from the CMS. */
  document.addEventListener("click",function(event){
    var link=event.target.closest?event.target.closest("[data-open-contact]"):null;
    if(!link)return;
    event.preventDefault();
    var widget=document.getElementById("contactWidget");
    var menu=document.getElementById("contactMenu");
    var trigger=document.getElementById("contactTrigger");
    if(!widget||!menu||!trigger)return;
    widget.classList.remove("is-hidden");
    menu.hidden=false;
    trigger.setAttribute("aria-expanded","true");
  });
})();
