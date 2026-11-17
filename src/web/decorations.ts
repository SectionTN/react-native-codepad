/// <reference lib="dom" />
// Underline geometry, the same as DecorationPainter.kt: Chrome's wavy underline, measured at 14 px for thickness 1 to 4.

export function waveHalf(thickness: number): number {
  return (4 * thickness + 0.375) / 2;
}

// How far the centre line swings to either side.
export function waveAmplitude(thickness: number): number {
  return 0.875 * thickness;
}

// SVG path data, one quadratic per half wave, leaving the left edge on the centre line heading down.
export function wavePath(left: number, right: number, centre: number, thickness: number): string {
  const half = waveHalf(thickness);
  const swing = 2 * waveAmplitude(thickness);
  let d = `M${left} ${centre}`;
  let down = true;
  for (let x = left; x < right; x += half) {
    d += ` Q${x + half / 2} ${centre + (down ? swing : -swing)} ${x + half} ${centre}`;
    down = !down;
  }
  return d;
}

// The top of a solid underline: offset below the baseline, on a whole pixel like a browser draws it.
export function solidTop(rowTop: number, baseline: number, offset: number): number {
  return Math.round(rowTop + baseline + offset);
}

// From a row's top to its text baseline, in the root's font and line height.
export function measureBaseline(root: HTMLElement): number {
  const line = document.createElement('div');
  line.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';
  line.textContent = '0';
  const mark = document.createElement('span');
  mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline;';
  line.append(mark);
  root.append(line);
  const baseline = mark.getBoundingClientRect().top - line.getBoundingClientRect().top;
  line.remove();
  return baseline;
}
