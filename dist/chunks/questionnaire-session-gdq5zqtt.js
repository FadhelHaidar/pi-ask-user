import {
  DEFAULT_COLLAPSE_KEY,
  COLLAPSE_KEY_OFF,
  formatKeySpecForDisplay,
  ROW_INTENT_META,
  t,
  displayLabel,
  formatAnswerScalar
} from "./index-x7fb685n.js";

// view/dialog-builder.ts
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container as Container2, Spacer as Spacer2 } from "@earendil-works/pi-tui";

// view/tab-content-strategy.ts
import { Container, Spacer, Text, truncateToWidth } from "@earendil-works/pi-tui";
var NOTES_HEADER = "Notes:";
var GLOBAL_NOTES_HEADER = "Global note:";
var REVIEW_GLOBAL_HINT = "n to add a note";
var REVIEW_NOTE_LABEL = "Note";

class OneLineClippedText {
  text;
  paddingLeft;
  constructor(text, paddingLeft = 0) {
    this.text = text;
    this.paddingLeft = paddingLeft;
  }
  render(width) {
    const pad = " ".repeat(this.paddingLeft);
    const avail = Math.max(0, width - this.paddingLeft);
    return [pad + truncateToWidth(this.text, avail, "…", false)];
  }
  invalidate() {}
  handleInput(_data) {}
}

class QuestionTabStrategy {
  config;
  footerRowCount = 2;
  constructor(config) {
    this.config = config;
  }
  headingRows(state) {
    const out = [];
    const question = this.config.questions[state.currentTab];
    if (!this.config.isMulti && question?.header && question.header.length > 0) {
      out.push(new Text(this.config.theme.bg("selectedBg", ` ${question.header} `), 1, 0));
      out.push(new Spacer(1));
    }
    if (question) {
      out.push(new Text(this.config.theme.bold(question.question), 1, 0));
      out.push(new Spacer(1));
    }
    return out;
  }
  bodyComponent(state) {
    const question = this.config.questions[state.currentTab];
    const mso = this.config.tabsByIndex[state.currentTab]?.multiSelect;
    if (question?.multiSelect === true && mso)
      return mso;
    return this.config.getPreviewPane();
  }
  bodyHeight(width, _state) {
    return this.config.getCurrentBodyHeight(width);
  }
  midRows(state) {
    if (!state.notesVisible)
      return [];
    return [
      new Text(this.config.theme.fg("muted", t("notes.header", NOTES_HEADER)), 1, 0),
      this.config.notesInput,
      new Spacer(1)
    ];
  }
  footerRows(state) {
    const question = this.config.questions[state.currentTab];
    return [
      new Spacer(1),
      new OneLineClippedText(this.config.theme.fg("dim", buildHintText(question, this.config.isMulti, state, this.config.collapseKey)), 1)
    ];
  }
  focusedItemRowRange(width, state) {
    const question = this.config.questions[state.currentTab];
    const mso = this.config.tabsByIndex[state.currentTab]?.multiSelect;
    if (question?.multiSelect === true && mso)
      return mso.focusedItemRowRange(width);
    return this.config.getPreviewPane().focusedItemRowRange(width);
  }
}

class SubmitTabStrategy {
  config;
  footerRowCount = 5;
  constructor(config) {
    this.config = config;
  }
  headingRows(_state) {
    return [
      new Text(this.config.theme.bold(this.config.theme.fg("accent", t("review.heading", REVIEW_HEADING))), 1, 0),
      new Spacer(1)
    ];
  }
  bodyComponent(state) {
    const c = new Container;
    for (let i = 0;i < this.config.questions.length; i++) {
      const q = this.config.questions[i];
      const a = state.answers.get(i);
      if (!a)
        continue;
      const label = q.header && q.header.length > 0 ? q.header : `Q${i + 1}`;
      const answerText = formatAnswerScalar(a, "summary");
      c.addChild(new Text(this.config.theme.fg("muted", ` ● ${label}`), 1, 0));
      c.addChild(new Text(`   ${this.config.theme.fg("muted", "→")} ${this.config.theme.fg("text", answerText)}`, 1, 0));
      if (a.notes && a.notes.length > 0) {
        c.addChild(new Text(this.config.theme.fg("dim", `     notes: ${a.notes}`), 1, 0));
      }
    }
    const globalNote = state.notesByTab.get(this.config.questions.length);
    if (!state.notesVisible && globalNote && globalNote.length > 0) {
      c.addChild(new Text(this.config.theme.fg("muted", ` ● ${t("review.note_label", REVIEW_NOTE_LABEL)}`), 1, 0));
      c.addChild(new Text(`   ${this.config.theme.fg("muted", "→")} ${this.config.theme.fg("text", globalNote)}`, 1, 0));
    }
    return c;
  }
  bodyHeight(width, state) {
    return this.bodyComponent(state).render(width).length;
  }
  midRows(state) {
    if (!state.notesVisible)
      return [];
    return [
      new Text(this.config.theme.fg("muted", t("notes.global_header", GLOBAL_NOTES_HEADER)), 1, 0),
      this.config.notesInput,
      new Spacer(1)
    ];
  }
  footerRows(state) {
    const missing = [];
    for (let i = 0;i < this.config.questions.length; i++) {
      const q = this.config.questions[i];
      if (!state.answers.has(i)) {
        missing.push(q.header && q.header.length > 0 ? q.header : `Q${i + 1}`);
      }
    }
    const promptText = missing.length === 0 ? this.config.theme.fg("muted", t("review.ready", READY_PROMPT)) : this.config.theme.fg("warning", `${t("review.incomplete", INCOMPLETE_WARNING_PREFIX)} ${missing.join(", ")}`);
    const out = [new Spacer(1), new Text(promptText, 1, 0)];
    if (this.config.submitPicker) {
      out.push(this.config.submitPicker);
    } else {
      out.push(new Spacer(1));
      out.push(new Spacer(1));
    }
    out.push(new OneLineClippedText(this.config.theme.fg("dim", buildSubmitHintText(state)), 1));
    return out;
  }
  focusedItemRowRange(_width, _state) {
    return;
  }
}
function buildHintText(question, isMulti, state, collapseKey) {
  const enterHint = question?.multiSelect === true && !state.notesVisible ? t("hint.enter_toggle", HINT_PART_TOGGLE) : t("hint.enter", HINT_PART_ENTER);
  const parts = [enterHint, t("hint.navigate", HINT_PART_NAV)];
  if (question && !state.notesVisible && !state.inputMode)
    parts.push(t("hint.notes", HINT_PART_NOTES));
  if (isMulti)
    parts.push(t("hint.tab", HINT_PART_TAB));
  parts.push(t("hint.cancel", HINT_PART_CANCEL));
  if (collapseKey !== COLLAPSE_KEY_OFF) {
    parts.push(t("hint.collapse", HINT_PART_COLLAPSE_TEMPLATE).replace(KEY_PLACEHOLDER, formatKeySpecForDisplay(collapseKey)));
  }
  if (state.notesVisible || state.inputMode)
    parts.push(t("hint.newline", HINT_PART_NEW_LINE));
  if (state.inputMode)
    parts.push(t("hint.clear", HINT_PART_CLEAR));
  return parts.join(" · ");
}
function buildSubmitHintText(state) {
  const parts = [t("hint.enter", HINT_PART_ENTER), t("hint.navigate", HINT_PART_NAV)];
  if (!state.notesVisible)
    parts.push(t("review.global_hint", REVIEW_GLOBAL_HINT));
  parts.push(t("hint.cancel", HINT_PART_CANCEL));
  if (state.notesVisible)
    parts.push(t("hint.newline", HINT_PART_NEW_LINE));
  return parts.join(" · ");
}

// view/dialog-builder.ts
var HINT_PART_ENTER = "Enter to select";
var HINT_PART_NAV = "↑/↓ to navigate";
var HINT_PART_NEW_LINE = "Shift+Enter for newline";
var HINT_PART_CLEAR = "Ctrl+U to clear";
var HINT_PART_TOGGLE = "Enter to toggle";
var HINT_PART_NOTES = "n to add notes";
var HINT_PART_TAB = "Tab to switch questions";
var HINT_PART_CANCEL = "Esc to cancel";
var KEY_PLACEHOLDER = "{key}";
var HINT_PART_COLLAPSE_TEMPLATE = `${KEY_PLACEHOLDER} to collapse`;
var HINT_PART_EXPAND_TEMPLATE = `${KEY_PLACEHOLDER} to expand`;
var HINT_PART_COLLAPSE = HINT_PART_COLLAPSE_TEMPLATE.replace(KEY_PLACEHOLDER, formatKeySpecForDisplay(DEFAULT_COLLAPSE_KEY));
var HINT_SINGLE = [HINT_PART_ENTER, HINT_PART_NAV, HINT_PART_NOTES, HINT_PART_CANCEL].join(" · ");
var HINT_MULTI = [HINT_PART_ENTER, HINT_PART_NAV, HINT_PART_NOTES, HINT_PART_TAB, HINT_PART_CANCEL].join(" · ");
var COLLAPSED_HINT_TEMPLATE = [HINT_PART_EXPAND_TEMPLATE, HINT_PART_CANCEL].join(" · ");
var REVIEW_HEADING = "Review your answers";
var READY_PROMPT = "Ready to submit your answers?";
var INCOMPLETE_WARNING_PREFIX = "⚠ Answer remaining questions before submitting:";
var OVERFLOW_UP = "↑";
var OVERFLOW_DOWN = "↓";
var OVERFLOW_BOTH = "↕";
function renderFitsTerminal(natural, spacerRows) {
  return spacerRows > 0 ? [...natural, ...Array(spacerRows).fill("")] : natural;
}
function renderChromeOnly(natural, topFixed, bottomFixed, termRows) {
  const chromeOnly = [...natural.slice(0, topFixed), ...natural.slice(natural.length - bottomFixed)];
  return chromeOnly.length > termRows ? chromeOnly.slice(0, termRows) : chromeOnly;
}
function computeScrollStart(bodyRange, headingCount, availableMiddle, middleRows) {
  if (!bodyRange)
    return 0;
  const focusedRowInMiddle = headingCount + bodyRange[0];
  const focusedHeight = bodyRange[1] - bodyRange[0];
  const idealStart = focusedRowInMiddle - Math.floor(Math.max(0, availableMiddle - focusedHeight) / 2);
  return Math.max(0, Math.min(idealStart, middleRows - availableMiddle));
}
function decorateOverflow(scrollableMiddle, hasUp, hasDown, theme) {
  if (hasUp && hasDown && scrollableMiddle.length === 1) {
    scrollableMiddle[0] = theme.fg("dim", OVERFLOW_BOTH);
    return;
  }
  if (hasUp && scrollableMiddle.length > 0) {
    scrollableMiddle[0] = theme.fg("dim", OVERFLOW_UP);
  }
  if (hasDown && scrollableMiddle.length > 0) {
    scrollableMiddle[scrollableMiddle.length - 1] = theme.fg("dim", OVERFLOW_DOWN);
  }
}

