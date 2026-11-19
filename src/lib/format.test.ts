import { describe, expect, it } from 'vitest';
import { formatCount, formatTimeAgo } from './format';

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

describe('formatTimeAgo', () => {
  const now = new Date('2026-11-18T12:00:00');
  const ago = (sec: number) => new Date(now.getTime() - sec * 1000).toISOString();

  it('経過時間に応じて単位を変える', () => {
    expect(formatTimeAgo(ago(30), now)).toBe('たった今');
    expect(formatTimeAgo(ago(5 * 60), now)).toBe('5分前');
    expect(formatTimeAgo(ago(3 * 3600), now)).toBe('3時間前');
    expect(formatTimeAgo(ago(2 * 86_400), now)).toBe('2日前');
  });

  it('7日以上前は日付で表示する', () => {
    expect(formatTimeAgo(new Date('2026-11-01T09:00:00').toISOString(), now)).toBe('11月1日');
    expect(formatTimeAgo(new Date('2025-12-31T09:00:00').toISOString(), now)).toBe('2025年12月31日');
  });

  it('端末の時計がずれて未来の日時でも「たった今」にする', () => {
    expect(formatTimeAgo(ago(-120), now)).toBe('たった今');
  });
});
