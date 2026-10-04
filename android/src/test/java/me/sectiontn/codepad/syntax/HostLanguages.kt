package me.sectiontn.codepad.syntax

import java.io.File

/** Registers generated languages with the registry from the host library plus the generated query files. */
object HostLanguages {
  fun javascript(): LoadedLanguage {
    val pointer = HostLib.javascript()
    val dir = File(System.getProperty("codepad.vectorsDir")!!).resolveSibling("../languages/javascript/queries/javascript")
    LanguageRegistry.register(object : LanguageProvider {
      override val id = "javascript"
      override val languagePointer = pointer
      override val highlights = dir.resolve("highlights.scm").readText()
      override val injections = dir.resolve("injections.scm").readText()
    })
    return LanguageRegistry.resolve("javascript") ?: error("javascript did not load")
  }
}
