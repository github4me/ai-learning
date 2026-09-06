import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCourse } from '../src/content/course-runtime';
import { flattenSections } from '../src/content/load-course';
import type { ContentBlock } from '../src/content/schema';

// Select complete definitions, never concatenate top-level demonstration calls.
const sections = getCourse().units.flatMap(flattenSections);
const output = join(process.cwd(), 'course_examples');
mkdirSync(output, { recursive: true });
function python(prefix: string): string[] {
  const matches = sections.filter(section => section.id.startsWith(`${prefix}-`));
  if (matches.length !== 1) throw new Error(`Ambiguous example section ${prefix}`);
  return matches[0].blocks
    .filter((block): block is Extract<ContentBlock, { type: 'code' }> =>
      block.type === 'code' && block.language === 'python')
    .map(block => block.code);
}
const write = (name: string, chunks: string[]) =>
  writeFileSync(join(output, name), chunks.join('\n\n\n') + '\n');
write('mini_gpt_walkthrough.py', [
  '"""Week 10 完整定义。Import 不训练、不生成、不保存文件。"""',
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
  '"""Week 11 完整函数。Import 不训练、不生成、不保存文件。"""',
  ...['o0379', 'o0387', 'o0389', 'o0393', 'o0394', 'o0396', 'o0397', 'o0402', 'o0403'].flatMap(python),
]);
write('week12_end_to_end.py', python('o0427'));
// The Week 9 readable tokenizer is deliberately a separate ID space.
write('w09_readable_v1.py', python('o0337'));
console.log('Exported complete Week 9–12 Python modules from the displayed course.');

