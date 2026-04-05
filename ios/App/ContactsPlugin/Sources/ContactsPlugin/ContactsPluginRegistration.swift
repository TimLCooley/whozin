import Capacitor

// Register plugin with Capacitor's bridged plugin protocol (replaces ObjC CAP_PLUGIN macro)
extension ContactsPlugin: CAPBridgedPlugin {
    public var identifier: String { "ContactsPlugin" }
    public var jsName: String { "Contacts" }
    public var pluginMethods: [CAPPluginMethod] {
        return [
            CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
            CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
            CAPPluginMethod(name: "getContact", returnType: CAPPluginReturnPromise),
            CAPPluginMethod(name: "getContacts", returnType: CAPPluginReturnPromise),
            CAPPluginMethod(name: "createContact", returnType: CAPPluginReturnPromise),
            CAPPluginMethod(name: "deleteContact", returnType: CAPPluginReturnPromise),
            CAPPluginMethod(name: "pickContact", returnType: CAPPluginReturnPromise),
        ]
    }
}
