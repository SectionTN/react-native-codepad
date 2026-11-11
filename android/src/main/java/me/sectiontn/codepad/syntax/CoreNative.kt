package me.sectiontn.codepad.syntax

import com.facebook.proguard.annotations.DoNotStrip
import java.util.concurrent.ExecutorService
import java.util.concurrent.RejectedExecutionException

/** The core's C API through core_jni.cpp. Offsets are UTF-16 units; handles are native pointers as Long. */
internal object CoreNative {
  init {
    if (System.getProperty("codepad.hostLib") == null) System.loadLibrary("codepad")
  }

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
