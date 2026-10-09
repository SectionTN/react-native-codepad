package me.sectiontn.codepad.syntax

class CaptureNode(val captureIndex: Int, val node: TSNodeRef)

/** An offset! directive: row and column deltas for the start and end of one capture. */
class Offset(val captureIndex: Int, val startRow: Int, val startColumn: Int, val endRow: Int, val endColumn: Int)

/** Evaluates a pattern's predicate steps against one match. The C runtime only hands out the steps. */
class PredicateEvaluator(private val query: Query) {
  private class Pred(val name: String, val negate: Boolean, val any: Boolean, val args: List<Pair<Int, Int>>)

  private val byPattern: Array<List<Pred>> = Array(query.patternCount) { parse(query.predicates(it)) }
  private val settingsByPattern: Array<Map<String, String>> = Array(query.patternCount) { i ->
    byPattern[i].filter { it.name == "set!" }.mapNotNull { p ->
      val strings = p.args.filter { it.first == STRING }.map { query.stringValues[it.second] }
      if (strings.isEmpty()) null else strings[0] to (strings.getOrNull(1) ?: "true")
    }.toMap()
  }
  private val offsetByPattern: Array<Offset?> = Array(query.patternCount) { i ->
    byPattern[i].firstOrNull { it.name == "offset!" }?.let { p ->
      val capture = p.args.firstOrNull { it.first == CAPTURE }?.second
      val ints = p.args.filter { it.first == STRING }.map { query.stringValues[it.second].toIntOrNull() }
      if (capture == null || ints.size < 4 || ints.any { it == null }) null
      else Offset(capture, ints[0]!!, ints[1]!!, ints[2]!!, ints[3]!!)
    }
  }
  private val regexCache = HashMap<String, Regex>()

  fun settings(pattern: Int): Map<String, String> = settingsByPattern[pattern]

  fun offset(pattern: Int): Offset? = offsetByPattern[pattern]

  fun hasPredicates(pattern: Int): Boolean = byPattern[pattern].any { !it.name.endsWith("!") }

  /** [text] reads node text from whatever copy of the document is consistent with the tree. */
  fun matches(pattern: Int, captures: List<CaptureNode>, text: (TSNodeRef) -> String): Boolean {
    for (p in byPattern[pattern]) {
      if (p.name.endsWith("!")) continue
      if (!eval(p, captures, text)) return false
    }
    return true
  }

  private fun eval(p: Pred, captures: List<CaptureNode>, text: (TSNodeRef) -> String): Boolean {
    val capture = p.args.firstOrNull { it.first == CAPTURE } ?: return true
    val nodes = captures.filter { it.captureIndex == capture.second }.map { it.node }
    val strings = p.args.filter { it.first == STRING }.map { query.stringValues[it.second] }
    val other = p.args.drop(1).firstOrNull { it.first == CAPTURE }
    val base: Boolean = if (nodes.isEmpty()) true else {
      val test: (TSNodeRef) -> Boolean = when (p.name) {
        "eq?" -> { n ->
          val expected = if (other != null) {
            captures.firstOrNull { it.captureIndex == other.second }?.let { text(it.node) }
          } else {
            strings.firstOrNull()
          }
          expected != null && text(n) == expected
        }
        "match?" -> { n ->
          val s = strings.firstOrNull()
          s != null && regex(s).containsMatchIn(text(n))
        }
        "any-of?" -> { n -> text(n) in strings }
        "contains?" -> { n ->
          val t = text(n)
          strings.any { t.contains(it) }
        }
        "has-parent?" -> { n -> n.parent().let { !it.isNull && it.type in strings } }
        "has-ancestor?" -> { n ->
          var a = n.parent()
          var found = false
          while (!a.isNull && !found) {
            if (a.type in strings) found = true
            a = a.parent()
          }
          found
        }
        else -> { _ -> true }
      }
      if (p.any) nodes.any(test) else nodes.all(test)
    }
    return if (p.negate) !base else base
  }

  private fun regex(pattern: String): Regex = regexCache.getOrPut(pattern) { Regex(pattern) }

  private fun parse(steps: IntArray): List<Pred> {
    val out = ArrayList<Pred>()
    var i = 0
    while (i < steps.size) {
      var j = i
      while (j < steps.size && steps[j] != DONE) j += 2
      val type = steps[i]
      if (type == STRING) {
        val rawName = query.stringValues[steps[i + 1]]
        var name = rawName
        val negate = name.startsWith("not-")
        if (negate) name = name.removePrefix("not-")
        val any = name.startsWith("any-") && name != "any-of?"
        if (any) name = name.removePrefix("any-")
        val args = ArrayList<Pair<Int, Int>>()
        var k = i + 2
        while (k < j) {
          args.add(steps[k] to steps[k + 1])
          k += 2
        }
        out.add(Pred(if (rawName.endsWith("!")) rawName else name, negate, any, args))
      }
      i = j + 2
    }
    return out
  }

  companion object {
    const val DONE = 0
    const val CAPTURE = 1
    const val STRING = 2
  }
}
