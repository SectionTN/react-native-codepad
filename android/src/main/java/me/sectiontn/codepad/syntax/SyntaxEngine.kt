package me.sectiontn.codepad.syntax

import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import me.sectiontn.codepad.core.EditorCore

/**
 * One parse engine per editor, run by the shared C++ core on this object's single thread. Edits arrive in
 * order, each reparse is incremental, and every completed parse publishes an immutable snapshot.
 */
class SyntaxEngine(
  postToMain: (Runnable) -> Unit,
  onSnapshot: (Snapshot) -> Unit,
  budgetMicros: Long = 50_000L,
  private val executor: ExecutorService = Executors.newSingleThreadExecutor { r -> Thread(r, "codepad-syntax").apply { isDaemon = true } },
) : AutoCloseable {
  private lateinit var handle: EngineHandle
  private var attached: EditorCore? = null

  init {
    val host = CoreHost(executor, postToMain) { pointer ->
      // The final post after close carries no snapshot: the worker is free to stop.
      if (pointer == 0L) executor.shutdown() else onSnapshot(Snapshot(pointer, handle))
    }
    handle = EngineHandle(CoreNative.engineNew(host, budgetMicros))
  }

  /** Test access to the core engine. */
  internal val pointer: Long get() = handle.pointer

  fun setLanguage(id: String?) {
    val language = id?.let { LanguageRegistry.resolve(it) }
    val engine = handle.pointer
    if (engine != 0L) CoreNative.engineSetLanguage(engine, language?.handle ?: 0L)
  }

  /**
   * Main thread. The engine parses the core's current text, then every edit the core makes, and drops the
   * snapshots of the previous attach. Null detaches.
   */
  fun attach(core: EditorCore?) {
    attached?.attach(0L)
    attached = core
    val engine = handle.pointer
    if (core != null && engine != 0L) core.attach(engine)
  }

  /** Frees a snapshot the view replaced on the worker, so the main thread never frees the trees. */
  fun release(snapshot: Snapshot) = snapshot.close()

  override fun close() {
    attach(null)
    handle.close()
  }
}
