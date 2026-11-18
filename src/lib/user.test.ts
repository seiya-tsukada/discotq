import { describe, expect, it } from 'vitest';
import { calcLevel, createHistoryEntry, generateGiftCode, setIdIn } from './user';

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

describe('setIdIn', () => {
  it('on なら先頭に追加し、すでにあれば重複させない', () => {
    expect(setIdIn(['a'], 'b', true)).toEqual(['b', 'a']);
    expect(setIdIn(['a', 'b'], 'b', true)).toEqual(['b', 'a']);
  });

  it('off なら除去し、無ければそのまま', () => {
    expect(setIdIn(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(setIdIn(['a'], 'z', false)).toEqual(['a']);
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
