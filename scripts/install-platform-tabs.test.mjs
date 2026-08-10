#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";

import {
  detectDesktopPlatform,
  initializeDesktopPlatformTabs,
} from "../public/assets/install-platform-tabs.js";

function tab(platform) {
  return {
    dataset: { desktopPlatform: platform },
    listeners: {},
    attributes: {},
    tabIndex: -1,
    focused: false,
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {
      this.focused = true;
    },
  };
}

test("detects supported desktop operating systems", () => {
  assert.equal(
    detectDesktopPlatform({
      userAgentData: { platform: "macOS" },
      userAgent: "Mozilla/5.0",
    }),
    "darwin-arm64",
  );
  assert.equal(
    detectDesktopPlatform({
      userAgentData: { platform: "Windows" },
      userAgent: "Mozilla/5.0",
    }),
    "win32-x64",
  );
  assert.equal(
    detectDesktopPlatform({
      platform: "Linux x86_64",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    }),
    "linux-x64",
  );
});

test("leaves unsupported and ambiguous clients on the markup default", () => {
  assert.equal(
    detectDesktopPlatform({
      platform: "Linux armv8l",
      userAgent: "Mozilla/5.0 (Linux; Android 15)",
    }),
    null,
  );
  assert.equal(
    detectDesktopPlatform({
      platform: "MacIntel",
      maxTouchPoints: 5,
      userAgent: "Mozilla/5.0 (Macintosh)",
    }),
    null,
  );
  assert.equal(
    detectDesktopPlatform({ userAgent: "Mozilla/5.0 (X11; CrOS x86_64)" }),
    null,
  );
  assert.equal(detectDesktopPlatform({}), null);
});

test("activates the detected OS without disabling manual or keyboard selection", () => {
  const tabs = [
    tab("darwin-arm64"),
    tab("linux-x64"),
    tab("win32-x64"),
  ];
  const panels = tabs.map((item) => ({
    dataset: { desktopPanel: item.dataset.desktopPlatform },
    hidden: false,
  }));
  const root = {
    querySelector() {
      return {
        querySelectorAll() {
          return tabs;
        },
      };
    },
    querySelectorAll() {
      return panels;
    },
  };

  assert.equal(
    initializeDesktopPlatformTabs(root, {
      userAgentData: { platform: "Windows" },
    }),
    "win32-x64",
  );
  assert.deepEqual(
    tabs.map((item) => item.attributes["aria-selected"]),
    ["false", "false", "true"],
  );
  assert.deepEqual(panels.map((panel) => panel.hidden), [true, true, false]);

  tabs[1].listeners.click();
  assert.deepEqual(
    tabs.map((item) => item.attributes["aria-selected"]),
    ["false", "true", "false"],
  );
  assert.deepEqual(panels.map((panel) => panel.hidden), [true, false, true]);

  let prevented = false;
  tabs[1].listeners.keydown({
    key: "ArrowRight",
    preventDefault() {
      prevented = true;
    },
  });
  assert.equal(prevented, true);
  assert.equal(tabs[2].attributes["aria-selected"], "true");
  assert.equal(tabs[2].focused, true);
});
