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

  fun javascript(): Long {
    ensure()
    val pointer = TreeSitterNative.hostLanguage("javascript")
    assumeTrue("javascript grammar not in the host library", pointer != 0L)
    return pointer
  }
}
