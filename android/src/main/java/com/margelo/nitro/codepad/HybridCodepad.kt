package com.margelo.nitro.codepad

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules

@DoNotStrip
class HybridCodepad : HybridCodepadSpec() {
  override fun availableLanguages(): Array<String> {
    val context = NitroModules.applicationContext ?: return emptyArray()
    return context.assets.list("codepad-languages")?.sortedArray() ?: emptyArray()
  }
}
