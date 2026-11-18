import { describe, expect, it } from 'vitest';
import { uploaderDisplayName } from './uploader';

describe('uploaderDisplayName', () => {
  it('運営投稿はサービス名を出す', () => {
    expect(uploaderDisplayName({ source: 'platform', uploader_name: null })).toBe('DiscoTQ');
  });

  it('ユーザー投稿は表示名を出す', () => {
    expect(uploaderDisplayName({ source: 'user', uploader_name: ' たろう ' })).toBe('たろう');
  });

  it('表示名が無いユーザー投稿はゲストにする', () => {
    expect(uploaderDisplayName({ source: 'user', uploader_name: null })).toBe('ゲスト');
    expect(uploaderDisplayName({ source: 'user', uploader_name: '  ' })).toBe('ゲスト');
  });
});
