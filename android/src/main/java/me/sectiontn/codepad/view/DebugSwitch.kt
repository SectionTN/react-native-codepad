package me.sectiontn.codepad.view

import android.content.Context
import android.content.pm.ApplicationInfo
import android.provider.Settings

/**
 * One global setting turns on the keyboard recorder and the typing latency log, debuggable builds only:
 * adb shell settings put global codepad_debug 1
 */
internal object DebugSwitch {
  const val TAG = "codepad-ime"

  fun isOn(context: Context): Boolean {
    val debuggable = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
    return debuggable && Settings.Global.getInt(context.contentResolver, "codepad_debug", 0) == 1
  }
}
