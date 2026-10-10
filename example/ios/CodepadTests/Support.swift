import CoreGraphics
import UIKit
import XCTest

@testable import Codepad

/// Hosts one editor in a window without React, the TestActivity twin. Each launch hides the previous window.
/// The window sits below the status bar, whose glass blur would wash out pixels rendered under it.
@MainActor
enum Host {
  static var windows: [UIWindow] = []
  static let top: CGFloat = 160
}

@MainActor
func launch(width: CGFloat = 300, height: CGFloat = 200) -> CodeEditorView {
  for window in Host.windows { window.isHidden = true }
  let editor = CodeEditorView()
  editor.setFont(family: nil, size: 16, lineHeight: 1.4)
  let scene = UIApplication.shared.connectedScenes.first { $0 is UIWindowScene } as? UIWindowScene
  let window = scene.map { UIWindow(windowScene: $0) } ?? UIWindow()
  window.frame = CGRect(x: 0, y: Host.top, width: width, height: height)
  window.windowLevel = .alert + 1
  let controller = UIViewController()
  controller.view = editor
  window.rootViewController = controller
  window.makeKeyAndVisible()
  Host.windows.append(window)
  layout(editor, width: width, height: height)
  return editor
}

/// Sizes the window and the editor, then runs the pending frame loop.
@MainActor
func layout(_ view: UIView, width: CGFloat = 300, height: CGFloat = 200) {
  view.window?.frame = CGRect(x: 0, y: Host.top, width: width, height: height)
  view.window?.layoutIfNeeded()
  view.frame = CGRect(x: 0, y: 0, width: width, height: height)
  view.layoutIfNeeded()
}

/// Runs the pending frame loop and renders the result, the Android draw(view) twin.
@MainActor
@discardableResult
func draw(_ editor: CodeEditorView) -> UIImage {
  editor.layoutIfNeeded()
  return render(editor)
}

@MainActor
func render(_ view: UIView) -> UIImage {
  let format = UIGraphicsImageRendererFormat()
  format.scale = view.traitCollection.displayScale
  format.opaque = true
  return UIGraphicsImageRenderer(bounds: view.bounds, format: format).image { context in
    if !view.drawHierarchy(in: view.bounds, afterScreenUpdates: true) {
      print("drawHierarchy failed, rendering the layer tree")
      view.layer.render(in: context.cgContext)
    }
  }
}

/// Writes a rendered image to the app's temporary directory for a look after a failed pixel assertion.
@discardableResult
func savePNG(_ image: UIImage, _ name: String) -> String {
  let url = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("\(name).png")
  try? image.pngData()?.write(to: url)
  print("saved \(url.path)")
  return url.path
}

/// RGBA bytes of a rendered image, decoded once for the pixel assertions.
struct Pixels {
  let width: Int
  let height: Int
  let scale: CGFloat
  private var bytes: [UInt8]

  init(_ image: UIImage) {
    guard let cg = image.cgImage else { fatalError("no bitmap behind the image") }
    width = cg.width
    height = cg.height
    scale = image.scale
    bytes = [UInt8](repeating: 0, count: cg.width * cg.height * 4)
    bytes.withUnsafeMutableBytes { raw in
      let ctx = CGContext(
        data: raw.baseAddress, width: cg.width, height: cg.height, bitsPerComponent: 8, bytesPerRow: cg.width * 4,
        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
      ctx?.draw(cg, in: CGRect(x: 0, y: 0, width: cg.width, height: cg.height))
    }
  }

  subscript(x: Int, y: Int) -> (r: Int, g: Int, b: Int, a: Int) {
    let i = (y * width + x) * 4
    return (Int(bytes[i]), Int(bytes[i + 1]), Int(bytes[i + 2]), Int(bytes[i + 3]))
  }
}

func pixel(_ image: UIImage, x: Int, y: Int) -> (r: Int, g: Int, b: Int, a: Int) {
  Pixels(image)[x, y]
}

/// Spins the run loop until the editor holds a snapshot of the current document revision.
@MainActor
func waitForSnapshot(
  _ editor: CodeEditorView, timeout: TimeInterval = 5, file: StaticString = #filePath, line: UInt = #line
) {
  let deadline = Date(timeIntervalSinceNow: timeout)
  while editor.snapshotRevision != editor.core.document.revision {
    if Date() > deadline {
      XCTFail("no snapshot for revision \(editor.core.document.revision)", file: file, line: line)
      return
    }
    RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.02))
  }
}
