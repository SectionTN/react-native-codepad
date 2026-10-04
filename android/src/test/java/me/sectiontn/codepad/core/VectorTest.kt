package me.sectiontn.codepad.core

import java.io.File
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class VectorTest(private val case: JSONObject, @Suppress("unused") private val label: String) {
  companion object {
    @JvmStatic
    @Parameterized.Parameters(name = "{1}")
    fun cases(): List<Array<Any>> {
      val dir = File(System.getProperty("codepad.vectorsDir") ?: "../tests/vectors")
      val files = dir.listFiles { f -> f.name.endsWith(".json") }?.sortedBy { it.name }
        ?: error("no vectors in ${dir.absolutePath}")
      return files.flatMap { file ->
        val root = JSONObject(file.readText())
        val cases = root.getJSONArray("cases")
        (0 until cases.length()).map { i ->
          val case = cases.getJSONObject(i)
          arrayOf<Any>(case, "${file.nameWithoutExtension}: ${case.getString("name")}")
        }
      }
    }
  }

  @Test
  fun runCase() = VectorRunner(case).run()
}
