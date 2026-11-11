package me.sectiontn.codepad.syntax

/** Capture names interned by the core into small ints shared by every language. Names are cached here. */
object StyleTable {
  private val names = HashMap<Int, String>()

  fun id(name: String): Int = CoreNative.styleId(name)

  @Synchronized
  fun name(id: Int): String = names.getOrPut(id) { CoreNative.styleName(id) }
}
