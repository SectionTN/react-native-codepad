export const kotlin = `package me.sectiontn.codepad.sample

import kotlin.math.roundToInt

/** One row of the benchmark table. */
data class Measurement(val name: String, val millis: Double, val frames: Int = 0)

sealed interface Verdict {
  data object Pass : Verdict
  data class Fail(val reason: String) : Verdict
}

fun Measurement.judge(budgetMillis: Double): Verdict = when {
  millis <= budgetMillis -> Verdict.Pass
  frames == 0 -> Verdict.Fail("no frames for $name")
  else -> Verdict.Fail("\${millis.roundToInt()} ms over \${budgetMillis.roundToInt()} ms")
}

fun main() {
  val rows = listOf(Measurement("open", 42.0, 1), Measurement("type", 14.5, 60))
  rows.map { it.judge(16.0) }.forEachIndexed { i, verdict -> println("row $i: $verdict") }
}
`;
