---
title: Nested in a ScrollView
description: An auto height editor inside a page that scrolls.
sidebar_position: 4
---

A form, a note, a snippet in a list: the editor sits in a page that scrolls and must not scroll on its own. Two props and one event do it.

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

- `scrollEnabled={false}`: the view never claims touch scrolling, so a drag over it scrolls the page. Taps, long presses and handle drags still work.
- `softWrap` keeps the content within the page width.
- `onContentSizeChange` reports the size at which nothing scrolls, insets included. Feed its height back into `style`. With soft wrap a tall document converges over a few frames as lines measure; `Math.ceil` avoids a one pixel scroll.
- `keyboardShouldPersistTaps="handled"` lets a tap place the caret without the page dismissing the keyboard first.

## Caret reveal is yours

The editor cannot scroll the page. In `onSelectionChange`, read `getCursorRect()` (view coordinates, dp), add the editor's offset in the page from its `onLayout`, and scroll the page when the caret leaves the visible band:

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

An auto height editor lays out and draws every line. A few hundred lines is fine; a 10k line file belongs in a scrolling editor with a fixed height.
