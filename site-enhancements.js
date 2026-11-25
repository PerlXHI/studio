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
    if(!OPTIONS[i]||card.querySelector(".service-request"))return;
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
