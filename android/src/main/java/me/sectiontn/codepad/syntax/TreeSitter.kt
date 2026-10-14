package me.sectiontn.codepad.syntax

data class Point(val row: Int, val column: Int) {
  companion object {
    fun unpack(packed: Long): Point = Point((packed ushr 32).toInt(), (packed and 0xffffffffL).toInt())
  }
}

data class InputEdit(
  val start: Int, val oldEnd: Int, val newEnd: Int,
  val startPoint: Point, val oldEndPoint: Point, val newEndPoint: Point,
)

/** A TSNode packed into four longs. Valid while its tree is alive. */
class TSNodeRef(val raw: LongArray = LongArray(4)) {
  val isNull: Boolean get() = TreeSitterNative.nodeIsNull(raw)
  val startUnit: Int get() = TreeSitterNative.nodeStartUnit(raw)
  val endUnit: Int get() = TreeSitterNative.nodeEndUnit(raw)
  val startPoint: Point get() = Point.unpack(TreeSitterNative.nodeStartPoint(raw))
  val endPoint: Point get() = Point.unpack(TreeSitterNative.nodeEndPoint(raw))
  val type: String get() = TreeSitterNative.nodeType(raw)
  val childCount: Int get() = TreeSitterNative.nodeChildCount(raw)
  fun parent(): TSNodeRef = TSNodeRef().also { TreeSitterNative.nodeParent(raw, it.raw) }
  fun child(index: Int): TSNodeRef = TSNodeRef().also { TreeSitterNative.nodeChild(raw, index, it.raw) }
  fun descendantForUnitRange(start: Int, end: Int): TSNodeRef =
    TSNodeRef().also { TreeSitterNative.nodeDescendantForUnitRange(raw, start, end, it.raw) }
}

class Mirror : AutoCloseable {
  val handle: Long = TreeSitterNative.mirrorNew()
  val length: Int get() = TreeSitterNative.mirrorLength(handle)
  fun replace(start: Int, end: Int, text: String) = TreeSitterNative.mirrorReplace(handle, start, end, text)
  fun setText(text: String) = replace(0, length, text)
  fun text(start: Int, end: Int): String = TreeSitterNative.mirrorText(handle, start, end)
  override fun close() = TreeSitterNative.mirrorDelete(handle)
}

class CancelFlag : AutoCloseable {
  val handle: Long = TreeSitterNative.flagNew()
  @Volatile var isSet: Boolean = false
    private set
  fun set(value: Boolean) {
    isSet = value
    TreeSitterNative.flagSet(handle, value)
  }
  override fun close() = TreeSitterNative.flagDelete(handle)
}

class Tree(val handle: Long) : AutoCloseable {
  fun copy(): Tree = Tree(TreeSitterNative.treeCopy(handle))
  fun rootNode(): TSNodeRef = TSNodeRef().also { TreeSitterNative.treeRootNode(handle, it.raw) }
  fun edit(e: InputEdit) = TreeSitterNative.treeEdit(
    handle, e.start, e.oldEnd, e.newEnd,
    e.startPoint.row, e.startPoint.column, e.oldEndPoint.row, e.oldEndPoint.column, e.newEndPoint.row, e.newEndPoint.column,
  )

  /** Six ints per range like Parser.setIncludedRanges; edits shift them along with the nodes. */
  fun includedRanges(): IntArray = TreeSitterNative.treeIncludedRanges(handle)

  /** Unit pairs whose syntax differs from [since], the edited tree this one was parsed against. */
  fun changedRanges(since: Tree): IntArray = TreeSitterNative.treeChangedRanges(since.handle, handle)
  override fun close() = TreeSitterNative.treeDelete(handle)
}

class Parser : AutoCloseable {
  val handle: Long = TreeSitterNative.parserNew()
  fun setLanguage(language: Long): Boolean = TreeSitterNative.parserSetLanguage(handle, language)
  fun reset() = TreeSitterNative.parserReset(handle)
  fun setIncludedRanges(ranges: IntArray): Boolean = TreeSitterNative.parserSetIncludedRanges(handle, ranges)

  /** Null means [flag] or [budgetMicros] cancelled the parse. Parse again to resume, or reset first. */
  fun parse(oldTree: Tree?, mirror: Mirror, flag: CancelFlag?, budgetMicros: Long): Tree? {
    val tree = TreeSitterNative.parserParse(handle, oldTree?.handle ?: 0L, mirror.handle, flag?.handle ?: 0L, budgetMicros)
    return if (tree == 0L) null else Tree(tree)
  }

  override fun close() = TreeSitterNative.parserDelete(handle)
}

class QueryException(val offset: Int, val type: Int) : Exception("tree-sitter query error type $type at byte $offset")

class Query private constructor(val handle: Long) : AutoCloseable {
  val patternCount: Int = TreeSitterNative.queryPatternCount(handle)
  val captureNames: Array<String> = TreeSitterNative.queryCaptureNames(handle)
  val stringValues: Array<String> = TreeSitterNative.queryStringValues(handle)
  fun predicates(pattern: Int): IntArray = TreeSitterNative.queryPredicates(handle, pattern)
  fun disablePattern(pattern: Int) = TreeSitterNative.queryDisablePattern(handle, pattern)
  override fun close() = TreeSitterNative.queryDelete(handle)

  companion object {
    fun compile(language: Long, source: String): Query {
      val error = IntArray(2)
      val handle = TreeSitterNative.queryNew(language, source, error)
      if (handle == 0L) throw QueryException(error[0], error[1])
      return Query(handle)
    }
  }
}

class Capture {
  val node = TSNodeRef()
  var matchId: Int = 0
  var patternIndex: Int = 0
  var captureIndex: Int = 0
}

class QueryCursor : AutoCloseable {
  val handle: Long = TreeSitterNative.cursorNew()
  private val buffer = LongArray(7)

  fun exec(query: Query, node: TSNodeRef) = TreeSitterNative.cursorExec(handle, query.handle, node.raw)
  fun setUnitRange(start: Int, end: Int) = TreeSitterNative.cursorSetUnitRange(handle, start, end)

  fun nextCapture(out: Capture): Boolean {
    if (!TreeSitterNative.cursorNextCapture(handle, buffer)) return false
    System.arraycopy(buffer, 0, out.node.raw, 0, 4)
    out.matchId = buffer[4].toInt()
    out.patternIndex = buffer[5].toInt()
    out.captureIndex = buffer[6].toInt()
    return true
  }

  /** Advances to the next finished match, every capture included whether or not it lies inside the unit range. */
  fun nextMatch(): Boolean = TreeSitterNative.cursorNextMatch(handle)

  /** The capture hull of every match of [query] under [node] over [start, end) as unit pairs, one JNI call per run. */
  fun matchHulls(query: Query, node: TSNodeRef, start: Int, end: Int): IntArray =
    TreeSitterNative.cursorMatchHulls(handle, query.handle, node.raw, start, end)

  val matchCaptureCount: Int get() = TreeSitterNative.cursorMatchCaptureCount(handle)

  /** The i-th capture of the match returned by the last nextCapture or nextMatch call. */
  fun matchCapture(index: Int, out: Capture) {
    TreeSitterNative.cursorMatchCapture(handle, index, buffer)
    System.arraycopy(buffer, 0, out.node.raw, 0, 4)
    out.captureIndex = buffer[4].toInt()
  }

  fun removeMatch(matchId: Int) = TreeSitterNative.cursorRemoveMatch(handle, matchId)
  override fun close() = TreeSitterNative.cursorDelete(handle)
}