class DialogView {
  liveProps;
  config;
  questionStrategy;
  submitStrategy;
  maxFooterRowCount;
  constructor(config, initialProps) {
    this.config = config;
    this.liveProps = initialProps;
    this.questionStrategy = new QuestionTabStrategy({
      theme: config.theme,
      questions: config.questions,
      getPreviewPane: () => this.liveProps.activePreviewPane,
      tabsByIndex: config.tabsByIndex,
      notesInput: config.notesInput,
      isMulti: config.isMulti,
      getCurrentBodyHeight: config.getCurrentBodyHeight,
      collapseKey: config.collapseKey
    });
    this.submitStrategy = config.isMulti ? new SubmitTabStrategy({
      theme: config.theme,
      questions: config.questions,
      submitPicker: config.submitPicker,
      notesInput: config.notesInput
    }) : undefined;
    this.maxFooterRowCount = Math.max(this.questionStrategy.footerRowCount, this.submitStrategy?.footerRowCount ?? 0);
  }
  setProps(props) {
    this.liveProps = props;
  }
  handleInput(_data) {}
  invalidate() {}
  render(width) {
    const state = this.liveProps.state;
    const onSubmit = this.config.isMulti && state.currentTab === this.config.questions.length;
    const strategy = onSubmit && this.submitStrategy ? this.submitStrategy : this.questionStrategy;
    const headingRowCache = strategy.headingRows(state);
    const headingCount = headingRowCache.length;
    const natural = this.buildContainerFromStrategy(strategy, headingRowCache).render(width);
    const topFixed = 1 + (this.config.isMulti && this.config.tabBar ? 2 : 0) + 1;
    const bottomFixed = 1 + strategy.footerRowCount;
    const middleRows = natural.length - topFixed - bottomFixed;
    const spacerRows = Math.max(0, this.config.getBodyHeight(width) + this.maxFooterRowCount - strategy.bodyHeight(width, state) - strategy.footerRowCount);
    const termRows = this.config.getTerminalRows();
    if (natural.length + spacerRows <= termRows) {
      return renderFitsTerminal(natural, spacerRows);
    }
    const availableMiddle = Math.max(0, termRows - topFixed - bottomFixed);
    if (availableMiddle === 0) {
      return renderChromeOnly(natural, topFixed, bottomFixed, termRows);
    }
    const scrollStart = computeScrollStart(strategy.focusedItemRowRange(width, state), headingCount, availableMiddle, middleRows);
    const scrollableMiddle = natural.slice(topFixed + scrollStart, topFixed + scrollStart + availableMiddle);
    decorateOverflow(scrollableMiddle, scrollStart > 0, scrollStart + availableMiddle < middleRows, this.config.theme);
    const result = [
      ...natural.slice(0, topFixed),
      ...scrollableMiddle,
      ...natural.slice(natural.length - bottomFixed)
    ];
    return result.length > termRows ? result.slice(0, termRows) : result;
  }
  buildContainerFromStrategy(strategy, headingRowCache) {
    const { theme, isMulti, tabBar } = this.config;
    const state = this.liveProps.state;
    const container = new Container2;
    const border = () => new DynamicBorder((s) => theme.fg("accent", s));
    container.addChild(border());
    if (isMulti && tabBar)
      container.addChild(tabBar);
    container.addChild(new Spacer2(1));
    for (const c of headingRowCache)
      container.addChild(c);
    container.addChild(strategy.bodyComponent(state));
    container.addChild(new Spacer2(1));
    for (const c of strategy.midRows(state))
      container.addChild(c);
    container.addChild(border());
    for (const c of strategy.footerRows(state))
      container.addChild(c);
    return container;
  }
}

// state/build-questionnaire.ts
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Editor } from "@earendil-works/pi-tui";

// view/component-binding.ts
function globalBinding(spec) {
  return {
    apply: (state, ctx) => spec.component.setProps(spec.select(state, ctx)),
    invalidate: () => spec.component.invalidate()
  };
}
function perTabBinding(spec) {
  return {
    apply: (state, ctx) => {
      if (spec.predicate && !spec.predicate(state, ctx))
        return;
      spec.resolve(ctx.tab)?.setProps(spec.select(state, ctx));
    }
  };
}

// view/components/multi-select-view.ts
import { truncateToWidth as truncateToWidth2, visibleWidth, wrapTextWithAnsi as wrapTextWithAnsi2 } from "@earendil-works/pi-tui";

// view/components/inline-input.ts
import { CURSOR_MARKER, wrapTextWithAnsi } from "@earendil-works/pi-tui";
var graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function resolveCursorOffset(buffer, requested) {
  if (requested !== undefined && requested >= 0 && requested <= buffer.length)
    return requested;
  return buffer.length;
}
function buildCursorRaw(buffer, offset) {
  const before = buffer.slice(0, offset);
  const [firstGrapheme] = graphemeSegmenter.segment(buffer.slice(offset));
  const rawAt = firstGrapheme ? firstGrapheme.segment : "";
  const cursorAtLineEnd = rawAt === `
`;
  const atCursor = rawAt === "" || rawAt === " " || cursorAtLineEnd ? " " : rawAt;
  const after = buffer.slice(offset + (cursorAtLineEnd ? 0 : rawAt.length));
  return `${before}${CURSOR_MARKER}\x1B[7m${atCursor}\x1B[27m${after}`;
}
function renderInlineInputRow(opts) {
  const { buffer, cursorOffset, rowPrefix, continuationPrefix, contentWidth, selectedText } = opts;
  const raw = buildCursorRaw(buffer, resolveCursorOffset(buffer, cursorOffset));
  return wrapTextWithAnsi(raw, contentWidth).map((segment, index) => {
    const prefix = index === 0 ? rowPrefix : continuationPrefix;
    return selectedText(`${prefix}${segment}`);
  });
}

// view/components/multi-select-view.ts
var ACTIVE_POINTER = "❯ ";
var INACTIVE_POINTER = "  ";
var CHECKED = "[✔]";
var UNCHECKED = "[ ]";
var NUMBER_SEPARATOR = ". ";
var BOX_LABEL_GAP = " ";
var CONTINUATION_INDENT = "  ";
var MULTI_SUBMIT_LABEL = "Submit";

class MultiSelectView {
  theme;
  question;
  props;
  cachedLayout;
  constructor(theme, question) {
    this.theme = theme;
    this.question = question;
    this.props = {
      rows: [],
      other: { active: false, inputMode: false, inputBuffer: "", inputCursorOffset: undefined },
      nextActive: false,
      nextLabel: displayLabel("next")
    };
  }
  setProps(props) {
    this.props = props;
    this.cachedLayout = undefined;
  }
  handleInput(_data) {}
  invalidate() {
    this.cachedLayout = undefined;
  }
  render(width) {
    return this.layout(width).lines;
  }
  focusedItemRowRange(width) {
    return this.layout(width).focusedRange;
  }
  naturalHeight(width) {
    return this.layout(width).lines.length;
  }
  layout(width) {
    if (this.cachedLayout?.width === width)
      return this.cachedLayout.value;
    const build = { lines: [], focusedRange: [0, 0] };
    const contentWidth = Math.max(1, width - this.prefixVisibleWidth());
    const numberWidth = String(Math.max(1, this.question.options.length + 1)).length;
    this.appendOptionRows(build, width, contentWidth, numberWidth);
    const otherStart = build.lines.length;
    build.lines.push(...this.renderOtherRow(contentWidth, numberWidth));
    if (this.props.other.active)
      build.focusedRange = [otherStart, build.lines.length];
    this.appendNextRow(build, width);
    const value = { lines: build.lines, focusedRange: build.focusedRange };
    this.cachedLayout = { width, value };
    return value;
  }
  appendOptionRows(build, width, contentWidth, numberWidth) {
    for (let i = 0;i < this.question.options.length; i++) {
      const opt = this.question.options[i];
      const row = this.props.rows[i];
      if (!opt || !row)
        continue;
      const start = build.lines.length;
      const pointer = row.active ? this.theme.fg("accent", ACTIVE_POINTER) : INACTIVE_POINTER;
      const box = row.checked ? this.theme.fg("accent", CHECKED) : this.theme.fg("muted", UNCHECKED);
      const label = truncateToWidth2(opt.label, contentWidth, "…");
      const styledLabel = row.active ? this.theme.fg("accent", this.theme.bold(label)) : label;
      const number = String(i + 1).padStart(numberWidth, " ");
      build.lines.push(truncateToWidth2(`${pointer}${number}${NUMBER_SEPARATOR}${box}${BOX_LABEL_GAP}${styledLabel}`, width, ""));
      if (opt.description) {
        for (const segment of wrapTextWithAnsi2(opt.description, contentWidth)) {
          build.lines.push(CONTINUATION_INDENT + this.theme.fg("muted", segment));
        }
      }
      if (row.active)
        build.focusedRange = [start, build.lines.length];
    }
  }
  appendNextRow(build, width) {
    const nextStart = build.lines.length;
    const nextPointer = this.props.nextActive ? this.theme.fg("accent", ACTIVE_POINTER) : INACTIVE_POINTER;
    const nextLabel = this.props.nextActive ? this.theme.fg("accent", this.theme.bold(this.props.nextLabel)) : this.props.nextLabel;
    build.lines.push(truncateToWidth2(`${nextPointer}${nextLabel}`, width, ""));
    if (this.props.nextActive)
      build.focusedRange = [nextStart, build.lines.length];
  }
  renderOtherRow(contentWidth, numberWidth) {
    const other = this.props.other;
    const pointer = other.active ? this.theme.fg("accent", ACTIVE_POINTER) : INACTIVE_POINTER;
    const box = other.checked ? this.theme.fg("accent", CHECKED) : this.theme.fg("muted", UNCHECKED);
    const number = String(this.question.options.length + 1).padStart(numberWidth, " ");
    const rowPrefix = `${pointer}${number}${NUMBER_SEPARATOR}${box}${BOX_LABEL_GAP}`;
    const continuationPrefix = " ".repeat(visibleWidth(rowPrefix));
    const selectedText = (text) => this.theme.fg("accent", this.theme.bold(text));
    if (other.active && other.inputMode) {
      return renderInlineInputRow({
        buffer: other.inputBuffer,
        cursorOffset: other.inputCursorOffset,
        rowPrefix,
        continuationPrefix,
        contentWidth,
        selectedText
      });
    }
    return wrapTextWithAnsi2(other.inputBuffer || displayLabel("other"), contentWidth).map((segment, index) => {
      const line = `${index === 0 ? rowPrefix : continuationPrefix}${segment}`;
      return other.active ? selectedText(line) : line;
    });
  }
  prefixVisibleWidth() {
    const numberWidth = String(Math.max(1, this.question.options.length + 1)).length;
    return visibleWidth(INACTIVE_POINTER) + numberWidth + visibleWidth(`${NUMBER_SEPARATOR}${UNCHECKED}${BOX_LABEL_GAP}`);
  }
}

