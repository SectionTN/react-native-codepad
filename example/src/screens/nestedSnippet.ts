/** The short document the nested demo sizes its editor to. */
export const NESTED_SNIPPET = [
  'function greet(name) {',
  '  const message = "Hello, " + name;',
  '  console.log(message);',
  '  return message;',
  '}',
  '',
  'const names = ["Ada", "Linus", "Grace"];',
  'for (const name of names) {',
  '  greet(name);',
  '}',
  '',
  'export default greet;',
].join('\n');
