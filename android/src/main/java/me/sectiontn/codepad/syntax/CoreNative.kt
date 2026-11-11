package me.sectiontn.codepad.syntax

import com.facebook.proguard.annotations.DoNotStrip
import java.util.concurrent.ExecutorService
import java.util.concurrent.RejectedExecutionException

/** The core's C API through core_jni.cpp. Offsets are UTF-16 units; handles are native pointers as Long. */
internal object CoreNative {
  init {
    // JVM tests run on the host build of the core, which yarn host:treesitter writes.
    val host = System.getProperty("codepad.hostLib")
    if (host == null) {
      System.loadLibrary("codepad")
    } else {
      check(java.io.File(host).exists()) { "$host is missing: run yarn host:treesitter" }
      System.load(host)
    }
  }

  @JvmStatic external fun editorNew(host: Any, text: String, clock: Boolean, refOut: LongArray): Long
  @JvmStatic external fun editorFree(editor: Long, ref: Long)
  @JvmStatic external fun lockShared(editor: Long)
  @JvmStatic external fun unlockShared(editor: Long)
  @JvmStatic external fun docLength(editor: Long): Int
  @JvmStatic external fun docRevision(editor: Long): Int
  @JvmStatic external fun docLineCount(editor: Long): Int
  @JvmStatic external fun docLineStart(editor: Long, line: Int): Int
  @JvmStatic external fun docLineEnd(editor: Long, line: Int): Int
  @JvmStatic external fun docLineAt(editor: Long, offset: Int): Int
  @JvmStatic external fun docUnitAt(editor: Long, offset: Int): Char
  @JvmStatic external fun docText(editor: Long, start: Int, end: Int): String
  @JvmStatic external fun docPosition(editor: Long, offset: Int): Long
  @JvmStatic external fun docOffset(editor: Long, line: Int, column: Int): Int
  @JvmStatic external fun docGrapheme(editor: Long, offset: Int, forward: Boolean): Int
  @JvmStatic external fun editorSettings(editor: Long, tabSize: Int, spaces: Boolean, indent: Boolean, close: Boolean)
  @JvmStatic external fun editorReplace(editor: Long, start: Int, end: Int, text: String, origin: Int, typing: Boolean, caretAfter: Boolean)
  @JvmStatic external fun editorSetText(editor: Long, text: String, keepHistory: Boolean)
  @JvmStatic external fun editorInsert(editor: Long, text: String, origin: Int)
  @JvmStatic external fun editorType(editor: Long, text: String)
  @JvmStatic external fun editorCommand(editor: Long, command: Int): Boolean
  @JvmStatic external fun editorSetSelection(editor: Long, anchor: Int, head: Int)
  @JvmStatic external fun editorMove(editor: Long, unit: Int, forward: Boolean, extend: Boolean)
  @JvmStatic external fun editorSelectWordAt(editor: Long, offset: Int)
  @JvmStatic external fun editorDeletesPair(editor: Long, caret: Int): Boolean
  @JvmStatic external fun editorBeginGroup(editor: Long)
  @JvmStatic external fun editorEndGroup(editor: Long)
  @JvmStatic external fun editorSelectionDirty(editor: Long): Boolean
  @JvmStatic external fun editorSetSelectionDirty(editor: Long, dirty: Boolean)
  @JvmStatic external fun editorSelection(editor: Long): Long
  @JvmStatic external fun editorHistory(editor: Long): Int
  @JvmStatic external fun editorBracketMatch(editor: Long, snapshot: Long, caret: Int, out: IntArray): Boolean
  @JvmStatic external fun editorSetDecorations(editor: Long, items: IntArray, revision: Int): Boolean
  @JvmStatic external fun editorDecorations(editor: Long): IntArray
  @JvmStatic external fun editorDecorationsVersion(editor: Long): Int
  @JvmStatic external fun editorAttach(editor: Long, engine: Long)
  @JvmStatic external fun editorSetSearch(editor: Long, query: String, flags: Int, error: Array<String?>): Boolean
  @JvmStatic external fun editorClearSearch(editor: Long)
  @JvmStatic external fun editorSearchActive(editor: Long): Boolean
  @JvmStatic external fun editorSearchStale(editor: Long): Boolean
  @JvmStatic external fun editorMatchCount(editor: Long): Int
  @JvmStatic external fun editorMatches(editor: Long): IntArray
  @JvmStatic external fun editorFind(editor: Long, forward: Boolean, out: IntArray): Boolean
  @JvmStatic external fun editorReplaceCurrent(editor: Long, text: String): Boolean
  @JvmStatic external fun editorReplaceAll(editor: Long, text: String): Int
  @JvmStatic external fun editorAcceptMatches(editor: Long, revision: Int, pairs: IntArray): Boolean
  @JvmStatic external fun editorSearchQuery(editor: Long): Long
  @JvmStatic external fun searchRelease(search: Long)
  @JvmStatic external fun editorText(editor: Long): Long
  @JvmStatic external fun textRelease(text: Long)
  @JvmStatic external fun searchFind(search: Long, text: Long, from: Int, out: IntArray): Int

