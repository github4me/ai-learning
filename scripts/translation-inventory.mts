import { getCourse } from '../src/content/course-runtime';
import { translateGlossary, translateValue } from '../src/content/english/localize-course';

// Read-only editorial inventory, not a prose keyword test. Exact source keys
// intentionally expose stale translations after a source edit.
const selected = process.argv.find((arg) => arg.startsWith('--unit='))?.split('=')[1];
const limit = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? Infinity);
const offset = Number(process.argv.find((arg) => arg.startsWith('--offset='))?.split('=')[1] ?? 0);
const course = getCourse();
const units = [{ ...course.overview, slug: 'overview' }, ...course.units];
let total = 0;
for (const unit of units) {
  if (selected && unit.slug !== selected) continue;
  const missing = new Set<string>();
  translateValue(unit, missing);
  total += missing.size;
  if (selected) console.log(JSON.stringify([...missing].slice(offset, offset + limit), null, 2));
  else console.log(`${unit.slug}: ${missing.size} untranslated source strings`);
}
if (!selected || selected === 'glossary') {
  const missing = new Set<string>();
  translateGlossary(missing);
  total += missing.size;
  if (selected) console.log(JSON.stringify([...missing].slice(offset, offset + limit), null, 2));
  else console.log(`glossary: ${missing.size}; total unit/glossary occurrences: ${total}`);
}

if (process.argv.includes('--check') && total > 0) process.exitCode = 1;
