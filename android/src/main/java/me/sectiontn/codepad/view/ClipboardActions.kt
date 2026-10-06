package me.sectiontn.codepad.view

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import me.sectiontn.codepad.core.ChangeOrigin
import me.sectiontn.codepad.core.EditorCore

/** Cut, copy and paste between a core and the system clipboard as plain text. */
internal class ClipboardActions(private val context: Context) {
  private val manager = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager

  fun text(): String? {
    val clip = manager.primaryClip ?: return null
    if (clip.itemCount == 0) return null
    return clip.getItemAt(0).coerceToText(context)?.toString()?.takeIf { it.isNotEmpty() }
  }

  /** False when nothing is selected. */
  fun copy(core: EditorCore): Boolean {
    val sel = core.selection
    if (sel.isEmpty) return false
    manager.setPrimaryClip(ClipData.newPlainText("text", core.document.text(sel.min, sel.max)))
    return true
  }

  fun cut(core: EditorCore, origin: ChangeOrigin) {
    if (!copy(core)) return
    val sel = core.selection
    if (origin == ChangeOrigin.Api) core.replace(sel.min, sel.max, "", origin) else core.delete()
  }

  /** False when the clipboard holds no text. */
  fun paste(core: EditorCore, origin: ChangeOrigin): Boolean {
    val text = text() ?: return false
    core.insertText(text, origin)
    return true
  }
}
