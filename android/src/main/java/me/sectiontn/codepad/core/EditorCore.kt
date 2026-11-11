package me.sectiontn.codepad.core

import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write
import me.sectiontn.codepad.syntax.CoreNative

/**
 * The editing state behind one editor, kept in the core: document, selection, history, decorations and search. Only
 * the main thread mutates it. Other threads read under [read]. [close] frees the core, on unmount or when a new core
 * replaces this one, since minSdk 24 has no Cleaner.
 */
class EditorCore(initialText: String = "", clock: (() -> Long)? = null) : AutoCloseable {
  private val host = EditorHost(clock)
  private val ref = LongArray(1)
  // Read held by every read {} and taken for write by close, so a reader never sees the handle freed under it.
  private val life = ReentrantReadWriteLock()
  @Volatile private var native: Long = CoreNative.editorNew(host, initialText, clock != null, ref)

  val document = Document(this)
  val undo = UndoManager(this)
  val decorations = DecorationSet(this)

  var settings = EditorSettings()
    set(value) {
      field = value
      CoreNative.editorSettings(handle(), value.tabSize, value.insertSpaces, value.autoIndent, value.autoCloseBrackets)
    }

  var onChange: ((Change, ChangeOrigin) -> Unit)? = null
  var onSelectionChange: ((Selection) -> Unit)? = null

  // The change the last edit reported, so the edit methods can return it.
  private var lastChange: Change? = null

  init {
    host.onChange = { change, origin ->
      lastChange = change
      onChange?.invoke(change, origin)
    }
    host.onSelection = { onSelectionChange?.invoke(it) }
    settings = settings
  }

  /** Any thread. */
  val selection: Selection
    get() {
      val packed = CoreNative.editorSelection(handle())
      return Selection((packed shr 32).toInt(), packed.toInt())
    }

  val canUndo: Boolean get() = CoreNative.editorHistory(handle()) and 1 != 0
  val canRedo: Boolean get() = CoreNative.editorHistory(handle()) and 2 != 0

  internal fun handle(): Long {
    val h = native
    check(h != 0L) { "the editor core is closed" }
    return h
  }

  /** Synchronous reads from another thread. Writers hold the lock only while the core swaps the text. */
  fun <T> read(block: () -> T): T = life.read {
    val h = handle()
    CoreNative.lockShared(h)
    try {
      block()
    } finally {
      CoreNative.unlockShared(h)
    }
  }

  override fun close() = life.write {
    val h = native
    if (h == 0L) return@write
    native = 0L
    CoreNative.editorFree(h, ref[0])
  }

  // A core call that may run the callbacks: what they threw surfaces here, after the core returned.
  private inline fun <T> mutate(block: (Long) -> T): T {
    val result = block(handle())
    host.rethrow()
    return result
  }

  fun replace(start: Int, end: Int, text: String, origin: ChangeOrigin = ChangeOrigin.Api): Change =
    applyChange(start, end, text, origin, typing = false, caretAfter = false)

  /**
   * Every mutation goes through here. [typing] marks single key input that may coalesce in the history.
   * [caretAfter] puts a collapsed caret after the inserted text instead of mapping the selection.
   */
  internal fun applyChange(start: Int, end: Int, text: String, origin: ChangeOrigin, typing: Boolean, caretAfter: Boolean): Change {
    lastChange = null
    mutate { CoreNative.editorReplace(it, start, end, text, origin.ordinal, typing, caretAfter) }
    return checkNotNull(lastChange)
  }

  fun insertText(text: String, origin: ChangeOrigin = ChangeOrigin.Api) =
    mutate { CoreNative.editorInsert(it, text, origin.ordinal) }

  /** A keyboard edit. The selection maps through the change like any edit. Single unit deletes coalesce like typed backspaces. */
  fun inputReplace(start: Int, end: Int, text: String, typing: Boolean = false): Change =
    applyChange(start, end, text, ChangeOrigin.Input, typing, caretAfter = false)

  fun setText(text: String, keepHistory: Boolean = false) = mutate { CoreNative.editorSetText(it, text, keepHistory) }

  /**
   * Replaces the decorations. [revision] is the document revision they were computed for, below zero for the current
   * one. False when the edits since then are no longer known, which keeps the current set.
   */
  fun setDecorations(items: List<Decoration>, revision: Int): Boolean = decorations.replace(items, revision)

  /** One code point at a time, through auto close and auto indent. */
  fun typeText(text: String) = mutate { CoreNative.editorType(it, text) }

