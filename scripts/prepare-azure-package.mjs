import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

// Build artifacts only: never prune or modify the development node_modules.
// Use a new directory outside the checkout to expose missing runtime packages.
const root = process.cwd();
const source = join(root, 'dist', 'standalone');
const destinationArg = process.argv[2];
if (!destinationArg || !isAbsolute(destinationArg)) {
  throw new Error(
    'Usage: node scripts/prepare-azure-package.mjs <new absolute directory outside checkout>',
  );
}
const destination = resolve(destinationArg);
const fromRoot = relative(root, destination);
const toRoot = relative(destination, root);
const isOutside = (path) =>
  path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path);
if (!isOutside(fromRoot) || !isOutside(toRoot) || existsSync(destination)) {
  throw new Error(
    'Destination must not exist and must not be inside or contain the checkout',
  );
}
for (const entry of [
  'server.js',
  'package.json',
  'dist/server/index.js',
  'dist/client',
  'node_modules',
  'public/downloads/course-examples.zip',
]) {
  if (!existsSync(join(source, entry)))
    throw new Error(
      `Missing standalone output: ${entry}; run pnpm build first`,
    );
}

function measure(directory) {
  let bytes = 0;
  let files = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    // Count physical files once; pnpm's development tree includes symlinks.
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      const child = measure(path);
      bytes += child.bytes;
      files += child.files;
    } else if (entry.isFile()) {
      bytes += statSync(path).size;
      files++;
    }
  }
  return { bytes, files };
}

mkdirSync(destination);
cpSync(source, destination, { recursive: true, dereference: true });
const manifestPath = join(destination, 'package.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
// Bypass the development CLI, which imports build tools even for `start`.
manifest.scripts = { start: 'node server.js' };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const metrics = {
  developmentDependencies: measure(join(root, 'node_modules')),
  runtimeDependencies: measure(join(destination, 'node_modules')),
  deploymentPackage: measure(destination),
};
console.log(JSON.stringify(metrics, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = Object.entries(metrics).map(
    ([name, value]) =>
      `| ${name} | ${(value.bytes / 1024 / 1024).toFixed(2)} | ${value.files} |`,
  );
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `\n### Azure package size (uncompressed)\n\n| Scope | MiB | Files |\n| --- | ---: | ---: |\n${rows.join('\n')}\n\nPhysical files counted once; symlinks excluded. ZIP size is reported after archiving.\n`,
  );
}
