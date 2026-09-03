import { describe, expect, it } from 'vitest';

import { validateGeneratedContent } from '@/scripts/validate-content.mts';

describe('content validator', () => {
  it('recomputes every fidelity gate from raw extraction and generated artifacts', () => {
    expect(() => validateGeneratedContent()).not.toThrow();
  });
});
