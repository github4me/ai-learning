import type { Course, SectionNode } from '../schema';

// Only reading order changes here; content lives in the reviewed chapter files.
// Legacy section numbers and anchors remain valid for saved links and references.
const readingOrders: Record<string, string[]> = {
  'week-06': [
    'o0222',
    'o0223',
    'o0235',
    'o0229',
    'o0225',
    'o0228',
    'o0237',
    'o0239',
    'o0241',
    'o0243',
    'o0232',
    'o0230',
    'o0244',
    'o0246',
    'o0234',
    'o0247',
    'o0250',
    'o0251',
    'o0252',
    'o0253',
  ],
  'week-09': [
    'o0319',
    'o0321',
    'o0326',
    'o0327',
    'o0331',
    'o0337',
    'o0340',
    'o0343',
    'o0344',
    'o0345',
    'o0346',
    'o0341',
    'o0342',
    'o0334',
    'o0335',
    'o0333',
    'o0347',
    'o0348',
    'o0349',
  ],
  'week-10': [
    'o0351',
    'o0352',
    'o0354',
    'o0355',
    'o0357',
    'o0358',
    'o0360',
    'o0361',
    'o0363',
    'o0364',
    'o0365',
    'o0372',
    'o0373',
    'o0375',
    'o0376',
    'o0371',
    'o0374',
    'o0377',
  ],
  'week-11': [
    'o0379',
    'o0380',
    'o0381',
    'o0384',
    'o0387',
    'o0390',
    'o0391',
    'o0393',
    'o0394',
    'o0395',
    'o0396',
    'o0398',
    'o0399',
    'o0400',
    'o0401',
    'o0402',
    'o0403',
    'o0404',
    'o0405',
    'o0411',
    'o0389',
    'o0397',
    'o0412',
  ],
};

function reorder(sections: SectionNode[], prefixes: string[]): SectionNode[] {
  const result = prefixes.map((prefix) => {
    const matches = sections.filter((section) =>
      section.id.startsWith(`${prefix}-`),
    );
    if (matches.length !== 1)
      throw new Error(`Reading order has a stale section: ${prefix}`);
    return matches[0];
  });
  if (
    result.length !== sections.length ||
    new Set(result.map((section) => section.id)).size !== sections.length
  )
    throw new Error(
      'Reading order must preserve every direct section exactly once',
    );
  return result;
}

function groupWeekThree(sections: SectionNode[]): SectionNode[] {
  const byNumber = new Map(
    sections.map((section) => [
      Number(section.title.match(/^(\d+)\./u)?.[1]),
      section,
    ]),
  );
  const groups = [
    {
      title: '学习单元一：从线性预测到一个神经元',
      numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    {
      title: '学习单元二：先看 ReLU，再理解非线性',
      numbers: [10, 12, 13, 11, 14, 15, 16, 17],
    },
    {
      title: '学习单元三：两层网络的完整计算',
      numbers: Array.from({ length: 19 }, (_, i) => i + 18),
    },
    {
      title: '学习单元四：代码、输出选择与独立练习',
      numbers: Array.from({ length: 22 }, (_, i) => i + 37),
    },
  ];
  const used = new Set<string>();
  const deepen = (node: SectionNode): SectionNode => ({
    ...node,
    navDepth: node.navDepth + 1,
    showInToc: false,
    children: node.children.map(deepen),
  });
  const result = groups.map((group, i): SectionNode => {
    const children = group.numbers.map((number) => {
      const section = byNumber.get(number);
      if (!section || used.has(section.id))
        throw new Error(`Week 3 grouping is stale at ${number}`);
      used.add(section.id);
      return deepen(section);
    });
    return {
      id: `clarity-week-03-unit-${i + 1}`,
      aliases: [],
      title: group.title,
      navDepth: 2,
      showInToc: true,
      isCompletable: false,
      source: children[0].source,
      blocks: [],
      children,
    };
  });
  if (used.size !== sections.length)
    throw new Error('Week 3 grouping omitted original content');
  return result;
}

export function arrangeLearningUnits(course: Course): Course {
  return {
    ...course,
    units: course.units.map((unit) => {
      if (unit.kind !== 'week') return unit;
      if (unit.weekNumber === 3)
        return { ...unit, children: groupWeekThree(unit.children) };
      const order = readingOrders[unit.slug];
      return order
        ? { ...unit, children: reorder(unit.children, order) }
        : unit;
    }),
  };
}
