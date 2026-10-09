export const css = `/* Layout tokens shared by every screen. */
:root {
  --gap: 8px;
  --radius: 6px;
  --accent: #1f6feb;
}

.editor,
.toolbar {
  display: flex;
  gap: var(--gap);
  border-radius: var(--radius);
}

.toolbar > button:hover:not([disabled]) {
  background-color: color-mix(in srgb, var(--accent) 80%, white);
  transform: translateY(-1px);
}

@media (max-width: 600px) {
  .editor {
    flex-direction: column;
    font-size: 0.875rem;
  }
}
`;