  fun insertNewline() = command(CMD_NEWLINE)
  fun tab() = command(CMD_TAB)
  fun shiftTab() = command(CMD_SHIFT_TAB)
  fun indent() = command(CMD_INDENT)
  fun outdent() = command(CMD_OUTDENT)
  fun backspace() = command(CMD_BACKSPACE)
  fun delete() = command(CMD_DELETE)
  fun undo(): Boolean = command(CMD_UNDO)
  fun redo(): Boolean = command(CMD_REDO)
  fun selectAll() = command(CMD_SELECT_ALL)

  fun setSelection(anchor: Int, head: Int) = mutate { CoreNative.editorSetSelection(it, anchor, head) }

  fun move(unit: TextMovement.Unit, forward: Boolean, extend: Boolean) =
    mutate { CoreNative.editorMove(it, unit.ordinal, forward, extend) }

  fun selectWordAt(offset: Int) = mutate { CoreNative.editorSelectWordAt(it, offset) }

  /** True when a backspace at [caret] removes an auto closed pair. */
  fun deletesPair(caret: Int): Boolean = CoreNative.editorDeletesPair(handle(), caret)

  /** The bracket at the caret and its partner. A snapshot at the document revision skips strings and comments. */
  fun bracketMatch(snapshot: Long): IntArray? {
    val out = IntArray(2)
    return if (CoreNative.editorBracketMatch(handle(), snapshot, selection.head, out)) out else null
  }

  data class SearchHit(val index: Int, val total: Int)

  val searchActive: Boolean get() = CoreNative.editorSearchActive(handle())

  /** The matches as start and end pairs, computed on the calling thread when stale. */
  val matches: IntArray get() = CoreNative.editorMatches(handle())
  val matchCount: Int get() = CoreNative.editorMatchCount(handle())

  /** True while a query is active and its matches belong to an older revision. */
  val searchStale: Boolean get() = CoreNative.editorSearchStale(handle())

  /** An invalid regex throws IllegalArgumentException with PCRE2's message and clears the search. */
  fun setSearch(query: SearchQuery) {
    var flags = 0
    if (query.regex) flags = flags or SEARCH_REGEX
    if (query.caseSensitive) flags = flags or SEARCH_CASE
    if (query.wholeWord) flags = flags or SEARCH_WORD
    val error = arrayOfNulls<String>(1)
    if (!CoreNative.editorSetSearch(handle(), query.text, flags, error)) {
      throw IllegalArgumentException(error[0] ?: "invalid regex")
    }
  }

  fun clearSearch() = CoreNative.editorClearSearch(handle())

  /** Computes the matches on the calling thread when they are stale. */
  fun ensureMatches() {
    CoreNative.editorMatches(handle())
  }

  /** The compiled query for a worker, 0 without a search. The caller releases it with [Searcher.release]. */
  fun compiledSearch(): Long = CoreNative.editorSearchQuery(handle())

  /** The current text for a worker, unchanged by later edits. The caller releases it with [Searcher.releaseText]. */
  fun textSnapshot(): Long = CoreNative.editorText(handle())

  /** Stores matches computed elsewhere. False when the document moved on since [revision]. */
  fun acceptMatches(revision: Int, matches: IntArray): Boolean = CoreNative.editorAcceptMatches(handle(), revision, matches)

  fun findNext(): SearchHit? = find(true)

  fun findPrevious(): SearchHit? = find(false)

  fun replaceCurrent(text: String): Boolean = mutate { CoreNative.editorReplaceCurrent(it, text) }

  fun replaceAll(text: String): Int = mutate { CoreNative.editorReplaceAll(it, text) }

  /** Attaches the syntax engine, 0 to detach. A closed core has nothing to detach. */
  internal fun attach(engine: Long) {
    val h = native
    if (h != 0L) CoreNative.editorAttach(h, engine)
  }

  private fun find(forward: Boolean): SearchHit? {
    val out = IntArray(2)
    val found = mutate { CoreNative.editorFind(it, forward, out) }
    return if (found) SearchHit(out[0], out[1]) else null
  }

  private fun command(command: Int): Boolean = mutate { CoreNative.editorCommand(it, command) }

  private companion object {
    // CP_CMD_*.
    const val CMD_NEWLINE = 0
    const val CMD_TAB = 1
    const val CMD_SHIFT_TAB = 2
    const val CMD_INDENT = 3
    const val CMD_OUTDENT = 4
    const val CMD_BACKSPACE = 5
    const val CMD_DELETE = 6
    const val CMD_UNDO = 7
    const val CMD_REDO = 8
    const val CMD_SELECT_ALL = 9

    // CP_SEARCH_*.
    const val SEARCH_REGEX = 1
    const val SEARCH_CASE = 2
    const val SEARCH_WORD = 4
  }
}
