export function parseArg (args: string[]) {
  return process.argv.find(el => args.some(f => new RegExp(`^${f}`, 'i').test(el)));
}