// view/components/wrapping-select.ts
import { visibleWidth as visibleWidth2, wrapTextWithAnsi as wrapTextWithAnsi3 } from "@earendil-works/pi-tui";
class WrappingSelect {
  static ACTIVE_POINTER = "❯ ";
  static INACTIVE_POINTER = "  ";
  static NUMBER_SEPARATOR = ". ";
  static CONFIRMED_MARK = " ✔";
  static MIN_CONTENT_WIDTH = 1;
  items;
  maxVisible;
  theme;
  numberStartOffset;
  totalItemsForNumbering;
  selectedIndex = 0;
  focused = true;
  inputBuffer = "";
  inputCursorOffset = undefined;
  confirmedIndex = undefined;
  confirmedLabelOverride = undefined;
  constructor(items, maxVisible, theme, options = {}) {
    this.items = items;
    this.maxVisible = Math.max(1, maxVisible);
    this.theme = theme;
    this.numberStartOffset = options.numberStartOffset ?? 0;
    this.totalItemsForNumbering = options.totalItemsForNumbering ?? items.length;
  }
  setNumbering(numberStartOffset, totalItemsForNumbering) {
    this.numberStartOffset = numberStartOffset;
    this.totalItemsForNumbering = Math.max(1, totalItemsForNumbering);
  }
  setSelectedIndex(index) {
    this.selectedIndex = Math.max(0, Math.min(index, this.items.length - 1));
  }
  setFocused(focused) {
    this.focused = focused;
  }
  setConfirmedIndex(index, labelOverride) {
    if (index === undefined) {
      this.confirmedIndex = undefined;
      this.confirmedLabelOverride = undefined;
      return;
    }
    this.confirmedIndex = Math.max(0, Math.min(index, this.items.length - 1));
    this.confirmedLabelOverride = labelOverride;
  }
  setInputBuffer(text) {
    this.inputBuffer = text;
  }
  setInputCursorOffset(offset) {
    this.inputCursorOffset = offset;
  }
  handleInput(_data) {}
  invalidate() {}
  render(width) {
    if (this.items.length === 0)
      return [];
    const { startIndex, endIndex } = this.computeVisibleWindow();
    const numberWidth = String(Math.max(1, this.totalItemsForNumbering)).length;
    const lines = [];
    for (let i = startIndex;i < endIndex; i++) {
      const item = this.items[i];
      if (!item)
        continue;
      const isActive = i === this.selectedIndex && this.focused;
      lines.push(...this.renderItem(item, i, isActive, width, numberWidth));
    }
    if (this.hasItemsOutsideWindow(startIndex, endIndex)) {
      lines.push(this.theme.scrollInfo(`  (${this.selectedIndex + 1}/${this.items.length})`));
    }
    return lines;
  }
  focusedItemRowRange(width) {
    if (this.items.length === 0)
      return [0, 0];
    const { startIndex, endIndex } = this.computeVisibleWindow();
    const numberWidth = String(Math.max(1, this.totalItemsForNumbering)).length;
    let row = 0;
    for (let i = startIndex;i < endIndex; i++) {
      const item = this.items[i];
      if (!item)
        continue;
      const isActive = i === this.selectedIndex && this.focused;
      const itemRowCount = this.computeItemRowCount(item, i, isActive, width, numberWidth);
      if (i === this.selectedIndex) {
        return [row, row + itemRowCount];
      }
      row += itemRowCount;
    }
    return [0, 1];
  }
  computeItemRowCount(item, index, isActive, width, numberWidth) {
    return this.renderItem(item, index, isActive, width, numberWidth).length;
  }
  computeVisibleWindow() {
    const half = Math.floor(this.maxVisible / 2);
    const startIndex = Math.max(0, Math.min(this.selectedIndex - half, this.items.length - this.maxVisible));
    const endIndex = Math.min(startIndex + this.maxVisible, this.items.length);
    return { startIndex, endIndex };
  }
  hasItemsOutsideWindow(startIndex, endIndex) {
    return startIndex > 0 || endIndex < this.items.length;
  }
  renderItem(item, index, isActive, width, numberWidth) {
    const rowPrefix = this.buildRowPrefix(index, isActive, numberWidth);
    const continuationPrefix = " ".repeat(visibleWidth2(rowPrefix));
    const contentWidth = Math.max(WrappingSelect.MIN_CONTENT_WIDTH, width - visibleWidth2(rowPrefix));
    if (this.shouldRenderAsInlineInput(item, isActive)) {
      return this.renderInlineInputRow(rowPrefix, continuationPrefix, contentWidth);
    }
    const { label, isConfirmed } = this.deriveConfirmedState(item, index);
    const applySelectedStyle = isActive || isConfirmed;
    return [
      ...this.renderLabelBlock(label, rowPrefix, continuationPrefix, contentWidth, applySelectedStyle),
      ...this.renderDescriptionBlock(item.description, continuationPrefix, contentWidth)
    ];
  }
  deriveConfirmedState(item, index) {
    const customDraft = item.kind === "other" ? this.inputBuffer : undefined;
    const customDraftDiffersFromConfirmed = item.kind === "other" && customDraft !== "" && index === this.confirmedIndex && customDraft !== (this.confirmedLabelOverride ?? "");
    const isConfirmed = index === this.confirmedIndex && !customDraftDiffersFromConfirmed;
    const baseLabel = customDraft ? customDraft : item.label;
    const label = isConfirmed ? `${this.confirmedLabelOverride ?? baseLabel}${WrappingSelect.CONFIRMED_MARK}` : baseLabel;
    return { label, isConfirmed };
  }
  buildRowPrefix(index, isActive, numberWidth) {
    const pointer = isActive ? WrappingSelect.ACTIVE_POINTER : WrappingSelect.INACTIVE_POINTER;
    const displayNumber = this.numberStartOffset + index + 1;
    const paddedNumber = String(displayNumber).padStart(numberWidth, " ");
    return `${pointer}${paddedNumber}${WrappingSelect.NUMBER_SEPARATOR}`;
  }
  shouldRenderAsInlineInput(item, isActive) {
    return item.kind === "other" && isActive;
  }
  renderInlineInputRow(rowPrefix, continuationPrefix, contentWidth) {
    return renderInlineInputRow({
      buffer: this.inputBuffer,
      cursorOffset: this.inputCursorOffset,
      rowPrefix,
      continuationPrefix,
      contentWidth,
      selectedText: this.theme.selectedText
    });
  }
  renderLabelBlock(label, rowPrefix, continuationPrefix, contentWidth, applySelectedStyle) {
    const wrapped = wrapTextWithAnsi3(label, contentWidth);
    return wrapped.map((segment, index) => {
      const prefix = index === 0 ? rowPrefix : continuationPrefix;
      const line = `${prefix}${segment}`;
      return applySelectedStyle ? this.theme.selectedText(line) : line;
    });
  }
  renderDescriptionBlock(description, continuationPrefix, contentWidth) {
    if (!description)
      return [];
    const wrapped = wrapTextWithAnsi3(description, contentWidth);
    return wrapped.map((segment) => `${continuationPrefix}${this.theme.description(segment)}`);
  }
}

// view/components/option-list-view.ts
var MAX_VISIBLE_OPTIONS = 10;

class OptionListView {
  select;
  constructor(config) {
    this.select = new WrappingSelect(config.items, Math.min(config.items.length, MAX_VISIBLE_OPTIONS), config.theme, {
      numberStartOffset: 0,
      totalItemsForNumbering: config.items.length
    });
  }
  setProps(props) {
    this.select.setSelectedIndex(props.selectedIndex);
    this.select.setFocused(props.focused);
    this.select.setConfirmedIndex(props.confirmed?.index, props.confirmed?.labelOverride);
    this.select.setInputBuffer(props.inputBuffer);
    this.select.setInputCursorOffset(props.inputCursorOffset);
  }
  handleInput(_data) {}
  invalidate() {
    this.select.invalidate();
  }
  render(width) {
    return this.select.render(width);
  }
  focusedItemRowRange(width) {
    return this.select.focusedItemRowRange(width);
  }
}

// view/components/preview/markdown-content-cache.ts
import { Markdown, visibleWidth as visibleWidth4 } from "@earendil-works/pi-tui";

// view/components/preview/preview-box-renderer.ts
import { truncateToWidth as truncateToWidth3, visibleWidth as visibleWidth3 } from "@earendil-works/pi-tui";
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
    const padded = truncateToWidth3(line, contentInner, "", true);
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
    const w = visibleWidth3(line.replace(/\s+$/, ""));
    if (w > widest)
      widest = w;
  }
  const innerWidth = Math.min(widest, maxInnerWidth);
  const boxWidth = innerWidth + BORDER_HORIZONTAL_OVERHEAD + 2 * BORDER_INNER_PADDING_HORIZONTAL;
  return { innerWidth, boxWidth };
}

// view/components/preview/markdown-content-cache.ts
var MAX_PREVIEW_HEIGHT_SIDE_BY_SIDE = 20;
var MAX_PREVIEW_HEIGHT_STACKED = 15;
var NO_PREVIEW_TEXT = "No preview available";
var NOTES_AFFORDANCE_OVERHEAD = 2;

class MarkdownContentCache {
  previewTexts;
  markdownCache;
  cachedWidth;
  theme;
  markdownTheme;
  constructor(question, theme, markdownTheme) {
    this.theme = theme;
    this.markdownTheme = markdownTheme;
    this.previewTexts = new Map;
    for (let i = 0;i < question.options.length; i++) {
      const raw = question.options[i]?.preview;
      if (raw && raw.length > 0)
        this.previewTexts.set(i, raw);
    }
    this.markdownCache = new Map;
  }
  hasAnyPreview() {
    return this.previewTexts.size > 0;
  }
  has(optionIndex) {
    return this.previewTexts.has(optionIndex);
  }
  bodyFor(optionIndex, innerWidth) {
    if (this.cachedWidth !== innerWidth) {
      for (const md of this.markdownCache.values())
        md.invalidate();
      this.cachedWidth = innerWidth;
    }
    const text = this.previewTexts.get(optionIndex);
    if (!text) {
      const placeholder = this.theme.fg("dim", t("preview.no_preview", NO_PREVIEW_TEXT));
      const pad = Math.max(0, innerWidth - visibleWidth4(placeholder));
      return [placeholder + " ".repeat(pad)];
    }
    let md = this.markdownCache.get(optionIndex);
    if (!md) {
      md = new Markdown(text, 0, 0, this.markdownTheme);
      this.markdownCache.set(optionIndex, md);
    }
    return stripFenceMarkers(md.render(innerWidth));
  }
  invalidate() {
    for (const md of this.markdownCache.values())
      md.invalidate();
    this.cachedWidth = undefined;
  }
}

