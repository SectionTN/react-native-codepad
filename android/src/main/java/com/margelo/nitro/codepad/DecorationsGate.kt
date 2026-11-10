package com.margelo.nitro.codepad

/** Skips a decorations prop that repeats both the last array and its revision, like the iOS binding. */
internal class DecorationsGate {
  private var items: Array<NativeDecoration>? = null
  private var revision = Int.MIN_VALUE

  // Re-applying an equal array for the same revision would put mapped offsets back where they were.
  fun admit(next: Array<NativeDecoration>?, nextRevision: Int, force: Boolean = false): Boolean {
    if (!force && next contentEquals items && nextRevision == revision) return false
    items = next
    revision = nextRevision
    return true
  }
}
