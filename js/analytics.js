(function () {
function track(eventName, params = {}) {
if (typeof window.gtag === "function") {
window.gtag("event", eventName, params);
}
}

window.ddTrack = track;

function normalise(value) {
return (value || "")
.trim()
.toLowerCase()
.replace(/&/g, "and")
.replace(/\s+/g, "*")
.replace(/[^a-z0-9*]/g, "");
}

function getCompanyName() {
return (
document.body.getAttribute("data-company") ||
document.querySelector("[data-company-name]")?.getAttribute("data-company-name") ||
document.querySelector(".hero-name")?.textContent ||
document.querySelector("h1")?.textContent ||
""
).trim();
}

function bindTrackedClicks() {
document.querySelectorAll("[data-dd-event]").forEach(function (el) {
if (el.dataset.ddBound === "true") return;
el.dataset.ddBound = "true";

  el.addEventListener("click", function () {
    const eventName = el.getAttribute("data-dd-event");
    if (!eventName) return;

    const params = {
      page_path: window.location.pathname
    };

    Array.from(el.attributes).forEach(function (attr) {
      if (attr.name.startsWith("data-dd-param-")) {
        const key = attr.name.replace("data-dd-param-", "").replace(/-/g, "_");
        params[key] = attr.value;
      }
    });

    track(eventName, params);
  });
});

}

document.addEventListener("DOMContentLoaded", function () {
const pagePath = window.location.pathname;
const companyName = getCompanyName();
const companySlug = normalise(companyName);

bindTrackedClicks();

if (document.body.hasAttribute("data-company")) {
  track("view_company", {
    company_name: companyName,
    company_slug: companySlug,
    page_path: pagePath
  });
}

const retentionMarks = [15, 30, 60, 120, 300];

retentionMarks.forEach(function (seconds) {
  setTimeout(function () {
    track("site_retention_checkpoint", {
      seconds: seconds,
      page_path: pagePath,
      company_name: companyName || undefined,
      company_slug: companyName ? companySlug : undefined
    });
  }, seconds * 1000);
});

});
})();