// view/components/preview/preview-block-renderer.ts
var NOTES_AFFORDANCE_TEXT = "Notes: press n to add notes";
function contentBudgetFor(mode) {
  const cap = mode === "side-by-side" ? MAX_PREVIEW_HEIGHT_SIDE_BY_SIDE : MAX_PREVIEW_HEIGHT_STACKED;
  return Math.max(1, cap - BORDER_VERTICAL_OVERHEAD - NOTES_AFFORDANCE_OVERHEAD);
}
function innerWidthFor(width) {
  return Math.max(1, width - BORDER_HORIZONTAL_OVERHEAD - 2 * BORDER_INNER_PADDING_HORIZONTAL);
}

class PreviewBlockRenderer {
  theme;
  cache;
  constructor(config) {
    this.theme = config.theme;
    this.cache = new MarkdownContentCache(config.question, config.theme, config.markdownTheme);
  }
  hasAnyPreview() {
    return this.cache.hasAnyPreview();
  }
  has(optionIndex) {
    return this.cache.has(optionIndex);
  }
  invalidate() {
    this.cache.invalidate();
  }
  blockHeight(width, optionIndex, mode) {
    const contentBudget = contentBudgetFor(mode);
    const innerWidth = innerWidthFor(width);
    const rawRows = this.cache.bodyFor(optionIndex, innerWidth).length;
    const contentRows = Math.min(rawRows, contentBudget);
    return BORDER_VERTICAL_OVERHEAD + contentRows + NOTES_AFFORDANCE_OVERHEAD;
  }
  renderBlock(width, optionIndex, mode, focused, notesVisible) {
    const contentBudget = contentBudgetFor(mode);
    const maxInnerWidth = innerWidthFor(width);
    const raw = this.cache.bodyFor(optionIndex, maxInnerWidth);
    const truncated = raw.length > contentBudget;
    const hidden = truncated ? raw.length - contentBudget : 0;
    const contentLines = truncated ? raw.slice(0, contentBudget) : raw;
    const { boxWidth } = computeBoxDimensions(contentLines, maxInnerWidth);
    const colorFn = (s) => this.theme.fg("accent", s);
    const boxedLines = renderBorderedBox(contentLines, boxWidth, colorFn, hidden);
    const showAffordance = focused && !notesVisible && this.cache.has(optionIndex);
    const affordance = showAffordance ? this.theme.fg("muted", t("preview.notes_affordance", NOTES_AFFORDANCE_TEXT)) : "";
    return [...boxedLines, "", affordance];
  }
}

// view/components/preview/preview-layout-decider.ts
import { visibleWidth as visibleWidth5 } from "@earendil-works/pi-tui";
var PREVIEW_MIN_WIDTH = 100;
var PREVIEW_COLUMN_GAP = 2;
var PREVIEW_PADDING_LEFT = 1;
var STACKED_GAP_ROWS = 1;
var MIN_LEFT = 30;
var MAX_LEFT_RATIO = 0.5;
var MIN_PREVIEW_WIDTH = 45;
var CONFIRMED_OVERHEAD = 2;
function decideLayout(terminalWidth, paneWidth) {
  return terminalWidth >= PREVIEW_MIN_WIDTH && paneWidth >= PREVIEW_MIN_WIDTH ? "side-by-side" : "stacked";
}
function adaptiveLeftWidth(items, totalForNumbering, paneWidth) {
  const prefixW = String(Math.max(1, totalForNumbering)).length + 4;
  const confirmedOverhead = CONFIRMED_OVERHEAD;
  let maxLabel = 0;
  for (const item of items) {
    const w = visibleWidth5(item.label);
    if (w > maxLabel)
      maxLabel = w;
  }
  const desired = maxLabel + prefixW + confirmedOverhead;
  const ratioCapped = Math.min(desired, Math.floor(paneWidth * MAX_LEFT_RATIO));
  const available = paneWidth - PREVIEW_COLUMN_GAP - MIN_PREVIEW_WIDTH;
  return Math.max(MIN_LEFT, Math.min(ratioCapped, Math.max(1, available)));
}
function crossTabMaxLeftWidth(tabs, itemsByTab, paneWidth) {
  let max = MIN_LEFT;
  for (let i = 0;i < tabs.length; i++) {
    const items = itemsByTab[i] ?? [];
    const totalForNumbering = items.length;
    const tabWidth = adaptiveLeftWidth(items, totalForNumbering, paneWidth);
    if (tabWidth > max)
      max = tabWidth;
  }
  return max;
}
function previewSourceWidth(question) {
  let max = 0;
  for (const option of question.options) {
    const text = option.preview;
    if (!text)
      continue;
    for (const line of text.split(`
`)) {
      const w = visibleWidth5(line);
      if (w > max)
        max = w;
    }
  }
  return max;
}
function crossTabPreviewBudget(questions, paneWidth) {
  let max = MIN_PREVIEW_WIDTH;
  for (const question of questions) {
    const rawWidth = previewSourceWidth(question);
    const capped = Math.min(rawWidth, paneWidth - PREVIEW_COLUMN_GAP - MIN_LEFT);
    const budget = capped + BORDER_HORIZONTAL_OVERHEAD + 2 * BORDER_INNER_PADDING_HORIZONTAL + PREVIEW_PADDING_LEFT;
    if (budget > max)
      max = budget;
  }
  return max;
}
function crossTabLeftWidthWithDonation(tabs, itemsByTab, questions, paneWidth) {
  const labelDriven = crossTabMaxLeftWidth(tabs, itemsByTab, paneWidth);
  const previewBudget = crossTabPreviewBudget(questions, paneWidth);
  const slackDonation = paneWidth - PREVIEW_COLUMN_GAP - previewBudget;
  const previewSafetyCeiling = paneWidth - PREVIEW_COLUMN_GAP - MIN_PREVIEW_WIDTH;
  const ratioCeiling = Math.floor(paneWidth * MAX_LEFT_RATIO);
  const ceiling = Math.min(previewSafetyCeiling, ratioCeiling);
  return Math.min(Math.max(labelDriven, slackDonation), Math.max(1, ceiling));
}
function columnWidths(paneWidth, adaptiveLeft) {
  const gap = PREVIEW_COLUMN_GAP;
  const leftWidth = Math.min(adaptiveLeft, Math.max(1, paneWidth - gap - 1));
  const rightWidth = Math.max(1, paneWidth - leftWidth - gap);
  return { leftWidth, rightWidth, gap };
}
function bodyWidths(paneWidth, mode, adaptiveLeft) {
  if (mode === "stacked")
    return { optionsWidth: paneWidth, previewWidth: paneWidth };
  const { leftWidth, rightWidth } = columnWidths(paneWidth, adaptiveLeft);
  return { optionsWidth: leftWidth, previewWidth: Math.max(1, rightWidth - PREVIEW_PADDING_LEFT) };
}

// view/components/preview/preview-pane.ts
import { truncateToWidth as truncateToWidth4, visibleWidth as visibleWidth6 } from "@earendil-works/pi-tui";
class PreviewPane {
  question;
  getTerminalWidth;
  optionListView;
  previewBlock;
  props;
  globalLeftWidth = () => {
    throw new Error("PreviewPane.setGlobalLeftWidth must be called before render()");
  };
  constructor(config) {
    this.question = config.question;
    this.getTerminalWidth = config.getTerminalWidth;
    this.optionListView = config.optionListView;
    this.previewBlock = config.previewBlock;
    this.props = { notesVisible: false, selectedIndex: 0, focused: false, inputMode: false };
  }
  setGlobalLeftWidth(getter) {
    this.globalLeftWidth = getter;
  }
  getAdaptiveLeft(paneWidth) {
    return this.globalLeftWidth(paneWidth);
  }
  setProps(props) {
    this.props = props;
  }
  handleInput(_data) {}
  invalidate() {
    this.previewBlock.invalidate();
    this.optionListView.invalidate();
  }
  render(width) {
    if (this.question.multiSelect === true)
      return this.optionListView.render(width);
    if (!this.previewBlock.hasAnyPreview())
      return this.optionListView.render(width);
    if (this.props.inputMode)
      return this.optionListView.render(width);
    const mode = decideLayout(this.getTerminalWidth(), width);
    if (mode === "side-by-side")
      return this.renderSideBySide(width, mode);
    return [
      ...this.optionListView.render(width),
      ...Array(STACKED_GAP_ROWS).fill(""),
      ...this.previewBlock.renderBlock(width, this.props.selectedIndex, mode, this.props.focused, this.props.notesVisible)
    ];
  }
  focusedItemRowRange(width) {
    if (this.question.multiSelect === true)
      return this.optionListView.focusedItemRowRange(width);
    if (!this.previewBlock.hasAnyPreview())
      return this.optionListView.focusedItemRowRange(width);
    if (this.props.inputMode)
      return this.optionListView.focusedItemRowRange(width);
    const mode = decideLayout(this.getTerminalWidth(), width);
    if (mode === "stacked")
      return this.optionListView.focusedItemRowRange(width);
    const adaptiveLeft = this.getAdaptiveLeft(width);
    const { leftWidth } = columnWidths(width, adaptiveLeft);
    return this.optionListView.focusedItemRowRange(leftWidth);
  }
  naturalHeight(width) {
    if (this.question.multiSelect === true)
      return this.optionListView.render(width).length;
    if (!this.previewBlock.hasAnyPreview())
      return this.optionListView.render(width).length;
    if (this.props.inputMode)
      return this.optionListView.render(width).length;
    const mode = decideLayout(this.getTerminalWidth(), width);
    const adaptiveLeft = this.getAdaptiveLeft(width);
    const { optionsWidth, previewWidth } = bodyWidths(width, mode, adaptiveLeft);
    const optionsHeight = this.optionListView.render(optionsWidth).length;
    const previewBlockHeight = this.previewBlock.blockHeight(previewWidth, this.props.selectedIndex, mode);
    if (mode === "side-by-side")
      return Math.max(optionsHeight, previewBlockHeight);
    return optionsHeight + STACKED_GAP_ROWS + previewBlockHeight;
  }
  maxNaturalHeight(width) {
    if (this.question.multiSelect === true)
      return this.optionListView.render(width).length;
    if (!this.previewBlock.hasAnyPreview())
      return this.optionListView.render(width).length;
    if (this.props.inputMode)
      return this.optionListView.render(width).length;
    const mode = decideLayout(this.getTerminalWidth(), width);
    const adaptiveLeft = this.getAdaptiveLeft(width);
    const { optionsWidth, previewWidth } = bodyWidths(width, mode, adaptiveLeft);
    const optionsHeight = this.optionListView.render(optionsWidth).length;
    let maxPreviewBlock = 0;
    for (let i = 0;i < this.question.options.length; i++) {
      const h = this.previewBlock.blockHeight(previewWidth, i, mode);
      if (h > maxPreviewBlock)
        maxPreviewBlock = h;
    }
    if (mode === "side-by-side")
      return Math.max(optionsHeight, maxPreviewBlock);
    return optionsHeight + STACKED_GAP_ROWS + maxPreviewBlock;
  }
  renderSideBySide(width, mode) {
    const adaptiveLeft = this.getAdaptiveLeft(width);
    const { leftWidth, rightWidth, gap } = columnWidths(width, adaptiveLeft);
    const leftLines = this.optionListView.render(leftWidth);
    const rightLines = this.renderPaddedPreviewLines(rightWidth, mode);
    const rows = Math.max(leftLines.length, rightLines.length);
    const gapStr = " ".repeat(gap);
    const out = [];
    for (let i = 0;i < rows; i++) {
      const leftRaw = leftLines[i] ?? "";
      const rightRaw = rightLines[i] ?? "";
      const leftClamped = truncateToWidth4(leftRaw, leftWidth, "");
      const leftPad = " ".repeat(Math.max(0, leftWidth - visibleWidth6(leftClamped)));
      const joined = `${leftClamped}${leftPad}${gapStr}${rightRaw}`;
      out.push(truncateToWidth4(joined, width, ""));
    }
    return out;
  }
  renderPaddedPreviewLines(colWidth, mode) {
    const inner = Math.max(1, colWidth - PREVIEW_PADDING_LEFT);
    const contentLines = this.previewBlock.renderBlock(inner, this.props.selectedIndex, mode, this.props.focused, this.props.notesVisible);
    const boxWidth = Math.max(1, visibleWidth6(contentLines[0] ?? ""));
    const boxAlignedPad = Math.max(PREVIEW_PADDING_LEFT, colWidth - boxWidth);
    return contentLines.map((line) => {
      if (line === "")
        return "";
      const pad = Math.max(PREVIEW_PADDING_LEFT, Math.min(boxAlignedPad, colWidth - visibleWidth6(line)));
      return `${" ".repeat(pad)}${truncateToWidth4(line, colWidth - pad, "")}`;
    });
  }
}

