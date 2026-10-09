export const go = `package main

import (
	"errors"
	"fmt"
	"strings"
)

// Document keeps lines as the editor does, one slice entry per line.
type Document struct {
	lines []string
}

var ErrOutOfRange = errors.New("line out of range")

func (d *Document) Line(index int) (string, error) {
	if index < 0 || index >= len(d.lines) {
		return "", fmt.Errorf("line %d: %w", index, ErrOutOfRange)
	}
	return d.lines[index], nil
}

func main() {
	doc := &Document{lines: strings.Split("alpha\\nbeta\\ngamma", "\\n")}
	for i := range doc.lines {
		if line, err := doc.Line(i); err == nil {
			fmt.Printf("%02d %q\\n", i, line)
		}
	}
}
`;
