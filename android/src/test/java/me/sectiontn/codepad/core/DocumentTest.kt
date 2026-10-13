package me.sectiontn.codepad.core

import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.concurrent.thread
import org.junit.Test

class DocumentTest {
  // The view reads on the main thread without the lock while the JS thread and the search job read under it,
  // so a reader that rebuilds the line starts tears the table for the other one.
  @Test
  fun aLockedReaderSeesWholeLineStartsWhileTheWriterThreadReadsUnlocked() {
    val core = EditorCore("let a = 1;\n".repeat(3000))
    val stop = AtomicBoolean(false)
    val failure = AtomicReference<Throwable?>(null)
    val reader = thread {
      try {
        while (!stop.get()) {
          core.read {
            val doc = core.document
            val text = doc.text()
            check(text.length == doc.length) { "text of ${text.length} units in a document of ${doc.length}" }
            val probe = doc.length / 2
            val p = doc.offsetToPosition(probe)
            val back = doc.positionToOffset(p.line, p.column)
            check(back == probe) { "offset $probe maps to $p and back to $back" }
          }
        }
      } catch (t: Throwable) {
        failure.compareAndSet(null, t)
      }
    }
    val deadline = System.nanoTime() + 400_000_000L
    var i = 0
    while (System.nanoTime() < deadline && failure.get() == null) {
      val at = (i * 7919) % core.document.length
      core.replace(at, at, if (i % 8 == 0) "\n" else "x")
      // The view's layout pass: an unlocked read right after the edit.
      core.document.lineAt(core.selection.head)
      i++
    }
    stop.set(true)
    reader.join()
    failure.get()?.let { throw it }
  }
}
