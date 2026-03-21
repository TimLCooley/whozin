import UIKit
import Capacitor

// Import plugin modules to prevent the linker from stripping them.
// Without these imports, NSClassFromString() can't find the plugin classes
// because SPM compiles them into separate modules that get dead-stripped.
import PushNotificationsPlugin
import AppleSignInPlugin

// Force the linker to include the plugin classes by referencing them.
private let _capacitorPlugins: [AnyClass] = [
    PushNotificationsPlugin.PushNotificationsPlugin.self,
    AppleSignInPlugin.AppleSignInPlugin.self,
]

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Plugins are registered via packageClassList in capacitor.config.json.
        // The imports above ensure they're linked into the binary.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
