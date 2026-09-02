import { describe, expect, it } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history, undo, redo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';

import {
	DEFAULT_SETTINGS,
	SentenceCapitalizerSettings,
	findWordStart,
	makeCapitalizeOnWordEnd,
	shouldCapitalize,
} from './capitalize';

// Flush the microtask queue the plugin uses to defer its follow-up dispatch.
async function flush() {
	await Promise.resolve();
	await Promise.resolve();
}

function makeView(settings: Partial<SentenceCapitalizerSettings> = {}) {
	const merged = { ...DEFAULT_SETTINGS, ...settings };
	const view = new EditorView({
		state: EditorState.create({
			doc: '',
			extensions: [history(), markdown(), makeCapitalizeOnWordEnd(() => merged)],
		}),
		parent: document.body,
	});
	return { view, settings: merged };
}

// Types a string one character at a time, as real keystrokes would arrive,
// each its own transaction with the cursor placed at the insertion point.
async function type(view: EditorView, text: string) {
	for (const ch of text) {
		const pos = view.state.doc.length;
		view.dispatch({
			changes: { from: pos, insert: ch },
			selection: EditorSelection.cursor(pos + 1),
			userEvent: 'input.type',
		});
		await flush();
	}
}

describe('shouldCapitalize', () => {
	const settingsOff: SentenceCapitalizerSettings = { capitalizeListItems: false };
	const settingsOn: SentenceCapitalizerSettings = { capitalizeListItems: true };

	it('capitalizes at the very start of the document', () => {
		expect(shouldCapitalize('', settingsOff)).toBe(true);
	});

	it('capitalizes after ". "', () => {
		expect(shouldCapitalize('Done. ', settingsOff)).toBe(true);
	});

	it('capitalizes after "! " and "? "', () => {
		expect(shouldCapitalize('Wait! ', settingsOff)).toBe(true);
		expect(shouldCapitalize('Really? ', settingsOff)).toBe(true);
	});

	it('capitalizes after sentence end followed by closing quote/paren', () => {
		expect(shouldCapitalize('He said "no." ', settingsOff)).toBe(true);
		expect(shouldCapitalize('(see above.) ', settingsOff)).toBe(true);
	});

	it('does not capitalize mid-sentence', () => {
		expect(shouldCapitalize('the quick brown ', settingsOff)).toBe(false);
	});

	it('capitalizes after a blockquote marker regardless of list setting', () => {
		expect(shouldCapitalize('> ', settingsOff)).toBe(true);
		expect(shouldCapitalize('>> ', settingsOff)).toBe(true);
	});

	it('respects the capitalizeListItems setting for dash/star/plus markers', () => {
		expect(shouldCapitalize('- ', settingsOff)).toBe(false);
		expect(shouldCapitalize('- ', settingsOn)).toBe(true);
		expect(shouldCapitalize('* ', settingsOn)).toBe(true);
		expect(shouldCapitalize('+ ', settingsOn)).toBe(true);
	});

	it('respects the capitalizeListItems setting for checkboxes and ordered lists', () => {
		expect(shouldCapitalize('- [ ] ', settingsOff)).toBe(false);
		expect(shouldCapitalize('- [ ] ', settingsOn)).toBe(true);
		expect(shouldCapitalize('1. ', settingsOn)).toBe(true);
		expect(shouldCapitalize('2) ', settingsOn)).toBe(true);
	});
});

describe('findWordStart', () => {
	it('finds the start of the word immediately before the given position', () => {
		const doc = EditorState.create({ doc: 'hello world' }).doc;
		expect(findWordStart(doc, 5)).toBe(0); // "hello| world"
		expect(findWordStart(doc, 11)).toBe(6); // "hello world|"
	});

	it('returns the same position when there is no preceding word char', () => {
		const doc = EditorState.create({ doc: '- ' }).doc;
		expect(findWordStart(doc, 2)).toBe(2);
	});
});

describe('capitalizeOnWordEnd (integration, real EditorView)', () => {
	it('capitalizes the first word of a document on space', async () => {
		const { view } = makeView();
		await type(view, 'hello ');
		expect(view.state.doc.toString()).toBe('Hello ');
	});

	it('capitalizes the first word of a sentence after ". "', async () => {
		const { view } = makeView();
		await type(view, 'Done. ok ');
		expect(view.state.doc.toString()).toBe('Done. Ok ');
	});

	it('capitalizes on Enter without a trailing space', async () => {
		const { view } = makeView();
		await type(view, 'hello');
		view.dispatch({
			changes: { from: view.state.doc.length, insert: '\n' },
			selection: EditorSelection.cursor(view.state.doc.length + 1),
			userEvent: 'input.type',
		});
		await flush();
		expect(view.state.doc.toString()).toBe('Hello\n');
	});

	it('does not touch a deliberately lowercase word mid-composition', async () => {
		const { view } = makeView();
		// Typing "ok" after "Done. " should not be touched until a terminator follows.
		await type(view, 'Done. ');
		view.dispatch({ changes: { from: view.state.doc.length, insert: 'o' }, userEvent: 'input.type' });
		await flush();
		expect(view.state.doc.toString()).toBe('Done. o');
	});

	it('does not capitalize list items by default', async () => {
		const { view } = makeView({ capitalizeListItems: false });
		await type(view, '- hello ');
		expect(view.state.doc.toString()).toBe('- hello ');
	});

	it('capitalizes list items when the setting is enabled', async () => {
		const { view } = makeView({ capitalizeListItems: true });
		await type(view, '- hello ');
		expect(view.state.doc.toString()).toBe('- Hello ');
	});

	it('capitalizes after a blockquote marker regardless of the list setting', async () => {
		const { view } = makeView({ capitalizeListItems: false });
		await type(view, '> hello ');
		expect(view.state.doc.toString()).toBe('> Hello ');
	});

	it('does not capitalize inside a fenced code block', async () => {
		const { view } = makeView();
		await type(view, '```\n');
		await type(view, 'hello ');
		expect(view.state.doc.toString()).toBe('```\nhello ');
	});

	it('does not capitalize inside inline code', async () => {
		const { view } = makeView();
		await type(view, 'Done. `hello ');
		expect(view.state.doc.toString()).toBe('Done. `hello ');
	});

	it('resumes capitalizing normal text after a code block closes', async () => {
		const { view } = makeView();
		await type(view, '```\ncode\n```\n\n');
		await type(view, 'hello ');
		expect(view.state.doc.toString()).toBe('```\ncode\n```\n\nHello ');
	});

	it('undo restores just the lowercase letter, keeping the rest of the word and the space', async () => {
		const { view } = makeView();
		await type(view, 'hello ');
		expect(view.state.doc.toString()).toBe('Hello ');

		undo(view);
		expect(view.state.doc.toString()).toBe('hello ');

		// A second undo removes the rest of the typed word/space as its own step.
		undo(view);
		expect(view.state.doc.toString()).not.toBe('hello ');
	});

	it('redo re-applies the capitalization after undoing it', async () => {
		const { view } = makeView();
		await type(view, 'hello ');
		expect(view.state.doc.toString()).toBe('Hello ');

		undo(view);
		expect(view.state.doc.toString()).toBe('hello ');

		redo(view);
		expect(view.state.doc.toString()).toBe('Hello ');
	});
});
