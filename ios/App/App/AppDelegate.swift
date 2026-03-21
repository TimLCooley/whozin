import UIKit
import Capacitor

// Import plugin modules so the linker includes them in the binary.
// Without these, NSClassFromString() can't find plugin classes at runtime
// because SPM modules get dead-stripped when nothing references them.
import PushNotificationsPlugin
import AppleSignInPlugin

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Force-load Capacitor plugin classes so NSClassFromString() can find them.
        // Without this, the linker dead-strips SPM module classes.
        forceLoadPlugins()
        return true
    }

    private func forceLoadPlugins() {
        // These lookups force the linker to include the ObjC classes.
        // The class names match @objc() annotations in the plugin source.
        let pluginClasses: [String] = [
            "PushNotificationsPlugin",
            "AppleSignInPlugin",
        ]
        for name in pluginClasses {
            if NSClassFromString(name) == nil {
                NSLog("⚡️ Warning: Plugin class '\(name)' not found at runtime")
            }
        }
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

    // Forward push notification token to Capacitor's notification system
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

}
