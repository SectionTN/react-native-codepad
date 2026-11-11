package me.sectiontn.codepad.syntax

import android.util.Log

/** A language loaded into the core. The core keeps it for the life of the process. */
class LoadedLanguage(val id: String, val handle: Long)

object LanguageRegistry {
  private const val TAG = "codepad"
  private val providers = HashMap<String, LanguageProvider>()
  private val cache = HashMap<String, LoadedLanguage?>()
  private val installed = HashMap<String, Boolean>()
  private val byHandle = HashMap<Long, LoadedLanguage>()

  /** The language a core handle was loaded as. */
  @Synchronized
  fun loaded(handle: Long): LoadedLanguage? = byHandle[handle]

  // Names nvim queries and fence info strings use for languages we ship under another id. Empty means never inject.
  private val aliases = mapOf(
    "js" to "javascript", "jsx" to "javascript", "mjs" to "javascript", "cjs" to "javascript",
    "ts" to "typescript", "mts" to "typescript", "cts" to "typescript",
    "py" to "python", "python3" to "python", "kt" to "kotlin", "kts" to "kotlin", "rs" to "rust", "golang" to "go",
    "yml" to "yaml", "jsonc" to "json", "json5" to "json", "htm" to "html", "xhtml" to "html", "md" to "markdown", "h" to "c",
    "svg" to "xml", "xsd" to "xml", "xsl" to "xml", "xslt" to "xml", "rng" to "xml", "dosini" to "ini", "confini" to "ini",
    "cpp" to "", "c++" to "", "cc" to "", "hpp" to "", "objc" to "", "bash" to "", "sh" to "", "shell" to "", "zsh" to "",
    "console" to "", "text" to "", "txt" to "", "plain" to "", "regex" to "", "jsdoc" to "", "phpdoc" to "", "comment" to "", "luap" to "",
    "printf" to "", "styled" to "", "angular" to "", "groq" to "", "graphql" to "", "glimmer" to "", "sql" to "", "c_sharp" to "",
  )

  /** Explicit registration for tests and for grammars that do not follow the package naming. */
  @Synchronized
  fun register(provider: LanguageProvider) {
    providers[provider.id] = provider
    cache.remove(provider.id)
  }

  // getOrPut treats a cached null as a miss, so a failed load would be retried on every call.
  @Synchronized
  fun resolve(id: String): LoadedLanguage? {
    if (cache.containsKey(id)) return cache[id]
    return load(id).also { cache[id] = it }
  }

  /** Lowercases a fence or query name; an installed id wins over the aliases, null means never inject. */
  fun canonicalInjectionId(name: String): String? {
    val lower = name.lowercase()
    val mapped = aliases[lower] ?: return lower
    if (isInstalled(lower)) return lower
    return mapped.ifEmpty { null }
  }

  @Synchronized
  private fun isInstalled(id: String): Boolean = providers.containsKey(id) || installed.getOrPut(id) { reflect(id) != null }

  fun resolveInjection(name: String): LoadedLanguage? = canonicalInjectionId(name)?.let { resolve(it) }

  private fun load(id: String): LoadedLanguage? {
    val provider = providers[id] ?: reflect(id)
    if (provider == null) {
      Log.w(TAG, "language '$id' is not installed, falling back to plain text")
      return null
    }
    val error = arrayOfNulls<String>(1)
    val injections = if (provider.injections.isBlank()) null else provider.injections.toByteArray(Charsets.UTF_8)
    val handle = CoreNative.languageLoad(id, provider.languagePointer, provider.highlights.toByteArray(Charsets.UTF_8), injections, error)
    error[0]?.let { Log.w(TAG, it) }
    // A broken injections query still loads the language, without injections.
    return if (handle == 0L) null else LoadedLanguage(id, handle).also { byHandle[handle] = it }
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