// view/components/submit-picker.ts
import { truncateToWidth as truncateToWidth5 } from "@earendil-works/pi-tui";
var ACTIVE_POINTER2 = "❯ ";
var INACTIVE_POINTER2 = "  ";
var NUMBER_SEPARATOR2 = ". ";
var SUBMIT_LABEL = "Submit answers";
var CANCEL_LABEL = "Cancel";

class SubmitPicker {
  theme;
  props;
  constructor(theme) {
    this.theme = theme;
    this.props = { rows: [{ active: false }, { active: false }] };
  }
  setProps(props) {
    this.props = props;
  }
  handleInput(_data) {}
  invalidate() {}
  naturalHeight(_width) {
    return 2;
  }
  render(width) {
    const lines = [];
    for (let i = 0;i < 2; i++) {
      const text = i === 0 ? t("submit.label", SUBMIT_LABEL) : t("submit.cancel", CANCEL_LABEL);
      const active = this.props.rows[i]?.active ?? false;
      const pointer = active ? ACTIVE_POINTER2 : INACTIVE_POINTER2;
      const number = `${i + 1}${NUMBER_SEPARATOR2}`;
      const label = active ? this.theme.fg("accent", this.theme.bold(text)) : this.theme.fg("text", text);
      lines.push(truncateToWidth5(`${pointer}${number}${label}`, width, ""));
    }
    return lines;
  }
}

// view/components/tab-bar.ts
import { truncateToWidth as truncateToWidth6 } from "@earendil-works/pi-tui";

class TabBar {
  theme;
  props;
  constructor(theme) {
    this.theme = theme;
    this.props = { tabs: [], submit: { active: false, allAnswered: false } };
  }
  setProps(props) {
    this.props = props;
  }
  handleInput(_data) {}
  invalidate() {}
  render(width) {
    const pieces = [" ← "];
    for (const tab of this.props.tabs) {
      const box = tab.answered ? "■" : "□";
      const rawSeg = ` ${box} ${tab.label} `;
      const styled = tab.active ? this.theme.bg("selectedBg", this.theme.fg("text", rawSeg)) : this.theme.fg(tab.answered ? "success" : "muted", rawSeg);
      pieces.push(styled);
      pieces.push(" ");
    }
    const submitText = " ✓ Submit ";
    const submitStyled = this.props.submit.active ? this.theme.bg("selectedBg", this.theme.fg("text", submitText)) : this.theme.fg(this.props.submit.allAnswered ? "success" : "dim", submitText);
    pieces.push(submitStyled);
    pieces.push(" →");
    const tabLine = truncateToWidth6(pieces.join(""), width, "");
    return [tabLine, ""];
  }
}

// state/selectors/derivations.ts
function selectConfirmedIndicator(questions, currentTab, answers, items) {
  const q = questions[currentTab];
  if (!q || q.multiSelect === true)
    return;
  const prior = answers.get(currentTab);
  if (!prior)
    return;
  if (prior.kind === "custom") {
    const otherIndex = items.findIndex((it) => it.kind === "other");
    if (otherIndex < 0)
      return;
    return { index: otherIndex, labelOverride: prior.answer ?? "" };
  }
  if (prior.kind !== "option" || typeof prior.answer !== "string")
    return;
  const index = items.findIndex((it) => it.kind === "option" && it.label === prior.answer);
  if (index < 0)
    return;
  return { index };
}
function selectActivePreviewPaneIndex(currentTab, totalQuestions) {
  if (totalQuestions <= 0)
    return 0;
  return Math.min(currentTab, totalQuestions - 1);
}

// state/selectors/focus.ts
function selectActiveView(state, totalQuestions) {
  if (state.notesVisible)
    return "notes";
  if (state.currentTab === totalQuestions)
    return "submit";
  return "options";
}

// view/props-adapter.ts
function getInputCursorOffset(input) {
  const lines = input.getLines();
  const cursor = input.getCursor();
  let offset = cursor.col;
  for (let i = 0;i < cursor.line; i++)
    offset += (lines[i]?.length ?? 0) + 1;
  return offset;
}

class QuestionnairePropsAdapter {
  tui;
  questions;
  itemsByTab;
  tabsByIndex;
  inlineInput;
  globalBindings;
  perTabBindings;
  extraInvalidatables;
  constructor(config) {
    this.tui = config.tui;
    this.questions = config.questions;
    this.itemsByTab = config.itemsByTab;
    this.tabsByIndex = config.tabsByIndex;
    this.inlineInput = config.inlineInput;
    this.globalBindings = config.globalBindings;
    this.perTabBindings = config.perTabBindings;
    this.extraInvalidatables = config.extraInvalidatables ?? [];
  }
  apply(state) {
    const totalQuestions = this.questions.length;
    const activeView = selectActiveView(state, totalQuestions);
    const paneIndex = selectActivePreviewPaneIndex(state.currentTab, totalQuestions);
    const activePreviewPane = this.tabsByIndex[paneIndex]?.preview ?? this.tabsByIndex[0].preview;
    const ctx = {
      questions: this.questions,
      itemsByTab: this.itemsByTab,
      totalQuestions,
      activeView,
      inputBuffer: this.inlineInput.getText(),
      inputCursorOffset: getInputCursorOffset(this.inlineInput),
      activePreviewPane
    };
    for (const binding of this.globalBindings) {
      binding.apply(state, ctx);
    }
    for (let i = 0;i < this.tabsByIndex.length; i++) {
      const tab = this.tabsByIndex[i];
      const tabCtx = { ...ctx, tab, i };
      for (const binding of this.perTabBindings) {
        binding.apply(state, tabCtx);
      }
    }
    this.tui.requestRender();
  }
  invalidate() {
    for (const b of this.globalBindings)
      b.invalidate();
    for (const tab of this.tabsByIndex) {
      tab.optionList.invalidate();
      tab.preview.invalidate();
      tab.multiSelect?.invalidate();
    }
    for (const x of this.extraInvalidatables)
      x.invalidate();
  }
}

// state/selectors/projections.ts
function emptyMultiSelectProps(ctx) {
  return {
    rows: [],
    other: {
      active: false,
      inputMode: false,
      inputBuffer: ctx.inputBuffer,
      inputCursorOffset: ctx.inputCursorOffset
    },
    nextActive: false,
    nextLabel: displayLabel("next")
  };
}
function nextLabelFor(ctx) {
  const isLastQuestion = ctx.i === ctx.questions.length - 1;
  return isLastQuestion ? MULTI_SUBMIT_LABEL : displayLabel("next");
}
var selectMultiSelectProps = (state, ctx) => {
  const question = ctx.questions[ctx.i];
  if (!question) {
    return emptyMultiSelectProps(ctx);
  }
  const focused = ctx.activeView === "options";
  const rows = [];
  for (let i = 0;i < question.options.length; i++) {
    rows.push({
      checked: state.multiSelectChecked.has(i),
      active: focused && i === state.optionIndex
    });
  }
  const otherActive = focused && state.optionIndex === question.options.length;
  const nextActive = focused && state.optionIndex === question.options.length + 1;
  return {
    rows,
    other: {
      active: otherActive,
      checked: state.multiSelectChecked.has(question.options.length),
      inputMode: state.inputMode,
      inputBuffer: ctx.inputBuffer,
      inputCursorOffset: ctx.inputCursorOffset
    },
    nextActive,
    nextLabel: nextLabelFor(ctx)
  };
};
var selectOptionListProps = (state, ctx) => {
  const items = ctx.itemsByTab[ctx.i] ?? [];
  const focused = ctx.activeView === "options";
  const confirmed = selectConfirmedIndicator(ctx.questions, state.currentTab, state.answers, items);
  return {
    selectedIndex: state.optionIndex,
    focused,
    inputBuffer: ctx.inputBuffer,
    inputCursorOffset: ctx.inputCursorOffset,
    ...confirmed ? { confirmed } : {}
  };
};
var selectSubmitPickerProps = (state, ctx) => {
  const focused = ctx.activeView === "submit";
  return {
    rows: [
      { active: focused && state.submitChoiceIndex === 0 },
      { active: focused && state.submitChoiceIndex === 1 }
    ]
  };
};
var selectPreviewPaneProps = (state, ctx) => ({
  notesVisible: state.notesVisible,
  selectedIndex: state.optionIndex,
  focused: ctx.activeView === "options",
  inputMode: state.inputMode
});
var selectTabBarProps = (state, ctx) => {
  const tabs = ctx.questions.map((q, i) => ({
    label: q.header && q.header.length > 0 ? q.header : `Q${i + 1}`,
    answered: state.answers.has(i),
    active: i === state.currentTab
  }));
  return {
    tabs,
    submit: {
      active: state.currentTab === ctx.questions.length,
      allAnswered: state.answers.size === ctx.questions.length && ctx.questions.length > 0
    }
  };
};
var selectDialogProps = (state, ctx) => ({
  state,
  activePreviewPane: ctx.activePreviewPane
});

