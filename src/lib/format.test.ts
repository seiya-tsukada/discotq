import { describe, expect, it } from 'vitest';
import { formatCount } from './format';

describe('formatCount', () => {
  it('1万未満はそのまま表示する', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(9999)).toBe('9999');
  });

  it('1万以上は小数第1位までの「万」で表示する（切り捨て）', () => {
    expect(formatCount(10_000)).toBe('1万');
    expect(formatCount(12_345)).toBe('1.2万');
    expect(formatCount(19_999)).toBe('1.9万');
    expect(formatCount(1_230_000)).toBe('123万');
  });
});
