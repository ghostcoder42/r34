package expo.modules.appicon

import android.content.ComponentName
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppIconModule : Module() {
  private val aliases = listOf("default", "sunset", "ocean", "forest", "violet", "rose")

  private fun aliasComponentName(name: String): ComponentName {
    val pkg = appContext.reactContext?.packageName
      ?: throw Exception("No react context")
    val cap = name.replaceFirstChar { it.uppercase() }
    return ComponentName(pkg, "$pkg.MainActivityIcon$cap")
  }

  override fun definition() = ModuleDefinition {
    Name("AppIcon")

    // Returns true on success; throws (rejected promise on JS side) on failure.
    AsyncFunction("setAppIcon") { name: String? ->
      val pm = appContext.reactContext!!.packageManager
      val target = if (name.isNullOrEmpty()) "default" else name
      require(aliases.contains(target)) { "Unknown icon: $target" }

      // Enable the chosen alias FIRST, then disable the others, so there is
      // never a window where zero launcher components are enabled (which
      // would make the app vanish from the home screen).
      pm.setComponentEnabledSetting(
        aliasComponentName(target),
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.DONT_KILL_APP
      )
      for (alias in aliases) {
        if (alias == target) continue
        pm.setComponentEnabledSetting(
          aliasComponentName(alias),
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          PackageManager.DONT_KILL_APP
        )
      }
      true
    }
  }
}
