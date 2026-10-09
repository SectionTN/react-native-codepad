---
title: Nested in a ScrollView
description: An auto height editor inside a page that scrolls.
sidebar:
  order: 4
---

A form, a note, a snippet in a list: the editor sits in a page that scrolls and should not scroll on its own. Two props and one event do it.

```tsx
import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { CodeEditor } from 'react-native-codepad';

export function NotePage() {
  const [height, setHeight] = useState(120);
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <TextInput placeholder="Title" />
      <CodeEditor
        style={{ height }}
        language="markdown"
        softWrap
        scrollEnabled={false}
        onContentSizeChange={(e) => setHeight(Math.ceil(e.height))}
      />
      <TextInput placeholder="Tags" />
    </ScrollView>
  );
}
```

- `scrollEnabled={false}` makes the view never claim touch scrolling, so a drag over the editor scrolls the page. Taps, double taps, long presses and handle drags still work.
- `softWrap` keeps the content within the page width, since the editor no longer scrolls in either direction.
- `onContentSizeChange` reports the size at which nothing scrolls, `contentInsets` included, in dp. Feed its height back into `style` and the editor grows and shrinks with its text. The event fires after a draw whose content size changed, at most once per frame, the first time before `onReady`; with soft wrap an unmeasured line counts as one row, so a tall document converges over a few frames as lines measure. `Math.ceil` avoids a one pixel scroll from rounding.
- `keyboardShouldPersistTaps="handled"` on the page lets a tap on the editor place the caret without the page dismissing the keyboard first.

## Caret reveal is yours

The editor cannot scroll the page. When the caret moves below the fold, read `getCursorRect()` (view coordinates, dp) in `onSelectionChange`, add the editor's offset within the page from its `onLayout`, and `scrollTo` the page when the result is outside the visible band. The example app leaves this out on purpose: the right scroll target depends on your page.

```tsx
onSelectionChange={() => {
  const rect = editor.current?.getCursorRect();
  if (!rect) return;
  const y = editorTop + rect.y;
  if (y < pageScrollY || y + rect.height > pageScrollY + pageHeight) {
    page.current?.scrollTo({ y: y - pageHeight / 2, animated: true });
  }
}}
```

Leave `avoidKeyboard` off for an editor that does not scroll: an inset has nothing to move. Let the page handle the keyboard instead, with a `KeyboardAvoidingView` or keyboard-controller's `KeyboardAwareScrollView`.

## Keep nested documents small

A scrolling editor lays out the visible lines plus a margin and keeps the rest as row counts. An auto height editor shows everything, so every line is laid out and drawn. A few hundred lines is fine; a 10k line file belongs in a scrolling editor with a fixed height.
