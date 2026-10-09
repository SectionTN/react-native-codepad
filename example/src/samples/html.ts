export const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Codepad</title>
    <style>
      :root { --accent: #1f6feb; }
      .hero h1 { color: var(--accent); font-size: 2rem; }
      .hero p:first-of-type { margin-top: 0; }
    </style>
  </head>
  <body>
    <!-- The script and style blocks below are highlighted through injection. -->
    <main class="hero" style="padding: 24px; background: #fff">
      <h1>A native code editor</h1>
      <p>Tree-sitter highlighting, Nitro binding, no WebView.</p>
      <button id="go" type="button" disabled>Try it</button>
    </main>
    <script>
      const button = document.getElementById("go");
      button.addEventListener("click", () => console.log("clicked", Date.now()));
    </script>
  </body>
</html>
`;