// state/build-questionnaire.ts
function previewBodyHeights(pane) {
  return (width) => {
    const current = pane.naturalHeight(width);
    return { current, max: Math.max(current, pane.maxNaturalHeight(width)) };
  };
}
function editorTheme(theme) {
  return {
    borderColor: (text) => theme.fg("borderMuted", text),
    selectList: {
      selectedPrefix: (text) => theme.bg("selectedBg", theme.fg("accent", text)),
      selectedText: (text) => theme.bg("selectedBg", theme.bold(text)),
      description: (text) => theme.fg("muted", text),
      scrollInfo: (text) => theme.fg("dim", text),
      noMatch: (text) => theme.fg("warning", text)
    }
  };
}
function multiSelectBodyHeights(view) {
  return (width) => {
    const h = view.naturalHeight(width);
    return { current: h, max: h };
  };
}
var isActiveTab = (s, ctx) => ctx.i === selectActivePreviewPaneIndex(s.currentTab, ctx.totalQuestions);
function buildQuestionnaire(config) {
  return new QuestionnaireBuilder(config).build();
}

class QuestionnaireBuilder {
  tui;
  theme;
  questions;
  itemsByTab;
  isMulti;
  initialState;
  getCurrentTab;
  collapseKey;
  selectTheme;
  markdownTheme = getMarkdownTheme();
  notesInput;
  inlineInput;
  getTerminalWidth = () => this.tui.terminal.columns;
  getTerminalRows = () => this.tui.terminal.rows;
  constructor(config) {
    this.tui = config.tui;
    this.theme = config.theme;
    this.questions = config.questions;
    this.itemsByTab = config.itemsByTab;
    this.isMulti = config.isMulti;
    this.initialState = config.initialState;
    this.getCurrentTab = config.getCurrentTab;
    this.collapseKey = config.collapseKey;
    this.selectTheme = this.makeSelectTheme();
    const textEditorTheme = editorTheme(this.theme);
    this.notesInput = new Editor(this.tui, textEditorTheme);
    this.inlineInput = new Editor(this.tui, textEditorTheme);
    this.notesInput.disableSubmit = true;
    this.inlineInput.disableSubmit = true;
  }
  build() {
    const tabs = this.buildTabComponents();
    this.injectGlobalLeftWidth(tabs);
    const submitPicker = this.buildSubmitPicker();
    const tabBar = this.buildTabBar();
    const heights = this.buildHeightComputers(tabs);
    const dialog = this.buildDialog(tabs, submitPicker, tabBar, heights);
    const globalBindings = this.buildGlobalBindings(dialog, submitPicker, tabBar);
    const perTabBindings = this.buildPerTabBindings();
    const adapter = this.buildAdapter(tabs, globalBindings, perTabBindings);
    return this.handle(adapter, dialog);
  }
  makeSelectTheme() {
    const t = this.theme;
    return {
      selectedText: (s) => t.fg("accent", t.bold(s)),
      description: (s) => t.fg("muted", s),
      scrollInfo: (s) => t.fg("dim", s)
    };
  }
  buildTabComponents() {
    return this.questions.map((q, i) => this.buildTabFor(q, i));
  }
  buildTabFor(question, index) {
    const optionList = new OptionListView({
      items: this.itemsByTab[index] ?? [],
      theme: this.selectTheme
    });
    const previewBlock = new PreviewBlockRenderer({
      question,
      theme: this.theme,
      markdownTheme: this.markdownTheme
    });
    const preview = new PreviewPane({
      question,
      getTerminalWidth: this.getTerminalWidth,
      optionListView: optionList,
      previewBlock
    });
    const multiSelect = question.multiSelect ? new MultiSelectView(this.theme, question) : undefined;
    const bodyHeights = this.buildBodyHeights(question, preview, multiSelect);
    return { optionList, preview, multiSelect, bodyHeights };
  }
  buildBodyHeights(question, preview, multiSelect) {
    return question.multiSelect ? multiSelectBodyHeights(multiSelect) : previewBodyHeights(preview);
  }
  injectGlobalLeftWidth(tabs) {
    const questions = this.questions;
    const itemsByTab = this.itemsByTab;
    const tabsDescriptor = questions.map((q) => ({ multiSelect: q.multiSelect }));
    const globalLeftWidth = (paneWidth) => crossTabLeftWidthWithDonation(tabsDescriptor, itemsByTab, questions, paneWidth);
    for (const tab of tabs) {
      tab.preview.setGlobalLeftWidth(globalLeftWidth);
    }
  }
  buildSubmitPicker() {
    return this.isMulti ? new SubmitPicker(this.theme) : undefined;
  }
  buildTabBar() {
    return this.isMulti ? new TabBar(this.theme) : undefined;
  }
  buildHeightComputers(tabs) {
    const global = (width) => {
      let max = 0;
      for (const tab of tabs) {
        const h = tab.bodyHeights(width).max;
        if (h > max)
          max = h;
      }
      return Math.max(1, max);
    };
    const current = (width) => {
      const idx = Math.min(this.getCurrentTab(), tabs.length - 1);
      return Math.max(0, tabs[idx]?.bodyHeights(width).current ?? 0);
    };
    return { global, current };
  }
  pickInitialActivePreview(tabs) {
    const idx = selectActivePreviewPaneIndex(this.initialState.currentTab, this.questions.length);
    return tabs[idx]?.preview ?? tabs[0].preview;
  }
  buildDialog(tabs, submitPicker, tabBar, heights) {
    return new DialogView({
      theme: this.theme,
      questions: this.questions,
      tabBar,
      notesInput: this.notesInput,
      isMulti: this.isMulti,
      tabsByIndex: tabs,
      submitPicker,
      getBodyHeight: heights.global,
      getCurrentBodyHeight: heights.current,
      getTerminalRows: this.getTerminalRows,
      collapseKey: this.collapseKey
    }, { state: this.initialState, activePreviewPane: this.pickInitialActivePreview(tabs) });
  }
  buildGlobalBindings(dialog, submitPicker, tabBar) {
    return [
      globalBinding({ component: dialog, select: selectDialogProps }),
      ...submitPicker ? [globalBinding({ component: submitPicker, select: selectSubmitPickerProps })] : [],
      ...tabBar ? [globalBinding({ component: tabBar, select: selectTabBarProps })] : []
    ];
  }
  buildPerTabBindings() {
    return [
      perTabBinding({
        resolve: (tab) => tab.optionList,
        predicate: isActiveTab,
        select: selectOptionListProps
      }),
      perTabBinding({
        resolve: (tab) => tab.preview,
        predicate: isActiveTab,
        select: selectPreviewPaneProps
      }),
      perTabBinding({
        resolve: (tab) => tab.multiSelect,
        select: selectMultiSelectProps
      })
    ];
  }
  buildAdapter(tabs, globalBindings, perTabBindings) {
    return new QuestionnairePropsAdapter({
      tui: this.tui,
      questions: this.questions,
      itemsByTab: this.itemsByTab,
      tabsByIndex: tabs,
      inlineInput: this.inlineInput,
      globalBindings,
      perTabBindings,
      extraInvalidatables: [this.notesInput]
    });
  }
  handle(adapter, dialog) {
    return {
      adapter,
      notesInput: this.notesInput,
      inlineInput: this.inlineInput,
      render: (w) => dialog.render(w),
      invalidate: () => adapter.invalidate()
    };
  }
}

