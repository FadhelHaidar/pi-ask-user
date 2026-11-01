import { DynamicBorder, type Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Container, CURSOR_MARKER, type Editor, Spacer } from "@earendil-works/pi-tui";
import type { QuestionnaireState } from "../state/state.js";
import type { QuestionData } from "../tool/types.js";
import type { PreviewPaneProps } from "./components/preview/preview-pane.js";
import type { TabBar } from "./components/tab-bar.js";
import type { StatefulView } from "./stateful-view.js";
import { computeScrollStart, decorateOverflow } from "./scroll-window.js";
import type { TabComponents } from "./tab-components.js";
import { QuestionTabStrategy, SubmitTabStrategy, type TabContentStrategy } from "./tab-content-strategy.js";

export {
	COLLAPSED_HINT_TEMPLATE,
	HINT_MULTI,
	HINT_PART_CANCEL,
	HINT_PART_CLEAR,
	HINT_PART_COLLAPSE,
	HINT_PART_COLLAPSE_TEMPLATE,
	HINT_PART_ENTER,
	HINT_PART_EXPAND_TEMPLATE,
	HINT_PART_NAV,
	HINT_PART_NEW_LINE,
	HINT_PART_NOTES,
	HINT_PART_NOTES_TEMPLATE,
	HINT_PART_TAB,
	HINT_PART_TOGGLE,
	HINT_SINGLE,
	INCOMPLETE_WARNING_PREFIX,
	KEY_PLACEHOLDER,
	READY_PROMPT,
	REVIEW_HEADING,
	SAVED_NOTE_LABEL,
} from "./dialog-copy.js";

/** No-overflow path: append the residual spacer rows after the footer. */
function renderFitsTerminal(natural: string[], spacerRows: number): string[] {
	return spacerRows > 0 ? [...natural, ...Array<string>(spacerRows).fill("")] : natural;
}

/** Terminal too small for any middle content — show just chrome, hard-clamped to termRows. */
function renderChromeOnly(natural: string[], topFixed: number, bottomFixed: number, termRows: number): string[] {
	const chromeOnly = [...natural.slice(0, topFixed), ...natural.slice(natural.length - bottomFixed)];
	return chromeOnly.length > termRows ? chromeOnly.slice(0, termRows) : chromeOnly;
}

/**
 * Rows the body must keep for the heading to stay pinned: below this the pinned heading would
 * leave no usable option window, so the heading scrolls with the body instead.
 */
const MIN_SCROLL_ROWS_WITH_PINNED_HEADING = 3;

export type DialogState = QuestionnaireState;

/** Per-tick projection of dialog state. Written by the adapter; read by the strategy thunk. */
export interface DialogProps {
	state: DialogState;
	activePreviewPane: StatefulView<PreviewPaneProps>;
}

/** Construction-time config for `DialogView`. Frozen after construction. */
export interface DialogConfig {
	theme: Theme;
	questions: readonly QuestionData[];
	tabBar: TabBar | undefined;
	notesInput: Editor;
	isMulti: boolean;
	tabsByIndex: ReadonlyArray<TabComponents>;
	/** Optional so single-question mode and non-submit tests can omit it; SubmitTabStrategy falls back to Spacer rows. */
	submitPicker?: Component;
	/** Worst-case body height across all tabs/options. Determines the stable overall dialog footprint. */
	getBodyHeight: (width: number) => number;
	/** Body height of the CURRENTLY active tab/option. The chrome subtracts this from `getBodyHeight` to absorb the residual OUTSIDE the bordered region. */
	getCurrentBodyHeight: (width: number) => number;
	/** Terminal height getter. Mirrors `getTerminalWidth` — reads `tui.terminal.rows` at render time. */
	getTerminalRows: () => number;
	/**
	 * Resolved collapse/expand key spec (`resolveCollapseKey` output: `"ctrl+]"`,
	 * `"alt+o"`, or `"off"`). Construction-time config, NOT canonical state —
	 * `QuestionnaireRuntime.collapseKey` must never reach view setProps consumers.
	 * The footer hint interpolates it, and drops the collapse part when `"off"`.
	 */
	collapseKey: string;
	/** Resolved notes key (`resolveNotesKey` output), named by both tabs' notes hints. */
	notesKey: string;
}

