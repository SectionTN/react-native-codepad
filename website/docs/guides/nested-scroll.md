---
title: Nested in a ScrollView
description: An auto height editor inside a page that scrolls.
sidebar_position: 4
---

A form, a note, a snippet in a list: sometimes the editor is inside a page that scrolls and must not scroll up and down on its own. One prop and one event do it.

```tsx
import { useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { CodeEditor } from 'react-native-codepad';

export function SnippetPage() {
  const [height, setHeight] = useState(120);
  return (
    <ScrollView keyboardShouldPersistTaps="handled">
      <TextInput placeholder="Title" />
      <CodeEditor
        style={{ height }}
        language="javascript"
        scrollEnabled={false}
        onContentSizeChange={(e) => setHeight(Math.ceil(e.height))}
      />
      <TextInput placeholder="Tags" />
    </ScrollView>
  );
}
```

- `scrollEnabled={false}` leaves vertical drags to the page, so a drag over the editor scrolls the page. A mostly horizontal drag over lines wider than the editor scrolls them sideways. Taps, long presses and handle drags still work.
- Add `softWrap` instead to wrap long lines within the page width. The editor then never scrolls sideways.
- `onContentSizeChange` reports the size at which nothing scrolls, insets included. Feed its height back into `style`. With soft wrap a tall document converges over a few frames as lines are measured, and `Math.ceil` avoids a one pixel scroll.
- `keyboardShouldPersistTaps="handled"` lets a tap place the caret without the page dismissing the keyboard first.

## Caret reveal is yours

The editor scrolls sideways to keep the caret in view, but it cannot scroll the page. In `onSelectionChange`, read `getCursorRect()` (view coordinates, in dp), add the editor's offset in the page from its `onLayout`, and scroll the page when the caret leaves the visible band:

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

Leave `avoidKeyboard` off here: an editor that does not scroll has nothing to inset. Let the page handle the keyboard with a `KeyboardAvoidingView` or keyboard-controller's `KeyboardAwareScrollView`.

## Keep nested documents small

An auto height editor lays out and draws every line. A few hundred lines is fine, a 10k line file belongs in a scrolling editor with a fixed height.
