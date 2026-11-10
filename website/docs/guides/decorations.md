---
title: Decorations
description: How to underline ranges, open a gap under a line for a note view, tint lines, and keep them on the right text through edits.
sidebar_position: 5.5
---

Decorations mark code without changing it: an underline on a range, a gap of empty rows under a line, or a tint over a line. You pass them as one array in the `decorations` prop, and the native engine keeps each one on its text through every edit until the next array arrives.

## Underlines

An underline takes a range, a color and an optional style:

```tsx
const MARKS: Decoration[] = [
  { kind: 'underline', range: { start: 120, end: 131 }, color: '#C8322B', thickness: 2 },
  { kind: 'underline', range: { start: 204, end: 210 }, color: '#B8730E', style: 'wavy' },
];

<CodeEditor decorations={MARKS} initialValue={code} />;
```

An underline is solid, 1 dp thick and 2 dp below the baseline by default. `offset` moves it further down and `thickness` sets the stroke width, both in dp. Colors take the same strings as a [theme](/guides/themes/), so pick the light or dark value the way you pick the theme.

A range outside the document is clamped to it, and an underline with nothing left is dropped. A color that does not parse drops its item.

## Results from a checker

A checker usually runs after the user stops typing and answers later, when the text might have changed again. Pass the revision the result was computed for as `decorationsRevision`, and the editor maps the array through the edits made since then:

```tsx
const editor = useRef<CodeEditorRef>(null);
const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
const [marks, setMarks] = useState({ items: [] as Decoration[], revision: -1 });

const onChange = () => {
  clearTimeout(timer.current);
  timer.current = setTimeout(async () => {
    const ed = editor.current;
    if (!ed) return;
    const revision = ed.getRevision();
    const items = await check(ed.getText());
    setMarks({ items, revision });
  }, 300);
};

<CodeEditor
  ref={editor}
  decorations={marks.items}
  decorationsRevision={marks.revision}
  onChange={onChange}
/>;
```

Here `check` is your own checker, returning `Decoration[]` for the text it was given. Read the text and the revision together, before the first `await`, so they describe the same document.

The editor keeps the last 256 edits. A result older than that is ignored and the current decorations stay. Without `decorationsRevision`, the array is taken as computed for the current text.

A new array replaces the whole set, so build it when the result changes and keep the same array between renders.

## A note under a line

A gap opens whole rows of empty space under a line, and your app draws its own view there. Gap rows count in the content height and in `onContentSizeChange`, and they scroll with the text. They have no line number, and a tap or an arrow key never puts the caret in one.

`onGapLayout` reports every gap's rectangle in the editor's view coordinates, the same ones `getCursorRect()` uses. Put the editor and the note in one parent so they share an origin:

```tsx
const GAPS: Decoration[] = [{ kind: 'gap', line: 4, rows: 2 }];

function Editor({ code }: { code: string }) {
  const [note, setNote] = useState<Rect | null>(null);
  return (
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <CodeEditor
        style={{ flex: 1 }}
        initialValue={code}
        decorations={GAPS}
        onGapLayout={(e) => setNote(e.gaps[0]?.rect ?? null)}
      />
      {note && (
        <View
          style={{
            position: 'absolute',
            top: note.y,
            left: note.x,
            width: note.width,
            height: note.height,
          }}
        >
          <Text>Expected a semicolon at the end of this line.</Text>
        </View>
      )}
    </View>
  );
}
```

A gap spans the full width of the editor and is `rows` rows tall. Gaps on the same line add up. `getGapRect(line)` returns the same rectangle from the last frame, or `null` when the line has no gap.

:::caution
`onGapLayout` fires after the frame that moved a gap. When the user scrolls or edits above the gap, the note trails the text by one frame, while the gap itself moves with its line.
:::

## Line backgrounds

A line background tints every row of its line, but not the line's gap:

```tsx
const TINT: Decoration[] = [{ kind: 'lineBackground', line: 4, color: '#FAE8E6' }];
```

It draws over the active line highlight and under search matches and the selection. The caret's line shows the tint too. Several backgrounds on one line draw in array order.

## How decorations follow edits

The editor maps the decorations in the same frame as the text, for typing, the keyboard's suggestions, undo and ref methods alike.

- Typing inside an underline extends it. Typing at either edge leaves it as it is.
- Replacing exactly the underlined text keeps the underline on the new text, so an autocorrected word or a picked suggestion keeps its underline.
- Deleting exactly the underlined text removes the underline, and so does a paste over a larger region.
- An edit across one edge of an underline keeps the part of the original text that is left.
- A gap or a line background stays with its line. Typing at the end of the line keeps it, Enter at the very end opens the new line below the gap, and Enter in the middle moves it under the second half.
- Backspace at the start of a line joins it to the previous line, and their gaps add up. Deleting a line removes its gap, and `onGapLayout` reports that so your note can go away.
- `setText()` clears the decorations, and an array computed before it is ignored.