/**
 * The 7th renderable, promoted from a structural literal to a named class so
 * all view-layer components share one explicit `implements StatefulView<P>`
 * contract. `setProps(DialogProps)` writes the live cell read by the
 * strategy thunk during `render()`. `liveProps.activePreviewPane` is a
 * resolved pane reference threaded by the adapter per tick — the dialog
 * itself does not derive it.
 */
export class DialogView implements StatefulView<DialogProps> {
	private liveProps: DialogProps;
	private readonly config: DialogConfig;
	private readonly questionStrategy: TabContentStrategy;
	private readonly submitStrategy: TabContentStrategy | undefined;
	private readonly maxFooterRowCount: number;

	constructor(config: DialogConfig, initialProps: DialogProps) {
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
			collapseKey: config.collapseKey,
			notesKey: config.notesKey,
		});
		this.submitStrategy = config.isMulti
			? new SubmitTabStrategy({
					theme: config.theme,
					questions: config.questions,
					submitPicker: config.submitPicker,
					notesInput: config.notesInput,
					notesKey: config.notesKey,
				})
			: undefined;
		this.maxFooterRowCount = Math.max(this.questionStrategy.footerRowCount, this.submitStrategy?.footerRowCount ?? 0);
	}

	setProps(props: DialogProps): void {
		this.liveProps = props;
	}

	handleInput(_data: string): void {}

	// Invalidation is driven by `QuestionnairePropsAdapter.invalidate()`, which
	// owns the full set of renderables (binding registries + extras like
	// `notesInput`). DialogView has no cached layout of its own.
	invalidate(): void {}

	render(width: number): string[] {
		const state = this.liveProps.state;
		const onSubmit = this.config.isMulti && state.currentTab === this.config.questions.length;
		const strategy = onSubmit && this.submitStrategy ? this.submitStrategy : this.questionStrategy;

		// Cache heading rows (avoid double construction in render and container build).
		const headingRowCache = strategy.headingRows(state);
		// Rendered rows, not components: a long question wraps.
		const headingHeight = headingRowCache.reduce((rows, c) => rows + c.render(width).length, 0);

		// Build container WITHOUT residual spacer — spacer handled below based on overflow.
		// Built once: the mid rows both render AND shrink the residual spacer, so a saved-note
		// row cannot make one tab taller than the others (#197).
		const midRows = strategy.midRows(state);
		const natural = this.buildContainerFromStrategy(strategy, headingRowCache, midRows).render(width);

		// Fixed region sizes (deterministic from structure).
		// TabBar.render() returns [tabLine, ""] — always 2 rows.
		const topFixed = 1 + (this.config.isMulti && this.config.tabBar ? 2 : 0) + 1;
		const bottomFixed = 1 + strategy.footerRowCount;

		// Residual spacer: equalizes total height across tabs (only needed when no overflow).
		const spacerRows = Math.max(
			0,
			this.config.getBodyHeight(width) +
				this.maxFooterRowCount -
				strategy.bodyHeight(width, state) -
				strategy.footerRowCount -
				// Only the resting saved-note row is a real offset: the notes editor replaces
				// body content, so its rows are allowed to grow the dialog (NFR-2).
				(state.notesVisible ? 0 : midRows.length),
		);

		const termRows = this.config.getTerminalRows();

		// The spacer is padding for a stable cross-tab footprint, not content: when only the
		// padding overflows, clamp it rather than entering the scroll partition, which assumes
		// the middle region itself is longer than the window (#260).
		if (natural.length <= termRows) {
			return renderFitsTerminal(natural, Math.min(spacerRows, termRows - natural.length));
		}

		// OVERFLOW — apply 3-region partition with scroll-to-focus. The heading joins the fixed
		// top whenever the body keeps a usable window, so the question being answered never
		// scrolls out of view — the host clips an inline mount from the bottom.
		const pinHeading = termRows - topFixed - headingHeight - bottomFixed >= MIN_SCROLL_ROWS_WITH_PINNED_HEADING;
		const top = pinHeading ? topFixed + headingHeight : topFixed;
		const rowsBeforeBody = pinHeading ? 0 : headingHeight;
		const middleRows = natural.length - top - bottomFixed;
		const availableMiddle = Math.max(0, termRows - top - bottomFixed);
		if (availableMiddle === 0) {
			return renderChromeOnly(natural, top, bottomFixed, termRows);
		}

		// Never slice past the middle region into the bottom-fixed rows, which are appended
		// below (#260).
		const windowRows = Math.min(availableMiddle, middleRows);
		const optionFocus = strategy.focusedItemRowRange(width, state);
		// While the notes editor is open it is the keyboard's target, so the window follows it
		// (it sits at the end of the middle region) rather than the focused option. Measured in
		// rendered rows, not components: the editor draws its own borders and one row per line,
		// so a multiline note is taller than the three components it is built from (#317).
		const notesRows = midRows.reduce((rows, component) => rows + component.render(width).length, 0);
		const notesStart = Math.max(0, middleRows - notesRows);
		let focusInMiddle: [number, number] | undefined;
		if (state.notesVisible && notesRows > 0) {
			const cursorRow =
				notesRows <= windowRows
					? -1
					: natural
							.slice(top, top + middleRows)
							.findIndex((line, i) => i >= notesStart && line.includes(CURSOR_MARKER));
			focusInMiddle = cursorRow === -1 ? [notesStart, middleRows] : [cursorRow, cursorRow + 1];
		} else if (optionFocus) {
			focusInMiddle = [rowsBeforeBody + optionFocus[0], rowsBeforeBody + optionFocus[1]];
		}
		const scrollStart = computeScrollStart(focusInMiddle, 0, windowRows, middleRows);
		const scrollableMiddle = natural.slice(top + scrollStart, top + scrollStart + windowRows);
		// The focused item is never drawn over by an overflow arrow (#261).
		const focusInWindow: [number, number] | undefined = focusInMiddle && [
			focusInMiddle[0] - scrollStart,
			focusInMiddle[1] - scrollStart,
		];
		decorateOverflow(
			scrollableMiddle,
			scrollStart > 0,
			scrollStart + windowRows < middleRows,
			this.config.theme,
			focusInWindow,
		);

		const result = [...natural.slice(0, top), ...scrollableMiddle, ...natural.slice(natural.length - bottomFixed)];
		// Safety: never exceed terminal rows (covers the availableMiddle === 0 case
		// where topFixed + bottomFixed > termRows).
		return result.length > termRows ? result.slice(0, termRows) : result;
	}

	private buildContainerFromStrategy(
		strategy: TabContentStrategy,
		headingRowCache: Component[],
		midRows: Component[],
	): Container {
		const { theme, isMulti, tabBar } = this.config;
		const state = this.liveProps.state;
		const container = new Container();
		const border = () => new DynamicBorder((s) => theme.fg("accent", s));

		container.addChild(border());
		if (isMulti && tabBar) container.addChild(tabBar);
		container.addChild(new Spacer(1));

		for (const c of headingRowCache) container.addChild(c);
		container.addChild(strategy.bodyComponent(state));
		container.addChild(new Spacer(1));
		for (const c of midRows) container.addChild(c);

		container.addChild(border());
		for (const c of strategy.footerRows(state)) container.addChild(c);

		// BodyResidualSpacer moved out of Container — handled in render().
		return container;
	}
}
