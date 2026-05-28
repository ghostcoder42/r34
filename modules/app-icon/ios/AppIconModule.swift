import ExpoModulesCore
import UIKit

public class AppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AppIcon")

    // `name` is the alternate icon name registered in Info.plist, or null to
    // restore the default icon.
    AsyncFunction("setAppIcon") { (name: String?, promise: Promise) in
      DispatchQueue.main.async {
        guard UIApplication.shared.supportsAlternateIcons else {
          promise.resolve(false)
          return
        }
        UIApplication.shared.setAlternateIconName(name) { error in
          if let error = error {
            promise.reject("E_APP_ICON", error.localizedDescription)
          } else {
            promise.resolve(true)
          }
        }
      }
    }
  }
}
