package me.sectiontn.codepad.syntax

/** Interns capture names into small ints shared by every query so span arrays stay primitive. */
object StyleTable {
  private val ids = HashMap<String, Int>()
  private val names = ArrayList<String>()

  @Synchronized
  fun id(name: String): Int = ids.getOrPut(name) {
    names.add(name)
    names.size - 1
  }

  @Synchronized
  fun name(id: Int): String = names[id]
}
