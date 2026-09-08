// Exact, reviewed substitutions for standalone labs that are not exported from
// displayed definitions. Fail closed when source prose changes or Han text remains.
export const englishExampleFiles = [
  'course_data.py',
  'week01_linear_layer.py',
  'week02_loss_gradient.py',
  'week03_neuron.py',
  'week03_xor.py',
  'week04_gradient_check.py',
  'week05_three_ways.py',
  'week06_probability.py',
  'week06_bigram.py',
  'week07_attention.py',
  'week08_bridge.py',
  'week09_data_protocol.py',
  'week10_stages.py',
  'week11_adamw_numbers.py',
  'week12_generalization.py',
];
const replacements: Record<string, Record<string, string>> = {
  'week04_gradient_check.py': {
    'Week 4: 用不依赖求导规则的中央差分核对四个手算梯度。':
      'Week 4: compare four hand-calculated gradients with central differences, independently of differentiation rules.',
    'w1, b1, w2, b2；隐藏 pre-activation=2，避开 ReLU 折点。':
      'w1, b1, w2, b2; hidden pre-activation=2, away from the ReLU kink.',
  },
  'week03_neuron.py': {
    'Week 3: 隐藏层 ReLU，回归输出保持线性。无需第三方依赖。':
      'Week 3: hidden-layer ReLU with a linear regression output. Standard Python only.',
    每项输入必须有一个对应权重: 'Each input must have a corresponding weight',
    每个输出神经元必须有一个偏置: 'Each output neuron must have a bias',
  },
  'week09_data_protocol.py': {
    '我 喜欢 狗': 'you like dog',
    '我 喜欢': 'you like',
  },
  'week07_attention.py': {
    'AI after 我喜欢; 我 after 猫喜欢': 'AI after you like; you after we like',
  },
  'week06_probability.py': {
    'Weeks 6/7/8: 先用数字复现概率、标签冲突和规范化，不需要背微积分。':
      'Weeks 6/7/8: observe probabilities, conflicting targets and normalization numerically before memorizing calculus.',
    'token_order=[我,喜欢,AI,学习,猫]': 'token_order=[you,like,AI,study,we]',
    '除以 C=4，不是 C-1。': 'Divide by C=4, not C-1.',
    '一个 XOR 网络：验证表达能力，权重是手工设置的，并没有训练。':
      'An XOR network: demonstrate expressiveness using hand-set weights, not training.',
  },
  'week05_three_ways.py': {
    'Weeks 2/5: 相同数据、初始值、平均损失与步长，三种写法做同一步更新。':
      'Weeks 2/5: three implementations of one update using the same data, initial values, mean loss and learning rate.',
  },
  'course_data.py': {
    '("我", "喜欢", "AI", "学习", "猫")':
      '("you", "like", "AI", "study", "we")',
    '("我 喜欢 AI", "猫 喜欢 我", "我 学习 AI")':
      '("you like AI", "we like you", "you study AI")',
  },
  'week06_bigram.py': {
    'gradient of the 我 row:': 'gradient of the you row:',
    'updated 我 row:': 'updated you row:',
  },
  'week12_generalization.py': {
    '# 实验记录\\n\\n实际完成 ': '# Experiment record\\n\\nCompleted ',
    ' 次更新；CPU，seed=': ' parameter updates; CPU, seed=',
    '。\\n\\n': '.\\n\\n',
    '训练集 eval loss：': 'Training-set evaluation loss: ',
    '验证集 loss：': 'Validation loss: ',
    '保存/加载后同一输入 logits 最大差：':
      'Maximum logit difference on the same input after save/load: ',
    '。仅验证推理恢复，不是精确续训。':
      '. This checks inference reload, not exact training resumption.',
    '图来自 loss.csv，不是模拟曲线。文档少且同一文风，结果不代表真实语言能力。':
      'The chart is generated from loss.csv, not simulated. Few documents with a shared writing style do not establish real-world language ability.',
    '## 请学习者补写\\n\\n- 运行前预测：\\n- 观察与预期的差别：\\n- 三条生成样例有哪些局限：\\n- 下一次只改变什么：\\n':
      '## Complete your interpretation\\n\\n- Prediction before running:\\n- Differences between observation and prediction:\\n- Limitations of the three generated samples:\\n- One factor to change next:\\n',
  },
};

export function translateExample(name: string, source: string): string {
  let translated = source;
  for (const [before, after] of Object.entries(replacements[name] ?? {}).sort(
    (a, b) => b[0].length - a[0].length,
  )) {
    if (!translated.includes(before))
      throw new Error(`English example mapping is stale: ${name}: ${before}`);
    translated = translated.replaceAll(before, after);
  }
  if (/\p{Script=Han}/u.test(translated))
    throw new Error(`Untranslated instructional content in ${name}`);
  return translated;
}