  @JvmStatic external fun abiRange(): IntArray
  @JvmStatic external fun languageLoad(id: String, pointer: Long, highlights: ByteArray, injections: ByteArray?, error: Array<String?>): Long
  @JvmStatic external fun languageId(language: Long): String
  @JvmStatic external fun styleId(name: String): Int
  @JvmStatic external fun styleName(id: Int): String
  @JvmStatic external fun engineNew(host: CoreHost, budgetMicros: Long): Long
  @JvmStatic external fun run(work: Long, arg: Long)
  @JvmStatic external fun engineSetLanguage(engine: Long, language: Long)
  @JvmStatic external fun engineSetText(engine: Long, text: String, revision: Int)
  @JvmStatic external fun engineEdit(engine: Long, start: Int, removed: Int, inserted: String, revision: Int, points: IntArray)
  @JvmStatic external fun engineRelease(engine: Long, snapshot: Long)
  @JvmStatic external fun engineClose(engine: Long)
  @JvmStatic external fun snapshotInfo(snapshot: Long, out: IntArray)
  @JvmStatic external fun snapshotChanged(snapshot: Long): IntArray
  @JvmStatic external fun snapshotLanguage(snapshot: Long): Long
  @JvmStatic external fun injectedCount(snapshot: Long): Int
  @JvmStatic external fun injectedGet(snapshot: Long, index: Int, out: IntArray): Long
  @JvmStatic external fun highlight(snapshot: Long, first: Int, last: Int, firstLineStart: Int, out: IntArray?): Int
  @JvmStatic external fun frame(snapshot: Long, first: Int, last: Int, firstLineStart: Int, applied: Int, useChanged: Boolean, entries: IntArray, out: IntArray?): Int
  @JvmStatic external fun shiftSpans(spans: IntArray, start: Int, removed: Int, inserted: Int, out: IntArray?): Int

  /** Only in the JVM host library: the TSLanguage pointer of a compiled-in grammar, 0 when absent. */
  @JvmStatic external fun hostLanguage(name: String): Long

  /** Calls a core entry point that writes ints, growing the buffer once when it is short. */
  inline fun fill(buffer: IntArray, call: (IntArray) -> Int): Pair<IntArray, Int> {
    val needed = call(buffer)
    if (needed <= buffer.size) return buffer to needed
    val grown = IntArray(needed)
    return grown to call(grown)
  }
}

/** The engine's platform side, called from core_jni.cpp by name: its worker, the main thread and its snapshots. */
@DoNotStrip
internal class CoreHost(
  private val executor: ExecutorService,
  private val postToMain: (Runnable) -> Unit,
  private val onSnapshot: (Long) -> Unit,
) {
  // Thrown by onSnapshot inside a core call, rethrown once the core returns so it never crosses native frames.
  private var failure: Throwable? = null

  @DoNotStrip
  fun schedule(work: Long, arg: Long) {
    try {
      executor.execute { CoreNative.run(work, arg) }
    } catch (_: RejectedExecutionException) {
    }
  }

  @DoNotStrip
  fun postMain(work: Long, arg: Long) = postToMain(Runnable {
    CoreNative.run(work, arg)
    failure?.let {
      failure = null
      throw it
    }
  })

  @DoNotStrip
  fun snapshot(pointer: Long) {
    try {
      onSnapshot(pointer)
    } catch (t: Throwable) {
      failure = t
    }
  }

  @DoNotStrip
  fun resolve(name: String): Long = LanguageRegistry.resolveInjection(name)?.handle ?: 0L
}
