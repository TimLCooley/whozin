import UIKit
import Capacitor
import UserNotifications

// Import plugin modules so the linker includes them in the binary.
// Without these, NSClassFromString() can't find plugin classes at runtime
// because SPM modules get dead-stripped when nothing references them.
import PushNotificationsPlugin
import AppleSignInPlugin
import ContactsPlugin

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
            "ContactsPlugin",
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
        // Clear the app icon badge whenever the app comes to the foreground.
        // Every APNs push we send carries badge: 1, and iOS keeps that badge
        // on the icon until the app explicitly resets it (unlike Android,
        // which clears on open). Also clear delivered notifications from the
        // Notification Center so the count doesn't re-accumulate.
        clearBadge()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }

    private func clearBadge() {
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(0)
        } else {
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
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
