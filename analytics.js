/* sunilmadhu.me analytics
   - A first-party visit log (Cloudflare Worker) records views, chapters reached, clicks with position, prints opened,
     gestures and engaged time. The Worker tags each visit with the visitor's network organization.
   - Microsoft Clarity (heatmaps, recordings) and Google Analytics 4 load alongside it.
   - Visitors in the EU, EEA, UK and Switzerland see a consent banner first; nothing is recorded until they accept. */
(function () {
  if ((navigator.webdriver && !/[?&]forcetrack\b/.test(location.search)) || /[?&]notrack\b/.test(location.search)) { window.track = function () {}; return; }
  var EP = "https://sunilmadhu-analytics.sunilmadhu.workers.dev", CLARITY = "zfzzxvowwj", GA = "G-7SPD73PSP5";
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  var rid = function () { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); };
  var q = [], on = false, consent = "na", sid = ss("sm_sid") || rid(), vid = null, engaged = 0, lastActive = Date.now();
  ss("sm_sid", sid);
  var params = new URLSearchParams(location.search), utm = ["utm_source", "utm_medium", "utm_campaign"].map(function (k) { return params.get(k); }).filter(Boolean).join(" / ");
  var ref = document.referrer && document.referrer.indexOf(location.host) < 0 ? (function () { try { return new URL(document.referrer).hostname; } catch (e) { return ""; } })() : "";

  window.track = function (type, p) {
    if (!on) return;
    p = p || {};
    q.push({ ts: Date.now(), vid: vid, type: type, path: location.pathname, section: p.section || currentSection(), target: p.target, label: p.label,
      x: p.x, y: p.y, vw: innerWidth, vh: innerHeight, val: p.val });
    if (q.length >= 20) flush();
  };
  function flush(beacon) {
    if (!q.length) return;
    var body = JSON.stringify({ sid: sid, ref: ref, utm: utm, consent: consent, events: q.splice(0, 60) });
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(EP + "/e", new Blob([body], { type: "text/plain" })); return; }
    fetch(EP + "/e", { method: "POST", body: body, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(function () {});
  }
  function currentSection() {
    var id = "top", secs = document.querySelectorAll("main > section[id]");
    for (var i = 0; i < secs.length; i++) if (secs[i].getBoundingClientRect().top < innerHeight * .55) id = secs[i].id;
    return id;
  }
  function labelOf(el) {
    var t = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.getAttribute("href") || el.id || el.tagName).replace(/\s+/g, " ").trim();
    return t.slice(0, 80);
  }

  function start() {
    on = true;
    vid = ls("sm_vid") || rid(); ls("sm_vid", vid);
    track("view", { label: document.title });
    // chapters reached
    var seen = {};
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !seen[e.target.id]) { seen[e.target.id] = 1; track("section", { section: e.target.id }); } }); }, { threshold: .35 });
    document.querySelectorAll("main > section[id]").forEach(function (s) { io.observe(s); });
    // what is clicked, and where on the page
    addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("a,button,[role=button],input,summary,.ic,.chip,canvas") : null;
      var h = Math.max(document.documentElement.scrollHeight, 1);
      track("click", { target: el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") : "page", label: el ? labelOf(el) : "", x: +(e.clientX / innerWidth).toFixed(4), y: +((e.clientY + scrollY) / h).toFixed(4) });
    }, { capture: true, passive: true });
    // engaged time: counted while the tab is visible and the visitor moved, scrolled or typed in the last 30 seconds
    ["pointermove", "scroll", "keydown", "touchstart", "wheel"].forEach(function (ev) { addEventListener(ev, function () { lastActive = Date.now(); }, { passive: true }); });
    setInterval(function () { if (document.visibilityState === "visible" && Date.now() - lastActive < 30000) engaged += 5; }, 5000);
    setInterval(function () { if (engaged) track("hb", { val: engaged }); flush(); }, 15000);
    addEventListener("pagehide", function () { track("leave", { val: engaged }); flush(true); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { track("hb", { val: engaged }); flush(true); } });
    setTimeout(flush, 1500);
    loadTools();
  }
  function loadTools() {
    (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, "clarity", "script", CLARITY);
    if (consent === "yes") window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
    var s = document.createElement("script"); s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments); };
    gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    gtag("js", new Date()); gtag("config", GA);
  }

  function banner() {
    var b = document.createElement("div");
    b.id = "consent";
    b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Analytics consent");
    b.innerHTML = '<p>This site uses analytics (Microsoft Clarity, Google Analytics and its own visit log) to see how it is read. Nothing is recorded unless you accept.</p>' +
      '<div><button type="button" data-c="no">Decline</button><button type="button" data-c="yes">Accept</button></div>';
    var st = document.createElement("style");
    st.textContent = "#consent{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:60;max-width:min(560px,calc(100vw - 32px));display:flex;gap:16px;align-items:center;" +
      "padding:14px 16px;border-radius:14px;background:rgba(14,15,18,.92);border:1px solid rgba(237,234,227,.14);color:#edeae3;font:400 13px/1.45 'IBM Plex Mono',ui-monospace,monospace;backdrop-filter:blur(10px);box-shadow:0 10px 40px rgba(0,0,0,.5)}" +
      "#consent p{margin:0}#consent div{display:flex;gap:8px;flex:none}#consent button{font:inherit;cursor:pointer;border-radius:999px;padding:7px 14px;border:1px solid rgba(237,234,227,.25);background:transparent;color:inherit}" +
      "#consent button[data-c=yes]{background:#e8b36b;border-color:#e8b36b;color:#121316}@media(max-width:560px){#consent{flex-direction:column;align-items:stretch}}";
    document.head.appendChild(st); document.body.appendChild(b);
    b.addEventListener("click", function (e) {
      var c = e.target.getAttribute && e.target.getAttribute("data-c"); if (!c) return;
      ls("sm_consent", c); b.remove(); if (c === "yes") { consent = "yes"; start(); }
    });
  }

  var saved = ls("sm_consent");
  if (saved === "yes") { consent = "yes"; start(); return; }
  if (saved === "no") { window.track = function () {}; return; }
  fetch(EP + "/geo").then(function (r) { return r.json(); }).then(function (g) {
    if (g && g.consent) { if (document.body) banner(); else addEventListener("DOMContentLoaded", banner); }
    else { consent = "na"; start(); }
  }).catch(function () { /* the visit log is unreachable; record nothing */ });
})();
