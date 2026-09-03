import katex from 'katex';

import type { RawSpan } from './source-audit.mts';

export type FormulaRendering = {
  latex: string;
  accessibleText: string;
};

type ScriptPosition = 'base' | 'subscript' | 'superscript';

type BaselineGeometry = {
  fontSize: number;
  glyphCenterY: number;
  originY: number;
};

type TextRendering = FormulaRendering;

const OPERATOR_NAMES = new Set(['GELU', 'ReLU', 'log', 'max', 'min', 'softmax']);
const ROMAN_NAMES = new Set(['Loss', 'MSE', 'SquaredError']);

const SYMBOLS: Readonly<
  Record<string, { latex: string; accessibleText?: string }>
> = {
  '−': { latex: '-', accessibleText: '-' },
  '‐': { latex: '-', accessibleText: '-' },
  '‑': { latex: '-', accessibleText: '-' },
  '–': { latex: '-', accessibleText: '-' },
  '×': { latex: '\\times' },
  '⋅': { latex: '\\cdot' },
  '·': { latex: '\\cdot' },
  '≤': { latex: '\\le' },
  '≥': { latex: '\\ge' },
  '≈': { latex: '\\approx' },
  '→': { latex: '\\rightarrow' },
  '←': { latex: '\\leftarrow' },
  '∈': { latex: '\\in' },
  '∝': { latex: '\\propto' },
  '∣': { latex: '\\mid' },
  '∼': { latex: '\\sim' },
  '∑': { latex: '\\sum' },
  '∏': { latex: '\\prod' },
  '∂': { latex: '\\partial' },
  '∇': { latex: '\\nabla' },
  '∞': { latex: '\\infty' },
  '√': { latex: '\\sqrt{}' },
  '⋯': { latex: '\\cdots' },
  '…': { latex: '\\ldots' },
  '′': { latex: "'" },
  '∶': { latex: ':', accessibleText: ':' },
};

const GREEK: Readonly<Record<string, string>> = {
  α: '\\alpha',
  β: '\\beta',
  γ: '\\gamma',
  δ: '\\delta',
  ε: '\\varepsilon',
  ϵ: '\\epsilon',
  ζ: '\\zeta',
  η: '\\eta',
  θ: '\\theta',
  ϑ: '\\vartheta',
  ι: '\\iota',
  κ: '\\kappa',
  λ: '\\lambda',
  μ: '\\mu',
  ν: '\\nu',
  ξ: '\\xi',
  ο: 'o',
  π: '\\pi',
  ϖ: '\\varpi',
  ρ: '\\rho',
  ϱ: '\\varrho',
  σ: '\\sigma',
  ς: '\\varsigma',
  τ: '\\tau',
  υ: '\\upsilon',
  φ: '\\varphi',
  ϕ: '\\phi',
  χ: '\\chi',
  ψ: '\\psi',
  ω: '\\omega',
  Γ: '\\Gamma',
  Δ: '\\Delta',
  Θ: '\\Theta',
  Λ: '\\Lambda',
  Ξ: '\\Xi',
  Π: '\\Pi',
  Σ: '\\Sigma',
  Υ: '\\Upsilon',
  Φ: '\\Phi',
  Ψ: '\\Psi',
  Ω: '\\Omega',
};

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function visibleCharacterCount(span: RawSpan): number {
  return [...span.textRaw].filter((character) => !/\s/u.test(character)).length;
}

function dominantBaseline(spans: readonly RawSpan[]): BaselineGeometry {
  const visible = spans.filter((span) => visibleCharacterCount(span) > 0);
  if (visible.length === 0) {
    throw new Error('Cannot transcribe an empty one-line formula');
  }

  const maximumSize = Math.max(...visible.map((span) => span.size));
  // Upright labels are commonly 9.9626pt beside 12.5515pt math operators.
  // They are base glyphs, while the actual scripts are 8.7861pt or 6.9738pt.
  const plausibleBaseSpans = visible.filter(
    (span) => span.size >= maximumSize * 0.74,
  );
  const rowTolerance = Math.max(0.9, maximumSize * 0.12);
  const rows: { glyphCenterY: number; spans: RawSpan[]; weight: number }[] = [];

  for (const span of plausibleBaseSpans) {
    const glyphCenterY = (span.bbox[1] + span.bbox[3]) / 2;
    const row = rows.find(
      (candidate) =>
        Math.abs(candidate.glyphCenterY - glyphCenterY) <= rowTolerance,
    );
    const weight = visibleCharacterCount(span) * span.size;
    if (row) {
      const oldWeight = row.weight;
      row.weight += weight;
      row.glyphCenterY =
        (row.glyphCenterY * oldWeight + glyphCenterY * weight) / row.weight;
      row.spans.push(span);
    } else {
      rows.push({ glyphCenterY, spans: [span], weight });
    }
  }

  const dominant = rows.sort(
    (left, right) =>
      right.weight - left.weight ||
      right.spans.length - left.spans.length ||
      left.glyphCenterY - right.glyphCenterY,
  )[0];
  return {
    fontSize: Math.max(...dominant.spans.map((span) => span.size)),
    glyphCenterY: dominant.glyphCenterY,
    originY: median(dominant.spans.map((span) => span.origin[1])),
  };
}

