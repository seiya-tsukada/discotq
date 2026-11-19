import { describe, expect, it } from 'vitest';
import { setIdIn, toGiftItem, toHistoryEntry } from './user';

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

describe('toHistoryEntry', () => {
  it('台帳の行を履歴の表示用に変換する', () => {
    const entry = toHistoryEntry({
      id: 'x',
      kind: 'exchange',
      points: -300,
      title: 'リワード交換: テスト',
      video_id: null,
      gift_id: 'gift-5',
      gift_code: 'DISCOTQ-AAAA-BBBB-CCCC',
      created_at: '2026-11-19T03:04:05Z',
    });
    expect(entry).toMatchObject({ id: 'x', kind: 'exchange', points: -300, giftCode: 'DISCOTQ-AAAA-BBBB-CCCC' });
    expect(entry.date).not.toBe('');
  });
});

describe('toGiftItem', () => {
  it('API のギフトを画面用の形に変換する', () => {
    expect(
      toGiftItem({
        id: 'gift-1',
        name: 'A',
        brand: 'B',
        points_cost: 500,
        icon_url: 'u',
        category: 'c',
        stock: 1,
        popular: true,
        value_description: 'd',
      })
    ).toEqual({
      id: 'gift-1',
      name: 'A',
      brand: 'B',
      pointsCost: 500,
      iconUrl: 'u',
      category: 'c',
      stock: 1,
      popular: true,
      valueDescription: 'd',
    });
  });
});
