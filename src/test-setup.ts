// jsdom does not implement text layout measurement, which CodeMirror's
// EditorView uses for scrolling/line-wrapping. Stub it so the view can be
// constructed and dispatched to in tests without throwing on rAF-scheduled
// measurement passes.
function emptyRectList(): DOMRectList {
	const list: DOMRect[] = [];
	return Object.assign(list, { item: (index: number) => list[index] ?? null });
}

function emptyRect(): DOMRect {
	return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) };
}

if (typeof Range !== 'undefined') {
	Range.prototype.getClientRects = emptyRectList;
	Range.prototype.getBoundingClientRect = emptyRect;
}
if (typeof Element !== 'undefined') {
	Element.prototype.getBoundingClientRect = emptyRect;
}
