package me.sectiontn.codepad.syntax

import java.io.File

/** Registers generated languages with the registry from the host library plus the generated query files. */
object HostLanguages {
  private val languagesDir: File
    get() = File(System.getProperty("codepad.vectorsDir")!!).resolveSibling("../languages")

  // The example app's custom packages, written by the language command.
  private val modulesDir: File
    get() = File(System.getProperty("codepad.vectorsDir")!!).resolveSibling("../example/modules")

  private fun packageDir(id: String): File = languagesDir.resolve(id).takeIf { it.isDirectory } ?: modulesDir.resolve(id)

  fun javascript(): LoadedLanguage = load("javascript", "javascript")

  /** Registers <package>/queries/<grammar> under the grammar name and resolves it. */
  fun load(id: String, grammar: String): LoadedLanguage {
    val pointer = HostLib.language(grammar)
    val dir = packageDir(id).resolve("queries/$grammar")
    LanguageRegistry.register(object : LanguageProvider {
      override val id = grammar
      override val languagePointer = pointer
      override val highlights = dir.resolve("highlights.scm").readText()
      override val injections = dir.resolve("injections.scm").takeIf { it.exists() }?.readText() ?: ""
    })
    return LanguageRegistry.resolve(grammar) ?: error("$grammar did not load")
  }

  /** Every (package folder, grammar name) with a highlights query in languages and example/modules, sorted. */
  fun packages(): List<Pair<String, String>> {
    val packages = listOf(languagesDir, modulesDir).flatMap { root ->
      root.listFiles { f -> f.isDirectory && f.name != "generator" && !f.name.startsWith(".") }?.toList() ?: emptyList()
    }
    return packages.sortedBy { it.name }.flatMap { pkg ->
      val queries = pkg.resolve("queries").listFiles { f -> f.resolve("highlights.scm").exists() } ?: emptyArray()
      queries.sortedBy { it.name }.map { pkg.name to it.name }
    }
  }
}

/** True when one of the unit pairs meets the line [start, end], the painter's rule for a dirty line. */
fun meetsLine(changed: IntArray, start: Int, end: Int): Boolean {
  var i = 0
  while (i + 1 < changed.size) {
    if (changed[i] <= end && maxOf(changed[i], changed[i + 1] - 1) >= start) return true
    i += 2
  }
  return false
}
