// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ContactsPlugin",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "ContactsPlugin",
            targets: ["ContactsPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.2.0")
    ],
    targets: [
        .target(
            name: "ContactsPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "Sources/ContactsPlugin"
        )
    ]
)
