import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getCourse } from '../src/content/course-runtime';
import { getLocalizedCourse } from '../src/content/english/localize-course';
import {
  englishExampleFiles,
  translateExample,
} from '../src/content/english/examples/translate-examples';
import { flattenSections } from '../src/content/load-course';
import type { ContentBlock } from '../src/content/schema';

// Select complete definitions, never concatenate top-level demonstration calls.
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--locale=en'))
  throw new Error('Supported option: --locale=en');
const english = args.includes('--locale=en');
const localized = english ? getLocalizedCourse('en') : undefined;
if (localized?.untranslatedCount)
  throw new Error(
    'Finish missing translations before exporting English examples',
  );
const sections = (localized?.course ?? getCourse()).units.flatMap(
  flattenSections,
);
// A fresh English staging directory cannot accidentally bundle an old run,
// checkpoint, virtual environment, or Chinese maintenance script.
const output = english
  ? join(
      mkdtempSync(join(tmpdir(), 'ai-learning-examples-en-')),
      'course_examples_en',
    )
  : join(process.cwd(), 'course_examples');
mkdirSync(output, { recursive: true });
if (english) {
  for (const name of englishExampleFiles) {
    const source = readFileSync(join('course_examples', name), 'utf8');
    writeFileSync(join(output, name), translateExample(name, source));
  }
  for (const split of ['train', 'validation'])
    cpSync(
      join('course_examples/data/documents', split),
      join(output, 'data/documents', split),
      { recursive: true },
    );
  for (const name of [
    'README.md',
    'LEARNING_ROUTE.md',
    'requirements.txt',
    'data/documents/README.md',
  ]) {
    mkdirSync(join(output, name, '..'), { recursive: true });
    cpSync(join('src/content/english/examples', name), join(output, name));
  }
}
function python(prefix: string): string[] {
  const matches = sections.filter((section) =>
    section.id.startsWith(`${prefix}-`),
  );
  if (matches.length !== 1)
    throw new Error(`Ambiguous example section ${prefix}`);
  return matches[0].blocks
    .filter(
      (block): block is Extract<ContentBlock, { type: 'code' }> =>
        block.type === 'code' &&
        block.language === 'python' &&
        block.filename !== 'week11_minimal_loop.py',
    )
    .map((block) => block.code);
}
const write = (name: string, chunks: string[]) =>
  writeFileSync(join(output, name), chunks.join('\n\n\n') + '\n');
write('mini_gpt_walkthrough.py', [
  english
    ? '"""Week 10 complete definitions. Importing does not train, generate or save files."""'
    : '"""Week 10 完整定义。Import 不训练、不生成、不保存文件。"""',
  ...['o0352', 'o0357', 'o0360', 'o0361', 'o0374'].flatMap(python),
  `def main() -> None:
    torch.set_num_threads(1)
    torch.manual_seed(7)
    model = MiniGPT(GPTConfig()).eval()
    idx = torch.tensor([[0, 1], [4, 1]], dtype=torch.long)
    targets = torch.tensor([[1, 2], [1, 0]], dtype=torch.long)
    with torch.no_grad():
        logits, loss = model(idx, targets)
        changed_future, _ = model(torch.tensor([[0, 1], [0, 4]]))
    assert logits.shape == (2, 2, 5)
    assert loss is not None and loss.ndim == 0
    assert sum(p.numel() for p in model.parameters()) == 520
    torch.testing.assert_close(changed_future[0, 0], changed_future[1, 0])
    print("parameters=520; logits=(2,2,5); causal_check=PASS; loss=", loss.item())


if __name__ == "__main__":
    main()`,
]);
write('week11_training_and_generation.py', [
  english
    ? '"""Week 11 complete functions. Importing does not train, generate or save files."""'
    : '"""Week 11 完整函数。Import 不训练、不生成、不保存文件。"""',
  ...[
    'o0379',
    'o0387',
    'o0389',
    'o0393',
    'o0394',
    'o0396',
    'o0397',
    'o0402',
    'o0403',
  ].flatMap(python),
]);
write('week12_end_to_end.py', python('o0427'));
// The Week 9 readable tokenizer is deliberately a separate ID space.
write('w09_readable_v1.py', python('o0337'));
const minimalLoop = sections
  .flatMap((section) => section.blocks)
  .filter(
    (block): block is Extract<ContentBlock, { type: 'code' }> =>
      block.type === 'code' && block.filename === 'week11_minimal_loop.py',
  );
if (minimalLoop.length !== 1)
  throw new Error('Expected one standalone minimal training loop');
write('week11_minimal_loop.py', [minimalLoop[0].code]);
console.log(
  'Exported complete Week 9–12 modules and the standalone minimal training loop.',
);
if (english) {
  const archive = join(
    process.cwd(),
    'public/downloads/course-examples-en.zip',
  );
  cpSync(
    join(output, 'README.md'),
    join(process.cwd(), 'public/downloads/course-examples-en-readme.txt'),
  );
  // Python's standard library creates the archive; no packaging dependency or
  // model download is needed. Only the freshly generated course directory enters it.
  execFileSync(
    process.env.COURSE_PYTHON ?? 'python',
    [
      '-c',
      'import pathlib,sys,zipfile; root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.parent.mkdir(parents=True,exist_ok=True)\nwith zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:\n for p in sorted(root.rglob("*")):\n  if p.is_file(): z.write(p,pathlib.Path(root.name)/p.relative_to(root))',
      output,
      archive,
    ],
    { stdio: 'inherit' },
  );
  console.log(`English examples: ${output}\nDownload archive: ${archive}`);
}
