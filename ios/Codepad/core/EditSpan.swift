/// One edit in old document coordinates, with the line bounds that decide where line decorations go.
struct EditSpan: Sendable {
  let start: Int
  let oldEnd: Int
  let newLength: Int
  let startLine: Int
  let startLineStart: Int
  let startLineEnd: Int
  let endLine: Int
  let endLineEnd: Int
  let insertedLines: Int
  let revision: Int

  private var delta: Int { newLength - (oldEnd - start) }

  /// The spec's underline table, first matching row wins. Nil when the range is gone.
  func mapUnderline(_ u: Underline) -> Underline? {
    let s = u.start
    let e = u.end
    let a = start
    let b = oldEnd
    let ns: Int
    let ne: Int
    if a == b && a == s {
      ns = s + newLength
      ne = e + newLength
    } else if a == b && a == e {
      ns = s
      ne = e
    } else if b <= s {
      ns = s + delta
      ne = e + delta
    } else if a >= e {
      ns = s
      ne = e
    } else if s <= a && b <= e {
      ns = s
      ne = e + delta
    } else if a <= s && e <= b {
      return nil
    } else if a < s {
      ns = a + newLength
      ne = e + delta
    } else {
      ns = s
      ne = a
    }
    guard ns < ne else { return nil }
    var out = u
    out.start = ns
    out.end = ne
    return out
  }

  /// The line `line` ends up on, or -1 when the edit removed it.
  func mapLine(_ line: Int) -> Int {
    if line < startLine { return line }
    if line > endLine { return line + insertedLines - (endLine - startLine) }
    // Lines strictly inside the span end inside the removed text, so oldEnd stands in for their end.
    let x: Int
    if line == endLine {
      x = endLineEnd
    } else if line == startLine {
      x = startLineEnd
    } else {
      x = oldEnd
    }
    if x <= start { return line }
    if x > oldEnd { return startLine + insertedLines }
    let gone = line != startLine || (start == startLineStart && oldEnd > x)
    return gone ? -1 : startLine
  }

  /// Built right after the document took `change`, so text outside the change still reads as before it.
  static func of(_ change: Change, _ doc: Document) -> EditSpan {
    let a = change.start
    let n = change.inserted.utf16.count
    let startLine = doc.lineAt(a)
    let after = a + n
    let endLineEnd = change.end + (doc.lineEnd(doc.lineAt(after)) - after)
    let removed = breaks(change.removed)
    let inserted = breaks(change.inserted)
    return EditSpan(
      start: a,
      oldEnd: change.end,
      newLength: n,
      startLine: startLine,
      startLineStart: doc.lineStart(startLine),
      startLineEnd: removed.first < 0 ? endLineEnd : a + removed.first,
      endLine: startLine + removed.count,
      endLineEnd: endLineEnd,
      insertedLines: inserted.count,
      revision: change.revision
    )
  }

  /// Newline count and the UTF-16 index of the first one, -1 when there is none.
  private static func breaks(_ s: String) -> (count: Int, first: Int) {
    var count = 0
    var first = -1
    var i = 0
    for unit in s.utf16 {
      if unit == 10 {
        if first < 0 { first = i }
        count += 1
      }
      i += 1
    }
    return (count, first)
  }
}
