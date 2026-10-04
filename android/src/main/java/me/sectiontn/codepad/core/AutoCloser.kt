package me.sectiontn.codepad.core

object AutoCloser {
  sealed class Action {
    data class InsertPair(val text: String) : Action()
    object SkipCloser : Action()
    data class Wrap(val open: Char, val close: Char) : Action()
    object None : Action()
  }

  private val pairs = mapOf('(' to ')', '[' to ']', '{' to '}', '"' to '"', '\'' to '\'', '`' to '`')
  private const val ALLOWED_NEXT = ")]},;"

  fun isQuote(c: Char): Boolean = c == '"' || c == '\'' || c == '`'

  fun actionFor(doc: Document, sel: Selection, typed: Char, settings: EditorSettings): Action {
    if (!settings.autoCloseBrackets) return Action.None
    val closer = pairs[typed]
    if (!sel.isEmpty) return if (closer != null) Action.Wrap(typed, closer) else Action.None
    val caret = sel.head
    val next = if (caret < doc.length) doc.charAt(caret) else '\n'
    val prev = if (caret > 0) doc.charAt(caret - 1) else '\n'
    if (next == typed && (closer == null && pairs.containsValue(typed) || isQuote(typed))) return Action.SkipCloser
    if (closer == null) return Action.None
    val nextOk = next == '\n' || next.isWhitespace() || next in ALLOWED_NEXT
    val prevOk = !isQuote(typed) || !TextMovement.isWordChar(prev)
    return if (nextOk && prevOk) Action.InsertPair("$typed$closer") else Action.None
  }

  /** Backspace between an empty pair removes both characters. */
  fun deletesPair(doc: Document, caret: Int): Boolean {
    if (caret <= 0 || caret >= doc.length) return false
    return pairs[doc.charAt(caret - 1)] == doc.charAt(caret)
  }
}
