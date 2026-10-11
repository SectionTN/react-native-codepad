package me.sectiontn.codepad.syntax

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LanguageRegistryTest {
  @Test
  fun injectionNamesLowercaseAndAlias() {
    assertEquals("javascript", LanguageRegistry.canonicalInjectionId("JS"))
    assertEquals("javascript", LanguageRegistry.canonicalInjectionId("jsx"))
    assertEquals("typescript", LanguageRegistry.canonicalInjectionId("ts"))
    assertEquals("python", LanguageRegistry.canonicalInjectionId("py"))
    assertEquals("json", LanguageRegistry.canonicalInjectionId("JSON"))
    assertEquals("yaml", LanguageRegistry.canonicalInjectionId("yml"))
    assertEquals("markdown", LanguageRegistry.canonicalInjectionId("md"))
    assertEquals("c", LanguageRegistry.canonicalInjectionId("h"))
    assertNull(LanguageRegistry.canonicalInjectionId("bash"))
    assertNull(LanguageRegistry.canonicalInjectionId("cpp"))
    assertNull(LanguageRegistry.canonicalInjectionId("regex"))
    assertEquals("ruby", LanguageRegistry.canonicalInjectionId("ruby"))
  }

  @Test
  fun unknownLanguagesAndBadQueriesResolveToNull() {
    val base = HostLanguages.javascript()
    assertNull(LanguageRegistry.resolve("no_such_language"))
    assertNull(LanguageRegistry.resolveInjection("c_sharp"))
    assertTrue(LanguageRegistry.resolveInjection("js") === LanguageRegistry.resolve("javascript"))
    var reads = 0
    LanguageRegistry.register(object : LanguageProvider {
      override val id = "javascript_bad"
      override val languagePointer: Long get() { reads++; return base.pointer }
      override val highlights = "(no_such_node) @x"
      override val injections = ""
    })
    assertNull("a highlights query naming a missing node fails the load", LanguageRegistry.resolve("javascript_bad"))
    assertEquals("the provider was asked, so the null is the bad query and not an unknown id", 1, reads)
  }
}