// state/key-router.ts
import { Key, matchesKey } from "@earendil-works/pi-tui";
var KEYBIND_UP = "tui.select.up";
var KEYBIND_DOWN = "tui.select.down";
var KEYBIND_CONFIRM = "tui.select.confirm";
var KEYBIND_SUBMIT = "tui.input.submit";
var KEYBIND_CANCEL = "tui.select.cancel";
var KEYBIND_NEW_LINE = "tui.input.newLine";
var KEYBIND_EDITOR_UP = "tui.editor.cursorUp";
var KEYBIND_EDITOR_DOWN = "tui.editor.cursorDown";
var KEYBIND_CLEAR = "tui.editor.deleteToLineStart";
var KEYBIND_EXTERNAL_EDITOR = "app.editor.external";
var NOTES_ACTIVATE_KEY = "n";
function isConfirm(kb, data) {
  return kb.matches(data, KEYBIND_CONFIRM) || kb.matches(data, KEYBIND_SUBMIT);
}
function wrapTab(index, total) {
  if (total <= 0)
    return 0;
  return (index % total + total) % total;
}
function totalTabs(runtime) {
  return runtime.isMulti ? runtime.questions.length + 1 : 1;
}
function computeAutoAdvanceTab(state, runtime) {
  if (!runtime.isMulti)
    return;
  if (state.currentTab < runtime.questions.length - 1)
    return state.currentTab + 1;
  return runtime.questions.length;
}
function buildSingleSelectAnswer(state, runtime) {
  const q = runtime.questions[state.currentTab];
  if (!q)
    return null;
  const item = runtime.currentItem;
  if (state.inputMode) {
    const label = runtime.inputBuffer;
    return {
      questionIndex: state.currentTab,
      question: q.question,
      kind: "custom",
      answer: label.length > 0 ? label : null
    };
  }
  if (!item)
    return null;
  if (item.kind === "other") {
    return null;
  }
  if (item.kind === "next") {
    return null;
  }
  return {
    questionIndex: state.currentTab,
    question: q.question,
    kind: "option",
    answer: item.label
  };
}
function buildMultiSelected(state, runtime) {
  const q = runtime.questions[state.currentTab];
  if (!q)
    return [];
  const out = [];
  for (let i = 0;i < q.options.length; i++) {
    if (state.multiSelectChecked.has(i)) {
      const label = q.options[i]?.label;
      if (typeof label === "string")
        out.push(label);
    }
  }
  return out;
}
function tabSwitchAction(data, state, runtime) {
  if (!runtime.isMulti)
    return null;
  const total = totalTabs(runtime);
  if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
    return { kind: "tab_switch", nextTab: wrapTab(state.currentTab + 1, total) };
  }
  if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
    return { kind: "tab_switch", nextTab: wrapTab(state.currentTab - 1, total) };
  }
  return null;
}
function nextNavOnDown(state, runtime) {
  return {
    kind: "nav",
    nextIndex: wrapTab(state.optionIndex + 1, Math.max(1, runtime.items.length)),
    inputValue: runtime.inputBuffer
  };
}
function prevNavOnUp(state, runtime) {
  return {
    kind: "nav",
    nextIndex: wrapTab(state.optionIndex - 1, Math.max(1, runtime.items.length)),
    inputValue: runtime.inputBuffer
  };
}
function routeCollapsed(kb, data) {
  if (kb.matches(data, KEYBIND_CANCEL))
    return { kind: "cancel" };
  return { kind: "ignore" };
}
function routeNotesMode(kb, data) {
  if (kb.matches(data, KEYBIND_CANCEL))
    return { kind: "notes_exit" };
  if (kb.matches(data, KEYBIND_NEW_LINE))
    return { kind: "notes_forward", data };
  if (isConfirm(kb, data))
    return { kind: "notes_exit" };
  return { kind: "notes_forward", data };
}
function routeInputMode(kb, data, state, runtime) {
  if (kb.matches(data, KEYBIND_NEW_LINE))
    return { kind: "ignore" };
  if (isConfirm(kb, data)) {
    if (runtime.questions[state.currentTab]?.multiSelect) {
      return { kind: "toggle", index: state.optionIndex, inputValue: runtime.inputBuffer };
    }
    const answer = buildSingleSelectAnswer(state, runtime);
    if (!answer)
      return { kind: "ignore" };
    return { kind: "confirm", answer, autoAdvanceTab: computeAutoAdvanceTab(state, runtime) };
  }
  if (kb.matches(data, KEYBIND_CLEAR))
    return { kind: "input_clear" };
  if (kb.matches(data, KEYBIND_EXTERNAL_EDITOR))
    return { kind: "input_edit", value: runtime.inputBuffer };
  if (kb.matches(data, KEYBIND_CANCEL))
    return { kind: "cancel" };
  if (kb.matches(data, KEYBIND_EDITOR_UP) && runtime.canMoveInputUp)
    return { kind: "ignore" };
  if (kb.matches(data, KEYBIND_EDITOR_DOWN) && runtime.canMoveInputDown)
    return { kind: "ignore" };
  if (kb.matches(data, KEYBIND_UP))
    return prevNavOnUp(state, runtime);
  if (kb.matches(data, KEYBIND_DOWN))
    return nextNavOnDown(state, runtime);
  return { kind: "ignore" };
}
function routeSubmitTab(kb, data, state, runtime) {
  if (kb.matches(data, KEYBIND_CANCEL))
    return { kind: "cancel" };
  const tab = tabSwitchAction(data, state, runtime);
  if (tab)
    return tab;
  if (kb.matches(data, KEYBIND_UP) || kb.matches(data, KEYBIND_DOWN)) {
    const delta = kb.matches(data, KEYBIND_DOWN) ? 1 : -1;
    const next = wrapTab(state.submitChoiceIndex + delta, 2);
    return { kind: "submit_nav", nextIndex: next === 1 ? 1 : 0 };
  }
  if (isConfirm(kb, data)) {
    return state.submitChoiceIndex === 1 ? { kind: "cancel" } : { kind: "submit" };
  }
  if (data === NOTES_ACTIVATE_KEY) {
    return { kind: "notes_enter" };
  }
  return { kind: "ignore" };
}
function routeMultiSelectTab(kb, data, state, runtime) {
  const focusedKind = runtime.currentItem?.kind;
  const focusedMeta = focusedKind ? ROW_INTENT_META[focusedKind] : undefined;
  if (isConfirm(kb, data)) {
    if (focusedKind === "other") {
      return { kind: "toggle", index: state.optionIndex, inputValue: runtime.inputBuffer };
    }
    if (!focusedMeta?.autoSubmitsInMulti)
      return { kind: "toggle", index: state.optionIndex };
    return {
      kind: "multi_confirm",
      selected: buildMultiSelected(state, runtime),
      autoAdvanceTab: computeAutoAdvanceTab(state, runtime)
    };
  }
  if (kb.matches(data, KEYBIND_CANCEL))
    return { kind: "cancel" };
  return { kind: "ignore" };
}
function routeSingleSelectTab(kb, data, state, runtime) {
  if (isConfirm(kb, data)) {
    const answer = buildSingleSelectAnswer(state, runtime);
    if (!answer)
      return { kind: "ignore" };
    return { kind: "confirm", answer, autoAdvanceTab: computeAutoAdvanceTab(state, runtime) };
  }
  if (kb.matches(data, KEYBIND_CANCEL))
    return { kind: "cancel" };
  return { kind: "ignore" };
}
function routeKey(data, state, runtime) {
  const kb = runtime.keybindings;
  if (typeof runtime.collapseKey === "string" && runtime.collapseKey !== "off" && matchesKey(data, runtime.collapseKey)) {
    return { kind: "toggle_collapsed" };
  }
  if (state.collapsed)
    return routeCollapsed(kb, data);
  if (state.notesVisible)
    return routeNotesMode(kb, data);
  if (state.inputMode)
    return routeInputMode(kb, data, state, runtime);
  if (runtime.isMulti && state.currentTab === runtime.questions.length) {
    return routeSubmitTab(kb, data, state, runtime);
  }
  const tab = tabSwitchAction(data, state, runtime);
  if (tab)
    return tab;
  const q = runtime.questions[state.currentTab];
  if (!q)
    return { kind: "ignore" };
  if (data === NOTES_ACTIVATE_KEY) {
    return { kind: "notes_enter" };
  }
  if (kb.matches(data, KEYBIND_UP)) {
    return prevNavOnUp(state, runtime);
  }
  if (kb.matches(data, KEYBIND_DOWN)) {
    return nextNavOnDown(state, runtime);
  }
  if (q.multiSelect)
    return routeMultiSelectTab(kb, data, state, runtime);
  return routeSingleSelectTab(kb, data, state, runtime);
}

// state/state-reducer.ts
function orderedAnswers(state, questions) {
  const out = [];
  for (let i = 0;i < questions.length; i++) {
    const a = state.answers.get(i);
    if (a)
      out.push(a);
  }
  return out;
}
function syncMultiSelectFromAnswers(answers, questions, tab) {
  const q = questions[tab];
  if (!q?.multiSelect)
    return new Set;
  const saved = answers.get(tab);
  const labels = saved?.selected ?? [];
  const indices = new Set;
  for (let i = 0;i < q.options.length; i++) {
    if (labels.includes(q.options[i].label))
      indices.add(i);
  }
  if (saved?.answer)
    indices.add(q.options.length);
  return indices;
}
function persistMultiSelectAnswer(state, ctx) {
  const q = ctx.questions[state.currentTab];
  if (!q?.multiSelect)
    return state.answers;
  const selected = [];
  for (let i = 0;i < q.options.length; i++) {
    if (state.multiSelectChecked.has(i))
      selected.push(q.options[i].label);
  }
  const out = new Map(state.answers);
  const customAnswer = state.multiSelectChecked.has(q.options.length) ? customDraftValueFor(state, state.currentTab) : "";
  if (selected.length === 0 && customAnswer.length === 0) {
    out.delete(state.currentTab);
    return out;
  }
  const pendingNotes = state.notesByTab.get(state.currentTab);
  out.set(state.currentTab, {
    questionIndex: state.currentTab,
    question: q.question,
    kind: "multi",
    answer: customAnswer || null,
    selected,
    ...pendingNotes && pendingNotes.length > 0 ? { notes: pendingNotes } : {}
  });
  return out;
}
function notesValueFor(state, tab) {
  return state.notesByTab.get(tab) ?? state.answers.get(tab)?.notes ?? "";
}
function customDraftValueFor(state, tab) {
  const draft = state.customDraftsByTab.get(tab);
  if (draft !== undefined)
    return draft;
  const answer = state.answers.get(tab);
  return (answer?.kind === "custom" || answer?.kind === "multi") && typeof answer.answer === "string" ? answer.answer : "";
}
function setCustomDraft(state, tab, value) {
  const drafts = new Map(state.customDraftsByTab);
  drafts.set(tab, value);
  return drafts;
}
function withoutCustomDraft(state, tab) {
  if (!state.customDraftsByTab.has(tab))
    return state.customDraftsByTab;
  const drafts = new Map(state.customDraftsByTab);
  drafts.delete(tab);
  return drafts;
}
function switchTabResult(state, nextTab, ctx) {
  const notesValue = notesValueFor(state, nextTab);
  const transitioned = {
    ...state,
    currentTab: nextTab,
    optionIndex: 0,
    inputMode: false,
    notesVisible: false,
    submitChoiceIndex: 0,
    multiSelectChecked: syncMultiSelectFromAnswers(state.answers, ctx.questions, nextTab),
    notesDraft: notesValue
  };
  return {
    state: transitioned,
    effects: [
      { kind: "set_notes_focused", focused: false },
      { kind: "set_notes_value", value: notesValue },
      { kind: "set_input_buffer", value: customDraftValueFor(state, nextTab) }
    ]
  };
}
function doneFor(state, ctx, cancelled) {
  const globalNote = state.notesByTab.get(ctx.questions.length);
  const result = {
    answers: orderedAnswers(state, ctx.questions),
    cancelled,
    ...globalNote && globalNote.length > 0 ? { globalNote } : {}
  };
  return { state, effects: [{ kind: "done", result }] };
}
var navHandler = (state, action, ctx) => {
  const items = ctx.itemsByTab[state.currentTab] ?? [];
  const item = items[action.nextIndex];
  const isMulti = ctx.questions[state.currentTab]?.multiSelect === true;
  const inputMode = !!item && ROW_INTENT_META[item.kind].activatesInputMode;
  const customDraftsByTab = state.inputMode ? setCustomDraft(state, state.currentTab, action.inputValue) : state.customDraftsByTab;
  const intermediate = {
    ...state,
    optionIndex: action.nextIndex,
    inputMode,
    customDraftsByTab
  };
  const next = state.inputMode && isMulti ? { ...intermediate, answers: persistMultiSelectAnswer(intermediate, ctx) } : intermediate;
  if (!inputMode && item?.kind !== "other")
    return { state: next, effects: [] };
  return {
    state: next,
    effects: [{ kind: "set_input_buffer", value: customDraftValueFor(next, state.currentTab) }]
  };
};
var inputClearHandler = (state, _action, _ctx) => ({
  state: { ...state, customDraftsByTab: setCustomDraft(state, state.currentTab, "") },
  effects: [{ kind: "clear_input_buffer" }]
});
var inputEditHandler = (state, action, _ctx) => ({
  state,
  effects: [{ kind: "open_input_editor", value: action.value }]
});
var inputReplaceHandler = (state, action, _ctx) => ({
  state: { ...state, customDraftsByTab: setCustomDraft(state, state.currentTab, action.value) },
  effects: [{ kind: "set_input_buffer", value: action.value }]
});
var tabSwitchHandler = (state, action, ctx) => switchTabResult(state, action.nextTab, ctx);
var confirmHandler = (state, action, ctx) => {
  let answer = action.answer;
  if (answer.kind === "option" && answer.answer) {
    const q = ctx.questions[answer.questionIndex];
    const matched = q?.options.find((o) => o.label === answer.answer);
    if (matched?.preview && matched.preview.length > 0) {
      answer = { ...answer, preview: matched.preview };
    }
  }
  const pendingNotes = state.notesByTab.get(answer.questionIndex);
  if (pendingNotes && pendingNotes.length > 0) {
    answer = { ...answer, notes: pendingNotes };
  }
  const answers = new Map(state.answers);
  answers.set(answer.questionIndex, answer);
  const customDraftsByTab = answer.kind === "custom" ? withoutCustomDraft(state, answer.questionIndex) : state.customDraftsByTab;
  const next = {
    ...state,
    answers,
    customDraftsByTab
  };
  if (action.autoAdvanceTab !== undefined)
    return switchTabResult(next, action.autoAdvanceTab, ctx);
  return doneFor(next, ctx, false);
};
var toggleHandler = (state, action, ctx) => {
  const checked = new Set(state.multiSelectChecked);
  if (checked.has(action.index))
    checked.delete(action.index);
  else
    checked.add(action.index);
  const customIndex = ctx.questions[state.currentTab]?.options.length;
  const customDraftsByTab = action.index === customIndex && action.inputValue !== undefined ? setCustomDraft(state, state.currentTab, action.inputValue) : state.customDraftsByTab;
  const intermediate = { ...state, multiSelectChecked: checked, customDraftsByTab };
  const answers = persistMultiSelectAnswer(intermediate, ctx);
  return { state: { ...intermediate, answers }, effects: [] };
};
var multiConfirmHandler = (state, action, ctx) => {
  const q = ctx.questions[state.currentTab];
  if (!q)
    return { state, effects: [] };
  const pendingNotes = state.notesByTab.get(state.currentTab);
  const answers = new Map(state.answers);
  answers.set(state.currentTab, {
    questionIndex: state.currentTab,
    question: q.question,
    kind: "multi",
    answer: state.multiSelectChecked.has(q.options.length) ? customDraftValueFor(state, state.currentTab) || null : null,
    selected: action.selected,
    ...pendingNotes && pendingNotes.length > 0 ? { notes: pendingNotes } : {}
  });
  const synced = {
    ...state,
    answers,
    multiSelectChecked: syncMultiSelectFromAnswers(answers, ctx.questions, state.currentTab)
  };
  if (action.autoAdvanceTab !== undefined)
    return switchTabResult(synced, action.autoAdvanceTab, ctx);
  return doneFor(synced, ctx, false);
};
var notesEnterHandler = (state, _action, _ctx) => {
  const value = notesValueFor(state, state.currentTab);
  return {
    state: { ...state, notesVisible: true, notesDraft: value },
    effects: [
      { kind: "set_notes_value", value },
      { kind: "set_notes_focused", focused: true }
    ]
  };
};
var notesExitHandler = (state, _action, _ctx) => {
  const trimmed = state.notesDraft.trim();
  const notes = new Map(state.notesByTab);
  const answers = new Map(state.answers);
  if (trimmed.length === 0) {
    notes.delete(state.currentTab);
    const prev = answers.get(state.currentTab);
    if (prev?.notes) {
      const stripped = { ...prev };
      delete stripped.notes;
      answers.set(state.currentTab, stripped);
    }
  } else {
    notes.set(state.currentTab, trimmed);
    const prev = answers.get(state.currentTab);
    if (prev)
      answers.set(state.currentTab, { ...prev, notes: trimmed });
  }
  return {
    state: { ...state, notesByTab: notes, answers, notesVisible: false },
    effects: [{ kind: "set_notes_focused", focused: false }]
  };
};
var cancelHandler = (s, _a, c) => doneFor(s, c, true);
var submitHandler = (s, _a, c) => doneFor(s, c, false);
var submitNavHandler = (s, a, _c) => ({
  state: { ...s, submitChoiceIndex: a.nextIndex },
  effects: []
});
var notesForwardHandler = (s, a, _c) => ({
  state: s,
  effects: [{ kind: "forward_notes_keystroke", data: a.data }]
});
var toggleCollapsedHandler = (s, _a, _c) => ({
  state: { ...s, collapsed: !s.collapsed },
  effects: [{ kind: "set_overlay_hidden", hidden: !s.collapsed }]
});
var ignoreHandler = (s, _a, _c) => ({ state: s, effects: [] });
var HANDLERS = {
  nav: navHandler,
  input_clear: inputClearHandler,
  input_edit: inputEditHandler,
  input_replace: inputReplaceHandler,
  tab_switch: tabSwitchHandler,
  confirm: confirmHandler,
  toggle: toggleHandler,
  multi_confirm: multiConfirmHandler,
  cancel: cancelHandler,
  notes_enter: notesEnterHandler,
  notes_exit: notesExitHandler,
  notes_forward: notesForwardHandler,
  submit: submitHandler,
  submit_nav: submitNavHandler,
  toggle_collapsed: toggleCollapsedHandler,
  ignore: ignoreHandler
};
function reduce(state, action, ctx) {
  const handler = HANDLERS[action.kind];
  return handler(state, action, ctx);
}

