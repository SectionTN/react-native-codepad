package me.sectiontn.codepad.view

import android.graphics.Rect
import android.view.ActionMode
import android.view.Menu
import android.view.MenuItem
import android.view.View

/** The floating cut, copy, paste and select all menu, anchored to the selection or the caret. */
class EditMenu(private val view: View, private val host: Host) {
  interface Host {
    fun contentRect(out: Rect)
    fun canCut(): Boolean
    fun canCopy(): Boolean
    fun canPaste(): Boolean
    fun cut()
    fun copy()
    fun paste()
    fun selectAll()
  }

  private var mode: ActionMode? = null

  private val callback = object : ActionMode.Callback2() {
    override fun onCreateActionMode(mode: ActionMode, menu: Menu): Boolean = true

    override fun onPrepareActionMode(mode: ActionMode, menu: Menu): Boolean {
      menu.clear()
      if (host.canCut()) add(menu, android.R.id.cut, 0, android.R.string.cut)
      if (host.canCopy()) add(menu, android.R.id.copy, 1, android.R.string.copy)
      if (host.canPaste()) add(menu, android.R.id.paste, 2, android.R.string.paste)
      add(menu, android.R.id.selectAll, 3, android.R.string.selectAll)
      return true
    }

    override fun onActionItemClicked(mode: ActionMode, item: MenuItem): Boolean {
      when (item.itemId) {
        android.R.id.cut -> host.cut()
        android.R.id.copy -> host.copy()
        android.R.id.paste -> host.paste()
        android.R.id.selectAll -> {
          host.selectAll()
          mode.invalidate()
          return true
        }
        else -> return false
      }
      hide()
      return true
    }

    override fun onDestroyActionMode(mode: ActionMode) {
      this@EditMenu.mode = null
    }

    override fun onGetContentRect(mode: ActionMode, view: View, outRect: Rect) = host.contentRect(outRect)

    private fun add(menu: Menu, id: Int, order: Int, title: Int) {
      menu.add(Menu.NONE, id, order, title).setShowAsAction(MenuItem.SHOW_AS_ACTION_ALWAYS or MenuItem.SHOW_AS_ACTION_WITH_TEXT)
    }
  }

  val isShowing: Boolean get() = mode != null

  fun show() {
    val current = mode
    if (current != null) {
      current.invalidate()
      current.invalidateContentRect()
      return
    }
    mode = view.startActionMode(callback, ActionMode.TYPE_FLOATING)
  }

  fun hide() {
    mode?.finish()
    mode = null
  }

  fun invalidateContentRect() {
    mode?.invalidateContentRect()
  }
}
