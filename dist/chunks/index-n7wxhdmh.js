// lib/config-io.ts
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { Type } from "typebox";
import { Value } from "typebox/value";
function expandTilde(p) {
  if (p === "~")
    return homedir();
  if (p.startsWith("~/"))
    return join(homedir(), p.slice(2));
  return p;
}
function defaultConfigDir() {
  return join(homedir(), ".config");
}
function resolveConfigDir() {
  const xdg = readEnvVar("XDG_CONFIG_HOME");
  if (!xdg)
    return defaultConfigDir();
  const expanded = expandTilde(xdg);
  return isAbsolute(expanded) ? expanded : defaultConfigDir();
}
function legacyConfigPath(name, file = "config.json") {
  return join(defaultConfigDir(), name, file);
}
function configPath(name, file = "config.json") {
  return join(resolveConfigDir(), name, file);
}
function loadJsonConfig(path) {
  if (!existsSync(path))
    return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed;
  } catch (err) {
    console.warn(`rpiv-config: invalid JSON at ${path}, using default ({}) — ${err.message}`);
    return {};
  }
}
function loadJsonConfigWithLegacyFallback(name, file = "config.json") {
  const xdgPath = configPath(name, file);
  if (existsSync(xdgPath)) {
    return loadJsonConfig(xdgPath);
  }
  return loadJsonConfig(legacyConfigPath(name, file));
}
var GuidanceFieldsSchema = Type.Object({
  promptSnippet: Type.Optional(Type.String()),
  promptGuidelines: Type.Optional(Type.Array(Type.String())),
  description: Type.Optional(Type.String())
}, { additionalProperties: true });
function validateGuidanceFields(fields) {
  if (!fields || typeof fields !== "object")
    return {};
  const g = fields;
  const result = {};
  if (typeof g.promptSnippet === "string" && g.promptSnippet.length > 0) {
    result.promptSnippet = g.promptSnippet;
  }
  if (Array.isArray(g.promptGuidelines) && g.promptGuidelines.length > 0 && g.promptGuidelines.every((s) => typeof s === "string" && s.length > 0)) {
    result.promptGuidelines = g.promptGuidelines;
  }
  if (typeof g.description === "string" && g.description.length > 0) {
    result.description = g.description;
  }
  return result;
}
function readEnvVar(key, fallback) {
  return process.env[key]?.trim() || fallback;
}

// config.ts
var DEFAULT_COLLAPSE_KEY = "ctrl+]";
var COLLAPSE_KEY_OFF = "off";
var DEFAULT_NOTES_KEY = "n";
var KEY_PLACEHOLDER = "{key}";
var SPECIAL_KEYS = new Set([
  "escape",
  "esc",
  "enter",
  "return",
  "tab",
  "space",
  "backspace",
  "delete",
  "insert",
  "clear",
  "home",
  "end",
  "pageup",
  "pagedown",
  "up",
  "down",
  "left",
  "right",
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`)
]);
var MODIFIERS = new Set(["ctrl", "shift", "alt", "super"]);
function isValidCollapseKeySpec(spec) {
  if (!spec)
    return false;
  if (spec.startsWith("+") || spec.endsWith("+") || spec.includes("++"))
    return false;
  const parts = spec.split("+");
  const base = parts[parts.length - 1] ?? "";
  const modifiers = parts.slice(0, -1);
  if (modifiers.length !== new Set(modifiers).size)
    return false;
  if (!modifiers.every((m) => MODIFIERS.has(m)))
    return false;
  return base.length === 1 ? /[a-z0-9_\-!@#$%^&*()|~`'":;,./<>?[\]{}=\\]/.test(base) : SPECIAL_KEYS.has(base);
}
function resolveCollapseKey(config) {
  const raw = config.collapseKey?.trim().toLowerCase();
  if (raw === undefined || raw === "")
    return DEFAULT_COLLAPSE_KEY;
  if (raw === COLLAPSE_KEY_OFF)
    return COLLAPSE_KEY_OFF;
  return isValidCollapseKeySpec(raw) ? raw : DEFAULT_COLLAPSE_KEY;
}
var NOTES_KEY_RESERVED = new Set([
  "space",
  "enter",
  "return",
  "tab",
  "escape",
  "esc",
  "up",
  "down",
  "left",
  "right"
]);
function resolveNotesKey(config) {
  const raw = typeof config.notesKey === "string" ? config.notesKey.trim() : "";
  if (!raw)
    return DEFAULT_NOTES_KEY;
  if ([...raw].length === 1)
    return raw;
  const spec = raw.toLowerCase();
  return isValidCollapseKeySpec(spec) && !NOTES_KEY_RESERVED.has(spec) ? spec : DEFAULT_NOTES_KEY;
}
function formatNotesKeyForDisplay(notesKey) {
  if (typeof notesKey !== "string" || notesKey.length === 0)
    return formatNotesKeyForDisplay(DEFAULT_NOTES_KEY);
  return [...notesKey].length === 1 ? notesKey : formatKeySpecForDisplay(notesKey);
}
var COMPOUND_KEY_DISPLAY = {
  pageup: "PageUp",
  pagedown: "PageDown"
};
function formatKeySpecForDisplay(spec) {
  return spec.split("+").map((part) => COMPOUND_KEY_DISPLAY[part] ?? (part.length <= 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))).join("+");
}
function loadConfig() {
  return loadJsonConfigWithLegacyFallback("rpiv-ask-user-question");
}

