package me.sectiontn.codepad.syntax

import android.util.Log

class CompiledQuery(val query: Query, val evaluator: PredicateEvaluator) {
  val styleIds: IntArray = IntArray(query.captureNames.size) { StyleTable.id(query.captureNames[it]) }
  val captureIndex: Map<String, Int> = query.captureNames.withIndex().associate { it.value to it.index }
}

class LoadedLanguage(val id: String, val pointer: Long, val highlights: CompiledQuery, val injections: CompiledQuery?)

object LanguageRegistry {
  private const val TAG = "codepad"
  private val providers = HashMap<String, LanguageProvider>()
  private val cache = HashMap<String, LoadedLanguage?>()

  // Names nvim queries use for injections that differ from our package ids. Empty means never inject.
  private val aliases = mapOf(
    "js" to "javascript", "jsx" to "javascript", "ts" to "typescript", "py" to "python",
    "kt" to "kotlin", "rs" to "rust", "golang" to "go", "yml" to "yaml", "jsonc" to "json", "json5" to "json",
    "htm" to "html", "c_sharp" to "", "sh" to "", "bash" to "", "regex" to "", "jsdoc" to "", "comment" to "",
    "luap" to "", "printf" to "",
  )

  /** Explicit registration for tests and for grammars that do not follow the package naming. */
  @Synchronized
  fun register(provider: LanguageProvider) {
    providers[provider.id] = provider
    cache.remove(provider.id)
  }

  @Synchronized
  fun resolve(id: String): LoadedLanguage? = cache.getOrPut(id) { load(id) }

  fun resolveInjection(name: String): LoadedLanguage? {
    val mapped = aliases[name] ?: name
    if (mapped.isEmpty()) return null
    return resolve(mapped)
  }

  private fun load(id: String): LoadedLanguage? {
    val provider = providers[id] ?: reflect(id)
    if (provider == null) {
      Log.w(TAG, "language '$id' is not installed, falling back to plain text")
      return null
    }
    val pointer = provider.languagePointer
    val range = TreeSitterNative.runtimeAbiRange()
    val abi = TreeSitterNative.languageAbiVersion(pointer)
    if (abi < range[0] || abi > range[1]) {
      Log.w(TAG, "language '$id' has ABI $abi, runtime supports ${range[0]} to ${range[1]}")
      return null
    }
    val highlights = compile(pointer, provider.highlights, "$id highlights") ?: return null
    val injections = if (provider.injections.isBlank()) null else compile(pointer, provider.injections, "$id injections")
    return LoadedLanguage(id, pointer, highlights, injections)
  }

  private fun compile(pointer: Long, source: String, label: String): CompiledQuery? = try {
    val query = Query.compile(pointer, source)
    CompiledQuery(query, PredicateEvaluator(query))
  } catch (e: QueryException) {
    Log.w(TAG, "$label query failed to compile: ${e.message}")
    null
  }

  private fun reflect(id: String): LanguageProvider? {
    val pascal = id.split('_').joinToString("") { part -> part.replaceFirstChar { it.uppercase() } }
    return try {
      Class.forName("me.sectiontn.codepad.lang.$id.${pascal}Language").getDeclaredConstructor().newInstance() as LanguageProvider
    } catch (e: Throwable) {
      null
    }
  }
}
