package me.sectiontn.codepad.syntax

import java.io.File

/** Registers generated languages with the registry from the host library plus the generated query files. */
object HostLanguages {
  private val languagesDir: File
    get() = File(System.getProperty("codepad.vectorsDir")!!).resolveSibling("../languages")

  fun javascript(): LoadedLanguage = load("javascript", "javascript")

  /** Registers languages/<id>/queries/<grammar> under the grammar name and resolves it. */
  fun load(id: String, grammar: String): LoadedLanguage {
    val pointer = HostLib.language(grammar)
    val dir = languagesDir.resolve("$id/queries/$grammar")
    LanguageRegistry.register(object : LanguageProvider {
      override val id = grammar
      override val languagePointer = pointer
      override val highlights = dir.resolve("highlights.scm").readText()
      override val injections = dir.resolve("injections.scm").takeIf { it.exists() }?.readText() ?: ""
    })
    return LanguageRegistry.resolve(grammar) ?: error("$grammar did not load")
  }

  /** Every (package id, grammar name) with a highlights query, sorted by id then grammar. */
  fun packages(): List<Pair<String, String>> {
    val packages = languagesDir.listFiles { f -> f.isDirectory && f.name != "generator" && !f.name.startsWith(".") }
      ?: return emptyList()
    return packages.sortedBy { it.name }.flatMap { pkg ->
      val queries = pkg.resolve("queries").listFiles { f -> f.resolve("highlights.scm").exists() } ?: emptyArray()
      queries.sortedBy { it.name }.map { pkg.name to it.name }
    }
  }
}
