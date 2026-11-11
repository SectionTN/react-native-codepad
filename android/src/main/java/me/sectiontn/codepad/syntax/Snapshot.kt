package me.sectiontn.codepad.syntax

/** One injected tree of a snapshot: its language, content extent, carried shift and how many ranges it covers. */
class Injected(val language: LoadedLanguage, val start: Int, val end: Int, val shift: Int, val ranges: Int)

/** Edit to snapshot time plus how many injected trees were parsed fresh, reused incrementally or carried without a parse. */
class ParseStats(val latencyMillis: Int, val freshInjections: Int, val reusedInjections: Int, val carriedInjections: Int)

/** The core engine a snapshot was published by, or 0 once it closed. Releasing goes through it. */
internal class EngineHandle(engine: Long) {
  private var engine = engine

  @get:Synchronized val pointer: Long get() = engine

  /** Frees on the engine's worker while it runs, here once it has closed. */
  @Synchronized
  fun release(snapshot: Long) = CoreNative.engineRelease(engine, snapshot)

  @Synchronized
  fun close() {
    if (engine != 0L) CoreNative.engineClose(engine)
    engine = 0L
  }
}

/** An immutable parse result for one document revision, owned by the core until [close]. */
class Snapshot internal constructor(val pointer: Long, private val owner: EngineHandle) : AutoCloseable {
  val revision: Int
  val languageId: String
  val stats: ParseStats
  // The published revision `changed` is relative to, -1 after a full parse; `changed` is sorted, coalesced unit pairs.
  val basedOn: Int
  val changed: IntArray
  /** The length of the text the snapshot was parsed from. */
  val length: Int
  private var closed = false

  init {
    val info = IntArray(8)
    CoreNative.snapshotInfo(pointer, info)
    revision = info[0]
    basedOn = info[1]
    stats = ParseStats(info[2], info[3], info[4], info[5])
    length = info[7]
    changed = CoreNative.snapshotChanged(pointer)
    languageId = CoreNative.languageId(CoreNative.snapshotLanguage(pointer))
  }

  /** The injected trees, sorted by start. */
  val injected: List<Injected>
    get() = (0 until CoreNative.injectedCount(pointer)).mapNotNull { i ->
      val out = IntArray(4)
      val language = LanguageRegistry.loaded(CoreNative.injectedGet(pointer, i, out)) ?: return@mapNotNull null
      Injected(language, out[0], out[1], out[2], out[3])
    }

  @Synchronized
  override fun close() {
    if (closed) return
    closed = true
    owner.release(pointer)
  }
}
