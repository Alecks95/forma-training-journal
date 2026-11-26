import XCTest
import Foundation

final class LaunchTests: XCTestCase {
    let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
    let spring = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let base = "http://127.0.0.1:8765/"

    func snapshot(_ name: String, _ app: XCUIApplication) {
        print("FORM UI " + name + "\n" + app.debugDescription)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
    func record(_ action: String, _ label: String) throws {
        let wait = expectation(description: action + label)
        var request = URLRequest(url: URL(string: base+action+"/"+label)!)
        request.httpMethod = "POST"
        URLSession.shared.dataTask(with: request) { _, res, error in
            XCTAssertNil(error)
            XCTAssertEqual((res as? HTTPURLResponse)?.statusCode, 204)
            wait.fulfill()
        }.resume()
        waitForExpectations(timeout: 20)
    }
    func install(_ variant: String, name: String) throws -> XCUIElement {
        let url = URL(string: base + variant + "/")!
        XCUIDevice.shared.system.open(url)
        for title in ["Continue", "Not Now", "Got It", "Done"] {
            let button = safari.buttons[title].firstMatch
            if button.exists && button.isHittable { button.tap() }
        }
        let share = safari.buttons["ShareButton"].firstMatch
        let ready = XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == true AND enabled == true AND hittable == true"), object:share)
        guard XCTWaiter.wait(for:[ready],timeout:55) == .completed else {snapshot("Loading-"+name,safari);throw Failure.missing("enabled Share")}
        Thread.sleep(forTimeInterval:1)
        share.tap()
        Thread.sleep(forTimeInterval:2)
        let add = safari.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Add to Home Screen")).firstMatch
        for _ in 0..<5 {
            if add.exists && add.isHittable {break}
            let start=safari.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.85))
            let end=safari.coordinate(withNormalizedOffset:CGVector(dx:0.5,dy:0.32))
            start.press(forDuration:0.08,thenDragTo:end)
            Thread.sleep(forTimeInterval:0.35)
        }
        guard add.exists && add.isHittable else {snapshot("Sharing",safari);throw Failure.missing("Add to Home Screen")}
        add.tap()
        let confirm = safari.buttons["Add"].firstMatch
        guard confirm.waitForExistence(timeout:6) else {snapshot("Confirming",safari);throw Failure.missing("Add")}
        confirm.tap()
        Thread.sleep(forTimeInterval:1)
        if spring.state != .runningForeground { XCUIDevice.shared.press(.home) }
        let icon = spring.icons[name].firstMatch
        for _ in 0..<4 {
            if icon.exists && icon.isHittable {break}
            spring.swipeLeft()
        }
        guard icon.exists && icon.isHittable else {snapshot("Home-"+name,spring);throw Failure.missing(name)}
        return icon
    }
    func testHomeLaunch() throws {
        continueAfterFailure = false
        for (variant,name) in [("current","Form"),("plain","Form Plain"),("theme","Form Theme"),("snapshot","Form Snapshot"),("legacy","Form Existing")] {
            let icon = try install(variant,name:name)
            for label in [variant,variant+"-warm"] {
                if variant == "legacy" && label.hasSuffix("-warm") {
                    try record("upgrade", variant)
                    let webApp=XCUIApplication(bundleIdentifier:"com.apple.webapp")
                    if webApp.state != .notRunning { webApp.terminate() }
                }
                try record("start", label)
                icon.tap()
                Thread.sleep(forTimeInterval:5)
                try record("stop", label)
                let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
                attachment.name = "Opened-"+label;attachment.lifetime = .keepAlways;add(attachment)
                XCUIDevice.shared.press(.home)
            }
        }
    }
    enum Failure: Error {case missing(String)}
}

