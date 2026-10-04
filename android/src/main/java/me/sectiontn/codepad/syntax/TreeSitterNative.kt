package me.sectiontn.codepad.syntax

internal object TreeSitterNative {
  init {
    // JVM tests load the host build through System.load before touching this object.
    if (System.getProperty("codepad.hostLib") == null) System.loadLibrary("codepad")
  }

  @JvmStatic external fun parserNew(): Long
  @JvmStatic external fun parserDelete(parser: Long)
  @JvmStatic external fun parserSetLanguage(parser: Long, language: Long): Boolean
  @JvmStatic external fun parserReset(parser: Long)
  @JvmStatic external fun parserSetIncludedRanges(parser: Long, ranges: IntArray?): Boolean
  @JvmStatic external fun parserParse(parser: Long, oldTree: Long, mirror: Long, flag: Long, budgetMicros: Long): Long
  @JvmStatic external fun flagNew(): Long
  @JvmStatic external fun flagSet(flag: Long, value: Boolean)
  @JvmStatic external fun flagDelete(flag: Long)
  @JvmStatic external fun treeDelete(tree: Long)
  @JvmStatic external fun treeCopy(tree: Long): Long
  @JvmStatic external fun treeRootNode(tree: Long, out: LongArray)
  @JvmStatic external fun treeEdit(
    tree: Long, start: Int, oldEnd: Int, newEnd: Int,
    startRow: Int, startCol: Int, oldEndRow: Int, oldEndCol: Int, newEndRow: Int, newEndCol: Int,
  )
  @JvmStatic external fun treeChangedRanges(oldTree: Long, newTree: Long): IntArray
  @JvmStatic external fun nodeIsNull(node: LongArray): Boolean
  @JvmStatic external fun nodeStartUnit(node: LongArray): Int
  @JvmStatic external fun nodeEndUnit(node: LongArray): Int
  @JvmStatic external fun nodeStartPoint(node: LongArray): Long
  @JvmStatic external fun nodeEndPoint(node: LongArray): Long
  @JvmStatic external fun nodeType(node: LongArray): String
  @JvmStatic external fun nodeParent(node: LongArray, out: LongArray)
  @JvmStatic external fun nodeChildCount(node: LongArray): Int
  @JvmStatic external fun nodeChild(node: LongArray, index: Int, out: LongArray)
  @JvmStatic external fun nodeDescendantForUnitRange(node: LongArray, start: Int, end: Int, out: LongArray)
  @JvmStatic external fun queryNew(language: Long, source: String, error: IntArray): Long
  @JvmStatic external fun queryDelete(query: Long)
  @JvmStatic external fun queryPatternCount(query: Long): Int
  @JvmStatic external fun queryCaptureNames(query: Long): Array<String>
  @JvmStatic external fun queryStringValues(query: Long): Array<String>
  @JvmStatic external fun queryPredicates(query: Long, pattern: Int): IntArray
  @JvmStatic external fun queryDisablePattern(query: Long, pattern: Int)
  @JvmStatic external fun cursorNew(): Long
  @JvmStatic external fun cursorDelete(cursor: Long)
  @JvmStatic external fun cursorExec(cursor: Long, query: Long, node: LongArray)
  @JvmStatic external fun cursorSetUnitRange(cursor: Long, start: Int, end: Int)
  @JvmStatic external fun cursorNextCapture(cursor: Long, out: LongArray): Boolean
  @JvmStatic external fun cursorMatchCaptureCount(cursor: Long): Int
  @JvmStatic external fun cursorMatchCapture(cursor: Long, index: Int, out: LongArray)
  @JvmStatic external fun cursorRemoveMatch(cursor: Long, matchId: Int)
  @JvmStatic external fun mirrorNew(): Long
  @JvmStatic external fun mirrorDelete(mirror: Long)
  @JvmStatic external fun mirrorReplace(mirror: Long, start: Int, end: Int, text: String)
  @JvmStatic external fun mirrorLength(mirror: Long): Int
  @JvmStatic external fun mirrorText(mirror: Long, start: Int, end: Int): String
  @JvmStatic external fun languageAbiVersion(language: Long): Int
  @JvmStatic external fun runtimeAbiRange(): IntArray

  /** Provided only by scripts/build-host-treesitter.sh for JVM tests. Never called on a device. */
  @JvmStatic external fun hostLanguage(name: String): Long
}
