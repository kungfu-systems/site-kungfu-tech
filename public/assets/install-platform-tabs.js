export function detectDesktopPlatform(navigatorLike = {}) {
  const userAgent = String(navigatorLike.userAgent || "").toLowerCase();
  const platform = String(
    navigatorLike.userAgentData?.platform || navigatorLike.platform || "",
  ).toLowerCase();
  const combined = `${platform} ${userAgent}`;
  const touchPoints = Number(navigatorLike.maxTouchPoints || 0);

  if (
    /android|cros|iphone|ipad|ipod/.test(combined)
    || (platform === "macintel" && touchPoints > 1)
  ) {
    return null;
  }
  if (combined.includes("win")) return "win32-x64";
  if (combined.includes("mac")) return "darwin-arm64";
  if (combined.includes("linux") || combined.includes("x11")) {
    return "linux-x64";
  }
  return null;
}

export function initializeDesktopPlatformTabs(
  root = globalThis.document,
  navigatorLike = globalThis.navigator,
) {
  const tablist = root?.querySelector(
    "[aria-label='Choose a desktop platform']",
  );
  if (!tablist) return null;

  const tabs = Array.from(
    tablist.querySelectorAll("[data-desktop-platform]"),
  );
  const panels = Array.from(root.querySelectorAll("[data-desktop-panel]"));
  if (tabs.length === 0) return null;

  const activate = (tab, focus = false) => {
    const platform = tab.dataset.desktopPlatform;
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.desktopPanel !== platform;
    });
    if (focus) tab.focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activate(tab));
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        next = tabs[(index + 1) % tabs.length];
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        next = tabs[(index - 1 + tabs.length) % tabs.length];
      } else if (event.key === "Home") {
        next = tabs[0];
      } else if (event.key === "End") {
        next = tabs[tabs.length - 1];
      }
      if (!next) return;
      event.preventDefault();
      activate(next, true);
    });
  });

  const detectedPlatform = detectDesktopPlatform(navigatorLike);
  const detectedTab = tabs.find(
    (tab) => tab.dataset.desktopPlatform === detectedPlatform,
  );
  if (detectedTab) activate(detectedTab);
  return detectedTab?.dataset.desktopPlatform || null;
}

if (typeof document !== "undefined") {
  initializeDesktopPlatformTabs(document, navigator);
}
