package me.sectiontn.codepad.syntax

import java.io.File
import org.junit.Assume.assumeTrue

object HostLib {
  private var loaded = false

  /** Skips the test when scripts/build-host-treesitter.sh has not produced the host library. */
  fun ensure() {
    val path = System.getProperty("codepad.hostLib")
    assumeTrue("host tree-sitter library missing, run yarn host:treesitter", path != null && File(path).exists())
    synchronized(this) {
      if (!loaded) {
        System.load(path)
        loaded = true
      }
    }
  }

  /** The grammar's TSLanguage pointer from the host library, skipping the test when it was not compiled in. */
  fun language(name: String): Long {
    ensure()
    val pointer = TreeSitterNative.hostLanguage(name)
    assumeTrue("$name grammar not in the host library", pointer != 0L)
    return pointer
  }

  fun javascript(): Long = language("javascript")
}
