package me.sectiontn.codepad.syntax

import java.io.File
import org.junit.Assert.assertTrue

object HostLib {
  private var loaded = false

  /** Fails the test when scripts/build-host-treesitter.sh has not produced the host library. */
  fun ensure() {
    val path = System.getProperty("codepad.hostLib")
    assertTrue("host tree-sitter library missing, run yarn host:treesitter", path != null && File(path).exists())
    synchronized(this) {
      if (!loaded) {
        System.load(path)
        loaded = true
      }
    }
  }

  /** The grammar's TSLanguage pointer from the host library, failing the test when it was not compiled in. */
  fun language(name: String): Long {
    ensure()
    val pointer = TreeSitterNative.hostLanguage(name)
    assertTrue("$name grammar not in the host library", pointer != 0L)
    return pointer
  }

  fun javascript(): Long = language("javascript")
}
