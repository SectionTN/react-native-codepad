package me.sectiontn.codepad.view

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.view.View
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsAnimationCompat
import androidx.core.view.WindowInsetsCompat

/** Listens to the window's IME insets on behalf of one view and reports its overlap with the keyboard in pixels. */
internal class KeyboardInsetTracker(private val view: View, private val apply: (Int) -> Unit) {
  private val location = IntArray(2)

  // Progress frames arrive on every view with a callback; androidx emulates them below API 30.
  private val callback = object : WindowInsetsAnimationCompat.Callback(DISPATCH_MODE_CONTINUE_ON_SUBTREE) {
    override fun onProgress(insets: WindowInsetsCompat, running: List<WindowInsetsAnimationCompat>): WindowInsetsCompat {
      if (running.any { it.typeMask and WindowInsetsCompat.Type.ime() != 0 }) update(insets)
      return insets
    }

    override fun onEnd(animation: WindowInsetsAnimationCompat) {
      ViewCompat.getRootWindowInsets(view)?.let(::update)
    }
  }

  fun start() {
    ViewCompat.setWindowInsetsAnimationCallback(view, callback)
    ViewCompat.setOnApplyWindowInsetsListener(view) { _, insets ->
      update(insets)
      insets
    }
    ViewCompat.getRootWindowInsets(view)?.let(::update)
  }

  fun stop() {
    ViewCompat.setWindowInsetsAnimationCallback(view, null)
    ViewCompat.setOnApplyWindowInsetsListener(view, null)
    apply(0)
  }

  private fun update(insets: WindowInsetsCompat) {
    val mode = activity(view.context)?.window?.attributes?.softInputMode ?: 0
    if (!KeyboardInset.applies(mode)) {
      apply(0)
      return
    }
    val root = view.rootView ?: return
    view.getLocationInWindow(location)
    val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
    apply(KeyboardInset.overlap(location[1] + view.height, root.height, ime))
  }

  private fun activity(context: Context): Activity? {
    var c: Context? = context
    while (c is ContextWrapper) {
      if (c is Activity) return c
      c = c.baseContext
    }
    return null
  }
}
