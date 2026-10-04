package me.sectiontn.codepad.syntax

/** Implemented by generated language classes, found by reflection as me.sectiontn.codepad.lang.<id>.<Pascal>Language. */
interface LanguageProvider {
  val id: String
  val languagePointer: Long
  val highlights: String
  val injections: String
}
