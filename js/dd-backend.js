const DD_BACKEND_URL = "https://script.google.com/macros/s/AKfycbx527EDYrD0-3NZE28t2uwJ5VQtXSUf4ckv2OWGg6D7zMRfmz52YoK85XtdxF4hJA/exec";

function ddBuildUrl(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.append(key, String(value));
  });
  return `${DD_BACKEND_URL}?${qs.toString()}`;
}

async function ddReadJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { status: "ERR", reason: text };
  }
}

function ddBackendOk(data) {
  const status = String(data?.status || data?.result || data?.message || "").toLowerCase();
  return data?.ok === true || data?.success === true || ["ok", "success", "found", "valid", "authorized", "logged_in", "login_success"].includes(status);
}

async function ddFetchJson(params, label = "DD backend request") {
  const url = ddBuildUrl(params);
  console.log("REQUEST URL:", url);
  const response = await fetch(url);
  const data = await ddReadJson(response);
  return { url, response, data, label };
}

function ddInferCompanyName(fallback = "") {
  const bodyCompany = document.body?.getAttribute("data-company");
  if (bodyCompany) return bodyCompany.trim();
  const dataCompany = document.querySelector("[data-company-name]")?.getAttribute("data-company-name");
  if (dataCompany) return dataCompany.trim();
  const heroName = document.querySelector(".hero-name")?.textContent?.trim();
  if (heroName) return heroName;
  const title = document.title || "";
  const titleCompany = title.split("—")[0].split("-")[0].trim();
  return titleCompany || fallback;
}
