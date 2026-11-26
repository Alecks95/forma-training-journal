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
        let shareLabel = safari.buttons["Share"].firstMatch
        if share.waitForExistence(timeout: 4) { share.tap() }
        else if shareLabel.waitForExistence(timeout: 3) { shareLabel.tap() }
        else { snapshot("Safari opening",safari); throw Failure.missing("Share") }
        let add = safari.descendants(matching:.any).matching(NSPredicate(format:"label == %@", "Add to Home Screen")).firstMatch
        for _ in 0..<5 {
            if add.exists && add.isHittable {break}
            safari.swipeUp()
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
        for (variant,name) in [("current","Form"),("plain","Form Plain"),("theme","Form Theme")] {
            let icon = try install(variant,name:name)
            for label in [variant,variant+"-warm"] {
                try record("start", label)
                icon.tap()
                Thread.sleep(forTimeInterval:1.5)
                try record("stop", label)
                let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
                attachment.name = "Opened-"+label;attachment.lifetime = .keepAlways;add(attachment)
                XCUIDevice.shared.press(.home)
            }
        }
    }
    enum Failure: Error {case missing(String)}
}

