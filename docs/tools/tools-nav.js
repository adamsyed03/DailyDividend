// Shared Tools navigation configuration for all tools pages
// This keeps the "Tools" dropdown and mobile Tools list in sync.

const TOOLS_NAV_ITEMS = [
  { href: "../daily/index.html", icon: "fas fa-newspaper", label: "Daily Market Wrap-Up" },
  { href: "earnings.html", icon: "fas fa-calendar-alt", label: "Earnings Calendar" },
  { href: "macro-calendar.html", icon: "fas fa-chart-line", label: "Macro Calendar" },
  { href: "hedge-fund.html", icon: "fas fa-briefcase", label: "Hedge Fund Positioning" },
  { href: "company-analysis.html", icon: "fas fa-microchip", label: "Company Analysis" },
  { href: "congress.html", icon: "fas fa-landmark", label: "Congress Trade Monitor" },
  { href: "insider-moves.html", icon: "fas fa-user-tie", label: "Insider Activity" },
];

function renderToolsNav() {
  const desktopMenu = document.getElementById("toolsDropdownMenu");
  const mobileContent = document.querySelector(".mobile-menu-dropdown-content");

  if (desktopMenu) {
    desktopMenu.innerHTML = "";
    TOOLS_NAV_ITEMS.forEach((item) => {
      const a = document.createElement("a");
      a.href = item.href;
      a.className = "nav-dropdown-item";
      a.setAttribute("role", "menuitem");
      a.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;
      desktopMenu.appendChild(a);
    });
  }

  if (mobileContent) {
    mobileContent.innerHTML = "";
    TOOLS_NAV_ITEMS.forEach((item) => {
      const a = document.createElement("a");
      a.href = item.href;
      a.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;
      a.onclick = function () {
        if (typeof closeMobileMenu === "function") {
          closeMobileMenu();
        }
      };
      mobileContent.appendChild(a);
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderToolsNav);
} else {
  renderToolsNav();
}


