import UIKit
import XCTest

@testable import Codepad

/// Holds one full screen editor on the simulator for a look. Skipped unless the runner passes
/// TEST_RUNNER_CODEPAD_SHOWCASE_SECONDS, so the suite never waits on it.
@MainActor
final class ShowcaseTests: XCTestCase {
  private let sample = """
    // A quick tour of the editor
    import { useState } from 'react';

    export function Counter({ start = 0 }) {
      const [count, setCount] = useState(start);
      const label = `clicked ${count} times`;
      return (
        <button onClick={() => setCount(count + 1)}>
          {label}
        </button>
      );
    }

    const limits = { min: 1, max: 42 };
    for (let i = limits.min; i < limits.max; i++) {
      if (i % 7 === 0) console.log("seven", i);
    }
    """

  func testHoldsTheEditorOnScreen() throws {
    guard let value = ProcessInfo.processInfo.environment["CODEPAD_SHOWCASE_SECONDS"], let seconds = TimeInterval(value)
    else { throw XCTSkip("set TEST_RUNNER_CODEPAD_SHOWCASE_SECONDS to hold the editor on screen") }
    for window in Host.windows { window.isHidden = true }
    guard let scene = UIApplication.shared.connectedScenes.first(where: { $0 is UIWindowScene }) as? UIWindowScene
    else { throw XCTSkip("no window scene") }
    let window = UIWindow(windowScene: scene)
    window.frame = scene.screen.bounds
    window.windowLevel = .alert + 1
    let editor = CodeEditorView()
    let controller = UIViewController()
    controller.view = editor
    window.rootViewController = controller
    window.makeKeyAndVisible()
    Host.windows.append(window)
    let insets = window.safeAreaInsets
    editor.setFont(family: nil, size: 14, lineHeight: 1.4)
    editor.setContentInsets(top: insets.top, bottom: insets.bottom, left: 0, right: 0)
    editor.setLanguage("javascript")
    editor.setInitialText(sample)
    editor.core.setSelection(anchor: 60, head: 60)
    RunLoop.main.run(until: Date(timeIntervalSinceNow: seconds))
  }
}
