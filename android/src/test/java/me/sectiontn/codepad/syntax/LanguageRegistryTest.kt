package me.sectiontn.codepad.syntax

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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
}