// state/questionnaire-session.ts
function initialState() {
  return {
    currentTab: 0,
    optionIndex: 0,
    inputMode: false,
    notesVisible: false,
    answers: new Map,
    multiSelectChecked: new Set,
    customDraftsByTab: new Map,
    notesByTab: new Map,
    submitChoiceIndex: 0,
    notesDraft: "",
    collapsed: false
  };
}

class QuestionnaireSession {
  state = initialState();
  questions;
  isMulti;
  itemsByTab;
  notesInput;
  inlineInput;
  viewAdapter;
  keybindings;
  editInput;
  collapseKey;
  canReopenWhileHidden;
  inputEditorOpen = false;
  overlayHandle;
  tui;
  done;
  component;
  constructor(config) {
    this.tui = config.tui;
    this.done = config.done;
    this.questions = config.params.questions;
    this.isMulti = this.questions.length > 1;
    this.itemsByTab = config.itemsByTab;
    this.keybindings = config.keybindings;
    this.editInput = config.editInput;
    this.collapseKey = config.collapseKey;
    this.canReopenWhileHidden = config.canReopenWhileHidden;
    const built = buildQuestionnaire({
      tui: this.tui,
      theme: config.theme,
      questions: this.questions,
      itemsByTab: this.itemsByTab,
      isMulti: this.isMulti,
      initialState: this.state,
      getCurrentTab: () => this.state.currentTab,
      collapseKey: this.collapseKey
    });
    this.notesInput = built.notesInput;
    this.inlineInput = built.inlineInput;
    this.viewAdapter = built.adapter;
    this.component = this.assembleComponent(built, config.theme);
    this.viewAdapter.apply(this.state);
  }
  assembleComponent(built, theme) {
    const collapsedRender = this.buildCollapsedRender(theme);
    return {
      render: (width) => this.state.collapsed ? collapsedRender(width) : built.render(width),
      invalidate: built.invalidate,
      handleInput: (data) => this.dispatch(data)
    };
  }
  buildCollapsedRender(theme) {
    const collapseKeyDisplay = formatKeySpecForDisplay(this.collapseKey);
    const collapsedHintLine = () => this.collapseKey === COLLAPSE_KEY_OFF ? t("hint.cancel", HINT_PART_CANCEL) : t("hint.expand_line", COLLAPSED_HINT_TEMPLATE).replace(KEY_PLACEHOLDER, collapseKeyDisplay);
    return (_width) => [theme.fg("dim", ` ${collapsedHintLine()} `)];
  }
  dispatch(data) {
    if (this.inputEditorOpen)
      return;
    const action = routeKey(data, this.state, this.runtime());
    if (action.kind === "ignore") {
      this.handleIgnoreInline(data);
      return;
    }
    this.commit(action);
  }
  commit(action) {
    const result = reduce(this.state, action, this.applyContext());
    this.state = result.state;
    for (const effect of result.effects)
      this.runEffect(effect);
    this.state = this.mirrorNotesDraft(this.state);
    this.viewAdapter.apply(this.state);
  }
  mirrorNotesDraft(s) {
    const draft = this.notesInput.getExpandedText?.() ?? this.notesInput.getText();
    return s.notesDraft === draft ? s : { ...s, notesDraft: draft };
  }
  runEffect(effect) {
    switch (effect.kind) {
      case "set_input_buffer":
        this.inlineInput.setText(effect.value);
        return;
      case "clear_input_buffer":
        this.inlineInput.setText("");
        return;
      case "open_input_editor":
        this.openInputEditorAsync(effect.value);
        return;
      case "set_notes_value":
        this.notesInput.setText(effect.value);
        return;
      case "set_notes_focused":
        this.notesInput.focused = effect.focused;
        return;
      case "forward_notes_keystroke":
        this.notesInput.handleInput(effect.data);
        return;
      case "set_overlay_hidden":
        if (this.canReopenWhileHidden)
          this.overlayHandle?.setHidden(effect.hidden);
        return;
      case "done":
        this.done(effect.result);
        return;
    }
  }
  openInputEditorAsync(value) {
    if (this.inputEditorOpen)
      return;
    this.inputEditorOpen = true;
    this.editInput(value).then((edited) => {
      this.inputEditorOpen = false;
      if (edited !== undefined)
        this.commit({ kind: "input_replace", value: edited });
    }, () => {
      this.inputEditorOpen = false;
    });
  }
  handleIgnoreInline(data) {
    if (!this.state.inputMode)
      return;
    this.inlineInput.handleInput(data);
    this.viewAdapter.apply(this.state);
  }
  runtime() {
    const cursor = this.inlineInput.getCursor();
    const lastLine = this.inlineInput.getLines().length - 1;
    return {
      keybindings: this.keybindings,
      inputBuffer: this.inlineInput.getExpandedText?.() ?? this.inlineInput.getText(),
      canMoveInputUp: cursor.line > 0,
      canMoveInputDown: cursor.line < lastLine,
      questions: this.questions,
      isMulti: this.isMulti,
      currentItem: this.currentItem(),
      items: this.itemsByTab[this.state.currentTab] ?? [],
      collapseKey: this.collapseKey
    };
  }
  applyContext() {
    return {
      questions: this.questions,
      itemsByTab: this.itemsByTab
    };
  }
  currentItem() {
    const arr = this.itemsByTab[this.state.currentTab] ?? [];
    return this.state.optionIndex < arr.length ? arr[this.state.optionIndex] : undefined;
  }
  setOverlayHandle(handle) {
    this.overlayHandle = handle;
  }
  toggleCollapsedExternal() {
    if (!this.inputEditorOpen)
      this.commit({ kind: "toggle_collapsed" });
  }
}
export {
  QuestionnaireSession
};
