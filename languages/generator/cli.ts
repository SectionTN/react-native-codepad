import { runReport } from './report.ts';

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'report':
    process.stdout.write(`${runReport()}\n`);
    break;
  default:
    process.stderr.write(
      `usage: node languages/generator/cli.ts report\nunknown command: ${command ?? ''} ${args.join(' ')}\n`,
    );
    process.exit(2);
}
