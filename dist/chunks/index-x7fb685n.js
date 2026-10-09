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

export { validateGuidanceFields, DEFAULT_COLLAPSE_KEY, COLLAPSE_KEY_OFF, resolveCollapseKey, formatKeySpecForDisplay, loadConfig, ROW_INTENT_META, sentinelsToAppend, I18N_NAMESPACE, t, displayLabel, formatAnswerScalar };