function scriptPosition(
  span: RawSpan,
  baseline: BaselineGeometry,
): ScriptPosition {
  if (span.size > baseline.fontSize * 0.86) return 'base';

  const glyphCenterY = (span.bbox[1] + span.bbox[3]) / 2;
  const boxDelta = glyphCenterY - baseline.glyphCenterY;
  const originDelta = span.origin[1] - baseline.originY;
  const boxThreshold = baseline.fontSize * 0.14;
  const originThreshold = baseline.fontSize * 0.16;
  const boxDirection =
    Math.abs(boxDelta) > boxThreshold ? Math.sign(boxDelta) : 0;
  const originDirection =
    Math.abs(originDelta) > originThreshold ? Math.sign(originDelta) : 0;

  // bbox is the primary signal. origin corroborates it, or resolves only a
  // visible box displacement; this avoids PyMuPDF's inherited script origin.
  const direction =
    boxDirection !== 0 && (originDirection === 0 || boxDirection === originDirection)
      ? boxDirection
      : originDirection !== 0 && Math.abs(boxDelta) > baseline.fontSize * 0.08
        ? originDirection
        : 0;
  if (direction < 0) return 'superscript';
  if (direction > 0) return 'subscript';
  return 'base';
}

function unsupported(character: string, source: string): never {
  const codePoint = character.codePointAt(0)?.toString(16).toUpperCase();
  throw new Error(
    `Unsupported formula glyph ${JSON.stringify(character)} (U+${codePoint ?? 'UNKNOWN'}) in ${JSON.stringify(source)}`,
  );
}

function renderWord(
  word: string,
  sourceUpright: boolean,
  inScript: boolean,
): string {
  if (word === 'mod') return '\\bmod';
  if (OPERATOR_NAMES.has(word)) return `\\operatorname{${word}}`;
  if (ROMAN_NAMES.has(word) || (sourceUpright && !inScript)) {
    return `\\mathrm{${word}}`;
  }
  return word;
}

function accentedLetter(letter: string): TextRendering {
  const accessibleText = `${letter}\u0302`.normalize('NFC');
  return { latex: `\\hat{${letter}}`, accessibleText };
}

function renderText(
  value: string,
  sourceUpright: boolean,
  inScript: boolean,
): TextRendering {
  const normalized = value
    .replaceAll('ŷ', '\u0302y')
    .replaceAll('Ŷ', '\u0302Y')
    .normalize('NFKD');
  const characters = [...normalized];
  const latex: string[] = [];
  const accessibleText: string[] = [];

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    if (character === '\u0302') {
      let predictedIndex = index + 1;
      while (characters[predictedIndex] === ' ') predictedIndex += 1;
      const predicted = characters[predictedIndex];
      if (!predicted || !/[A-Za-z]/u.test(predicted)) {
        unsupported(character, value);
      }
      const rendered = accentedLetter(predicted);
      latex.push(rendered.latex);
      accessibleText.push(rendered.accessibleText);
      index = predictedIndex;
      continue;
    }
    if (/[A-Za-z]/u.test(character)) {
      let end = index + 1;
      while (end < characters.length && /[A-Za-z]/u.test(characters[end])) {
        if (characters[end + 1] === '\u0302') break;
        end += 1;
      }
      const word = characters.slice(index, end).join('');
      latex.push(renderWord(word, sourceUpright, inScript));
      accessibleText.push(word === 'mod' ? ' mod ' : word);
      index = end - 1;
      continue;
    }
    if (
      (character === ':' || character === '∶') &&
      characters[index + 1] === '='
    ) {
      latex.push('\\mathrel{:=}');
      accessibleText.push(':=');
      index += 1;
      continue;
    }
    if (/\p{Script=Han}/u.test(character)) {
      let end = index + 1;
      while (end < characters.length && /\p{Script=Han}/u.test(characters[end])) {
        end += 1;
      }
      const text = characters.slice(index, end).join('');
      latex.push(`\\text{${text}}`);
      accessibleText.push(text);
      index = end - 1;
      continue;
    }
    const greek = GREEK[character];
    if (greek) {
      latex.push(greek);
      accessibleText.push(character);
      continue;
    }
    const symbol = SYMBOLS[character];
    if (symbol) {
      latex.push(symbol.latex);
      accessibleText.push(symbol.accessibleText ?? character);
      continue;
    }
    if (/[0-9\s.,;:!?=+*/()[\]<>]/u.test(character)) {
      latex.push(character);
      accessibleText.push(character);
      continue;
    }
    if (character === '-') {
      latex.push('-');
      accessibleText.push('-');
      continue;
    }
    const escaped = ({
      '$': '\\$',
      '%': '\\%',
      '#': '\\#',
      '&': '\\&',
      '_': '\\_',
      '{': '\\{',
      '}': '\\}',
      '|': '\\mid',
    } as Readonly<Record<string, string>>)[character];
    if (escaped) {
      latex.push(escaped);
      accessibleText.push(character);
      continue;
    }
    unsupported(character, value);
  }

  return {
    latex: concatenateLatex(latex),
    accessibleText: accessibleText.join(''),
  };
}