// state/row-intent.ts
var SENTINEL_KINDS = ["other", "next"];
var ROW_INTENT_META = {
  option: {
    label: "",
    reserved: false,
    livesInMainList: true,
    numbered: true,
    activatesInputMode: false,
    blocksMultiToggle: false,
    autoSubmitsInMulti: false,
    autoAppendOnSingleSelect: false,
    autoAppendOnMultiSelect: false
  },
  other: {
    label: "Type something.",
    reserved: true,
    livesInMainList: true,
    numbered: true,
    activatesInputMode: true,
    blocksMultiToggle: false,
    autoSubmitsInMulti: false,
    autoAppendOnSingleSelect: true,
    autoAppendOnMultiSelect: true
  },
  next: {
    label: "Next",
    reserved: true,
    livesInMainList: true,
    numbered: false,
    activatesInputMode: false,
    blocksMultiToggle: true,
    autoSubmitsInMulti: true,
    autoAppendOnSingleSelect: false,
    autoAppendOnMultiSelect: true
  }
};
var LABELS_BY_KIND = {
  other: ROW_INTENT_META.other.label,
  next: ROW_INTENT_META.next.label
};
var RESERVED_LABEL_SET = new Set([
  "Other",
  ...SENTINEL_KINDS.filter((k) => ROW_INTENT_META[k].reserved).map((k) => ROW_INTENT_META[k].label)
]);
function sentinelsToAppend(question) {
  const out = [];
  for (const k of SENTINEL_KINDS) {
    const meta = ROW_INTENT_META[k];
    if (!meta.livesInMainList)
      continue;
    if (question.multiSelect === true) {
      if (meta.autoAppendOnMultiSelect)
        out.push(k);
    } else {
      if (meta.autoAppendOnSingleSelect)
        out.push(k);
    }
  }
  return out;
}

// state/i18n-bridge.ts
var I18N_NAMESPACE = "@juicesharp/rpiv-ask-user-question";
var scopeImpl;
try {
  const sdk = await import("@juicesharp/rpiv-i18n");
  scopeImpl = sdk.scope(I18N_NAMESPACE);
} catch {
  scopeImpl = (_key, fallback) => fallback;
}
var t = scopeImpl;
function displayLabel(kind) {
  return t(`sentinel.${kind}`, ROW_INTENT_META[kind].label);
}

