import { describe, expect, it } from 'vitest';
import { calcLevel, createHistoryEntry, generateGiftCode, lpReadKey, toggleId } from './user';

describe('calcLevel', () => {
  it('累計ポイントに応じてレベルが上がる', () => {
    expect(calcLevel(299, 'ブロンズ')).toBe('ブロンズ');
    expect(calcLevel(300, 'ブロンズ')).toBe('シルバー');
    expect(calcLevel(800, 'ブロンズ')).toBe('ゴールド');
    expect(calcLevel(2000, 'ブロンズ')).toBe('VIP');
  });

  it('閾値未満なら現在のレベルを維持する', () => {
    expect(calcLevel(100, 'ゴールド')).toBe('ゴールド');
  });
});

describe('toggleId', () => {
  it('含まれていなければ追加し、含まれていれば除去する', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('generateGiftCode', () => {
  it('DISCOTQ-XXXX-XXXX 形式のコードを生成する', () => {
    expect(generateGiftCode()).toMatch(/^DISCOTQ-[0-9A-Z]{1,4}-[0-9A-Z]{1,4}$/);
  });
});

describe('createHistoryEntry', () => {
  it('プレフィックス付き ID と渡した値で履歴を作る', () => {
    const entry = createHistoryEntry('ph-ex-', 'リワード交換: テスト', -100, 'exchange');
    expect(entry.id).toMatch(/^ph-ex-\d+$/);
    expect(entry).toMatchObject({ title: 'リワード交換: テスト', points: -100, type: 'exchange' });
    expect(entry.date).not.toBe('');
  });
});

describe('lpReadKey', () => {
  it('LP 閲覧済みキーを返す', () => {
    expect(lpReadKey('ad-1')).toBe('lp-ad-1');
  });
});
