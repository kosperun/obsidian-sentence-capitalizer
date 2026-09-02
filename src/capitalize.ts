import { EditorState, Text, Transaction } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { isolateHistory } from '@codemirror/commands';
import { ViewPlugin, ViewUpdate } from '@codemirror/view';

export const SENTENCE_END = /[.!?]["')\]]*\s+$/;
export const LIST_MARKER = /^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)$/;
export const BLOCKQUOTE_MARKER = /^\s*>+\s*$/;
export const WORD_TERMINATOR = /^[\s.,;:!?]$/;
export const WORD_CHAR = /[\p{L}\p{N}'’]/u;

export interface SentenceCapitalizerSettings {
	capitalizeListItems: boolean;
}

export const DEFAULT_SETTINGS: SentenceCapitalizerSettings = {
	capitalizeListItems: false,
};

export function shouldCapitalize(prefix: string, settings: SentenceCapitalizerSettings): boolean {
	if (prefix.length === 0) return true;
	if (SENTENCE_END.test(prefix)) return true;
	if (settings.capitalizeListItems && LIST_MARKER.test(prefix)) return true;
	if (BLOCKQUOTE_MARKER.test(prefix)) return true;
	return false;
}

export function isInsideCode(state: EditorState, pos: number): boolean {
	const tree = ensureSyntaxTree(state, pos, 500);
	if (!tree) return false;
	for (const side of [1, -1, 0] as const) {
		let node = tree.resolveInner(pos, side);
		while (node) {
			if (/code/i.test(node.type.name)) return true;
			node = node.parent as typeof node;
		}
	}
	return false;
}

/**
 * Given the transaction's changes, finds the position of a single
 * word-terminating character just inserted (space/punctuation, or a newline
 * possibly followed by auto-inserted list/blockquote continuation text).
 * Returns -1 if this transaction didn't insert a matching terminator.
 */
export function findInsertedTerminator(tr: Transaction): { insertedFrom: number; insertedChar: string } | null {
	let insertedFrom = -1;
	let insertedChar = '';

	tr.changes.iterChanges((fromA, toA, fromB, _toB, inserted) => {
		if (insertedFrom !== -1) return;
		const text = inserted.toString();
		if (fromA !== toA || text.length < 1) return;
		if (text.length === 1) {
			insertedFrom = fromB;
			insertedChar = text;
		} else if (text[0] === '\n') {
			insertedFrom = fromB;
			insertedChar = '\n';
		}
	});

	if (insertedFrom === -1 || !WORD_TERMINATOR.test(insertedChar)) return null;
	return { insertedFrom, insertedChar };
}

export function findWordStart(doc: Text, insertedFrom: number): number {
	const line = doc.lineAt(insertedFrom);
	let wordStart = insertedFrom;
	while (wordStart > line.from && WORD_CHAR.test(doc.sliceString(wordStart - 1, wordStart))) {
		wordStart--;
	}
	return wordStart;
}

export function makeCapitalizeOnWordEnd(getSettings: () => SentenceCapitalizerSettings) {
	return ViewPlugin.fromClass(
		class {
			update(update: ViewUpdate) {
				if (!update.docChanged) return;

				for (const tr of update.transactions) {
					if (!tr.docChanged) continue;
					if (tr.isUserEvent('undo') || tr.isUserEvent('redo') || tr.isUserEvent('input.paste')) continue;

					const found = findInsertedTerminator(tr);
					if (!found) continue;
					const { insertedFrom } = found;

					const doc = tr.newDoc;
					const wordStart = findWordStart(doc, insertedFrom);

					if (wordStart === insertedFrom) continue; // no word immediately before the terminator
					if (isInsideCode(tr.state, wordStart)) continue;

					const firstChar = doc.sliceString(wordStart, wordStart + 1);
					const upper = firstChar.toUpperCase();
					if (upper === firstChar) continue; // not a lowercase letter

					const line = doc.lineAt(insertedFrom);
					const prefix = doc.sliceString(line.from, wordStart);
					if (!shouldCapitalize(prefix, getSettings())) continue;

					const view = update.view;
					void Promise.resolve().then(() => {
						const state = view.state;
						if (wordStart + 1 > state.doc.length) return;
						if (state.sliceDoc(wordStart, wordStart + 1) !== firstChar) return;
						view.dispatch({
							changes: { from: wordStart, to: wordStart + 1, insert: upper },
							annotations: isolateHistory.of('full'),
						});
					});
				}
			}
		}
	);
}
