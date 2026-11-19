import { describe, expect, it } from 'vitest';
import { nextMove, prevMove } from './feedNavigation';

describe('nextMove', () => {
  it('途中なら次へ進む', () => {
    expect(nextMove({ index: 0, count: 3, hasMore: false })).toEqual({ type: 'go', index: 1 });
  });

  it('末尾で続きがあれば読み込む', () => {
    expect(nextMove({ index: 2, count: 3, hasMore: true })).toEqual({ type: 'loadMore' });
  });

  it('全件読み込み済みの末尾からは先頭に戻る', () => {
    expect(nextMove({ index: 2, count: 3, hasMore: false })).toEqual({ type: 'go', index: 0 });
  });

  it('1 件だけ・0 件なら動かない', () => {
    expect(nextMove({ index: 0, count: 1, hasMore: false })).toEqual({ type: 'none' });
    expect(nextMove({ index: 0, count: 0, hasMore: false })).toEqual({ type: 'none' });
  });
});

describe('prevMove', () => {
  it('途中なら前へ戻る', () => {
    expect(prevMove({ index: 2, count: 3, hasMore: true })).toEqual({ type: 'go', index: 1 });
  });

  it('全件読み込み済みの先頭からは末尾へ回る', () => {
    expect(prevMove({ index: 0, count: 3, hasMore: false })).toEqual({ type: 'go', index: 2 });
  });

  it('続きがある間は先頭から末尾へは回らない（本当の末尾が分からないため）', () => {
    expect(prevMove({ index: 0, count: 3, hasMore: true })).toEqual({ type: 'none' });
  });

  it('1 件だけなら動かない', () => {
    expect(prevMove({ index: 0, count: 1, hasMore: false })).toEqual({ type: 'none' });
  });
});