function concatenateLatex(fragments: readonly string[]): string {
  let output = '';
  for (const fragment of fragments) {
    if (
      /\\[A-Za-z]+$/u.test(output) &&
      (/^[A-Za-z]/u.test(fragment) || /^\\[A-Za-z]/u.test(fragment))
    ) {
      output += ' ';
    }
    output += fragment;
  }
  return output;
}

function script(marker: '^' | '_', value: string): string {
  return /^[A-Za-z0-9]$/u.test(value) ? `${marker}${value}` : `${marker}{${value}}`;
}

function endsWithAttachableBase(value: string): boolean | undefined {
  const visible = [...value].filter((character) => !/\s/u.test(character));
  if (visible.length === 0) return undefined;
  return /[\p{L}\p{N})\]}′]/u.test(visible.at(-1)!);
}

function normalizeLatex(value: string): string {
  return value
    .replaceAll('\\mathrel{:=}', '\uE000')
    .replace(/\s+/gu, ' ')
    .replace(/\s*=\s*/gu, ' = ')
    .replace(
      /\s*(\\(?:approx|bmod|cdots|cdot|ge|in|leftarrow|le|mid|propto|rightarrow|sim|times))(?![A-Za-z])\s*/gu,
      ' $1 ',
    )
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .replace(/\s+,/gu, ',')
    .replaceAll('\uE000', '\\mathrel{:=}')
    .trim();
}

function normalizeAccessibleText(value: string): string {
  return value
    .replace(/\s+/gu, ' ')
    .replace(/\s*\bmod\b\s*/gu, ' mod ')
    .replace(/\s*([=×⋅≤≥≈→←∈∝∣])\s*/gu, ' $1 ')
    .replace(/:\s+=/gu, ' :=')
    .replace(/\(\s+/gu, '(')
    .replace(/\s+\)/gu, ')')
    .replace(/\s+,/gu, ',')
    .trim();
}

export function transcribeOneLineFormula(
  spans: readonly RawSpan[],
): FormulaRendering {
  const baseline = dominantBaseline(spans);
  const latex: string[] = [];
  const accessibleText: string[] = [];
  let hasAttachableBase = false;

  for (let index = 0; index < spans.length; ) {
    const span = spans[index];
    const position = scriptPosition(span, baseline);
    if (position === 'base') {
      const rendered = renderText(
        span.textRaw,
        !span.font.includes('LatinModernMath'),
        false,
      );
      latex.push(rendered.latex);
      accessibleText.push(rendered.accessibleText);
      const attachable = endsWithAttachableBase(span.textRaw);
      if (attachable !== undefined) hasAttachableBase = attachable;
      index += 1;
      continue;
    }

    if (!hasAttachableBase) {
      throw new Error(
        `Unattached ${position} at source span ${JSON.stringify(span.id)}`,
      );
    }

    const marker = position === 'superscript' ? '^' : '_';
    const scriptLatex: string[] = [];
    const scriptAccessibleText: string[] = [];
    while (index < spans.length && scriptPosition(spans[index], baseline) === position) {
      const scriptSpan = spans[index];
      const rendered = renderText(
        scriptSpan.textRaw,
        !scriptSpan.font.includes('LatinModernMath'),
        true,
      );
      scriptLatex.push(rendered.latex);
      scriptAccessibleText.push(rendered.accessibleText);
      index += 1;
    }
    const compactLatex = concatenateLatex(scriptLatex).trim();
    const compactAccessibleText = scriptAccessibleText.join('').trim();
    if (compactLatex) latex.push(script(marker, compactLatex));
    if (compactAccessibleText) {
      accessibleText.push(script(marker, compactAccessibleText));
    }
  }

  const rendering = {
    latex: normalizeLatex(concatenateLatex(latex)),
    accessibleText: normalizeAccessibleText(accessibleText.join('')),
  };
  if (!rendering.latex || !rendering.accessibleText) {
    throw new Error('Cannot transcribe an empty one-line formula');
  }
  try {
    katex.renderToString(rendering.latex, {
      output: 'mathml',
      strict: 'error',
      throwOnError: true,
    });
  } catch (error) {
    throw new Error(
      `Invalid emitted LaTeX ${JSON.stringify(rendering.latex)}: ${String(error)}`,
    );
  }
  return rendering;
}