// tool/format-answer.ts
var NO_INPUT_PLACEHOLDER = "(no input)";
function formatAnswerScalar(a, _variant) {
  switch (a.kind) {
    case "multi": {
      const parts = [...a.selected ?? []];
      if (a.answer && a.answer.length > 0)
        parts.push(a.answer);
      return parts.length > 0 ? parts.join(", ") : NO_INPUT_PLACEHOLDER;
    }
    case "custom":
      return a.answer && a.answer.length > 0 ? a.answer : NO_INPUT_PLACEHOLDER;
    case "option":
      return a.answer ?? NO_INPUT_PLACEHOLDER;
  }
}

// view/components/preview/preview-box-renderer.ts
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
var ANSI_SGR_RE = /\x1b\[[0-9;]*m/g;
var ANSI_OSC8_RE = /\x1b\]8;[^\x07\x1b]*(?:\x07|\x1b\\)/g;
var FENCE_MARKER_RE = /^`{3}/;
var BORDER_VERTICAL_OVERHEAD = 2;
var BORDER_HORIZONTAL_OVERHEAD = 2;
var BORDER_INNER_PADDING_HORIZONTAL = 1;
var BOX_MIN_CONTENT_WIDTH = 40;
function stripFenceMarkers(lines) {
  return lines.filter((line) => {
    const clean = line.replace(ANSI_SGR_RE, "").replace(ANSI_OSC8_RE, "");
    return !FENCE_MARKER_RE.test(clean);
  });
}
function renderBorderedBox(lines, width, colorFn, hidden = 0) {
  const dashSpan = Math.max(1, width - BORDER_HORIZONTAL_OVERHEAD);
  const contentInner = Math.max(1, dashSpan - 2 * BORDER_INNER_PADDING_HORIZONTAL);
  const pad = " ".repeat(BORDER_INNER_PADDING_HORIZONTAL);
  const top = colorFn(`┌${"─".repeat(dashSpan)}┐`);
  const out = [top];
  for (const line of lines) {
    const padded = truncateToWidth(line, contentInner, "", true);
    out.push(`${colorFn("│")}${pad}${padded}${pad}${colorFn("│")}`);
  }
  if (hidden > 0) {
    const indicator = ` ✂ ── ${hidden} lines hidden ── `;
    const space = dashSpan - indicator.length;
    const leftFill = "─".repeat(Math.max(0, Math.floor(space / 2)));
    const rightFill = "─".repeat(Math.max(0, dashSpan - leftFill.length - indicator.length));
    out.push(colorFn(`└${leftFill}${indicator}${rightFill}┘`));
  } else {
    out.push(colorFn(`└${"─".repeat(dashSpan)}┘`));
  }
  return out;
}
function computeBoxDimensions(contentLines, maxInnerWidth) {
  let widest = Math.min(BOX_MIN_CONTENT_WIDTH, maxInnerWidth);
  for (const line of contentLines) {
    const w = visibleWidth(line.replace(/\s+$/, ""));
    if (w > widest)
      widest = w;
  }
  const innerWidth = Math.min(widest, maxInnerWidth);
  const boxWidth = innerWidth + BORDER_HORIZONTAL_OVERHEAD + 2 * BORDER_INNER_PADDING_HORIZONTAL;
  return { innerWidth, boxWidth };
}

export { validateGuidanceFields, DEFAULT_COLLAPSE_KEY, COLLAPSE_KEY_OFF, DEFAULT_NOTES_KEY, KEY_PLACEHOLDER, resolveCollapseKey, resolveNotesKey, formatNotesKeyForDisplay, formatKeySpecForDisplay, loadConfig, ROW_INTENT_META, sentinelsToAppend, I18N_NAMESPACE, t, displayLabel, NO_INPUT_PLACEHOLDER, formatAnswerScalar, BORDER_VERTICAL_OVERHEAD, BORDER_HORIZONTAL_OVERHEAD, BORDER_INNER_PADDING_HORIZONTAL, stripFenceMarkers, renderBorderedBox, computeBoxDimensions };
