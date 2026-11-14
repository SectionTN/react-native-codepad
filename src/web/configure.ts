let assetsUrl = '/codepad/';

// Where the browser loads the core and the languages from: the folder the web command filled, /codepad/ by default.
export function configureWeb(options: { assetsUrl?: string }): void {
  if (options.assetsUrl === undefined) return;
  assetsUrl = options.assetsUrl.endsWith('/') ? options.assetsUrl : `${options.assetsUrl}/`;
}

export function webAssetsUrl(): string {
  return assetsUrl;
}
