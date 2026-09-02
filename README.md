# Sentence Capitalizer

A tiny Obsidian plugin that fixes one specific annoyance: forgetting Shift when starting a new sentence.

When you finish typing a word — by pressing space, a punctuation mark, or Enter — its first letter is capitalized if
that word starts a sentence. This mirrors Word/LibreOffice: nothing happens while you're still composing the word,
so you're always free to type a deliberate lowercase letter there, correction only happens once, on the word-ending keystroke.

The capitalize edit is dispatched as its own, history-isolated transaction, so a single `Cmd/Ctrl+Z` right after it undoes just the capitalization —
restoring your lowercase letter — without touching the rest of the word or the space/punctuation after it. A second undo then removes the rest of the
word as its own step.

## What counts as "start of a sentence"

- The very start of the note
- The very start of a line
- Right after `.`, `!`, or `?` (optionally followed by closing quotes/brackets) and whitespace
- Right after a blockquote marker (`>`, `>>`, ...)
- Right after a list marker (`-`, `*`, `+`, `1.`, `1)`, including `- [ ]` checkboxes) — **off by default**, enable "Capitalize list items" in the plugin's settings

Code blocks and inline code spans are never touched, detected via Obsidian's own syntax tree rather than pattern-matching.

## Project layout

- `src/capitalize.ts` — the actual behavior: the capitalization rules and the CodeMirror `ViewPlugin` that applies them.
 Has no dependency on the `obsidian` package, so it's testable in isolation.
- `src/main.ts` — the Obsidian `Plugin` subclass: settings storage and the settings tab UI, wiring `capitalize.ts` into the editor.

## Install (manual)

```
npm install --legacy-peer-deps
npm run build
```

(`--legacy-peer-deps` is needed because the `obsidian` types package pins an exact peer version of `@codemirror/state` that's older than what
`@codemirror/commands` requires — a dev-tooling-only conflict; Obsidian itself supplies one consistent set of CodeMirror packages at runtime.)

Copy `manifest.json` and `main.js` into `<vault>/.obsidian/plugins/sentence-capitalizer/`, then enable the plugin in Obsidian's Community Plugins settings.

## Tests

```
npm run test
```

Runs against a real CodeMirror `EditorState`/`EditorView` (jsdom), simulating actual keystroke-by-keystroke typing, Enter, and undo/redo — not just the pure
decision logic in isolation, since most of the interesting bugs here were in how transactions and history interact.
