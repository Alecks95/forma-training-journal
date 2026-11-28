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
        // The sheet mounts while Safari is still reading the page title and icon.
        // Its Add button can exist on the previous share sheet before it accepts taps.
        let title = safari.textFields.matching(NSPredicate(format:"value == %@",name)).firstMatch
        guard title.waitForExistence(timeout:35) else {snapshot("Title",safari);throw Failure.missing("loaded bookmark title")}
        let enabled = XCTNSPredicateExpectation(predicate:NSPredicate(format:"enabled == YES AND hittable == YES"),object:confirm)
        guard XCTWaiter.wait(for:[enabled],timeout:12) == .completed else {throw Failure.missing("enabled Add button")}
        for _ in 0..<3 {
            if !confirm.exists || !title.exists {break}
            confirm.tap()
            Thread.sleep(forTimeInterval:2)
        }
        guard !confirm.exists || !title.exists else {snapshot("Pending-install",safari);throw Failure.missing("bookmark installation")}
        if spring.state != .runningForeground { XCUIDevice.shared.press(.home) }
        let icon = spring.icons[name].firstMatch
        for _ in 0..<4 {
            if icon.exists && icon.isHittable {break}
            spring.swipeLeft()
        }
        guard icon.exists && icon.isHittable else {snapshot("Home-"+name,spring);throw Failure.missing(name)}
        return icon
    }
    func compare(_ channel:String, _ name:String) throws {
        continueAfterFailure = false
        let icon = try install(channel, name:name)
        let modes = ["combined","today"]
        for (i, mode) in modes.enumerated() {
            try record("change",channel+"-"+mode)
            for stage in ["receive","cold1","warm","cold2"] {
                let label=channel+"-"+String(i)+"-"+mode+"-"+stage
                if stage != "warm" {try record("terminate",label)}
                if !icon.isHittable {
                    XCUIDevice.shared.press(.home)
                    for _ in 0..<4 {
                        if icon.exists && icon.isHittable {break}
                        spring.swipeLeft()
                    }
                }
                guard icon.exists && icon.isHittable else {throw Failure.missing("Home icon before "+label)}
                try record("start",label)
                icon.tap()
                Thread.sleep(forTimeInterval:stage == "receive" ? 12 : 7)
                let attachment = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
                attachment.name = label; attachment.lifetime = .keepAlways; add(attachment)
                try record("stop",label)
                if XCUIApplication(bundleIdentifier:"com.apple.webapp").state == .runningForeground || !icon.isHittable {
                    XCUIDevice.shared.press(.home)
                }
            }
        }
    }

    func testRetainedBookmark() throws {try compare("middle", "Form")}
    enum Failure: Error {case missing(String)}
}

