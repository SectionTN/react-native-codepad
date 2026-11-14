---
title: Nested in a ScrollView
description: An editor that grows with its text inside a page that scrolls.
sidebar_position: 4
---

When the editor is inside a page that scrolls, such as a form or a list of snippets, it can grow with its text instead of scrolling on its own. One prop and one event do that:

```tsx title="SnippetPage.tsx"
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

- `scrollEnabled={false}` leaves vertical drags to the page, so a drag over the editor scrolls the page. A mostly horizontal drag over lines wider than the editor scrolls them sideways. Taps, touch and hold, and handle drags still work.
- Add `softWrap` instead to wrap long lines to the page width. The editor then never scrolls sideways.
- `onContentSizeChange` reports the size at which nothing scrolls, insets included. Feed its height back into `style`. With `softWrap` on, the height of a long document settles over a few frames as the editor measures its lines. `Math.ceil` rounds the height up, so the editor never scrolls by a fraction of a pixel.
- `keyboardShouldPersistTaps="handled"` lets a tap place the caret without the page closing the keyboard first.

## Keep the caret on screen

The editor scrolls sideways to keep the caret in view, but it can't scroll the page. In `onSelectionChange`, read `getCursorRect()`, add the editor's position in the page from its `onLayout`, and scroll the page when the caret leaves the visible part:

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

Leave `avoidKeyboard` off here. An editor that doesn't scroll can't move its text above the keyboard, so let the page handle the keyboard with a `KeyboardAvoidingView` or the `KeyboardAwareScrollView` from react-native-keyboard-controller.

## Keep nested documents small

An editor that grows with its text lays out and draws every line. A few hundred lines are fine. A 10,000-line file belongs in a scrolling editor with a fixed height.
