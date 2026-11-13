import { describe, expect, it } from 'vitest';
import {
  fitWithin,
  formatBytes,
  formatDuration,
  resolveVideoMime,
  validateDuration,
  validateVideoFile,
} from './videoFile';

const config = {
  max_upload_bytes: 10 * 1024 * 1024,
  allowed_mime_types: ['video/mp4', 'video/webm', 'video/quicktime'] as const,
};

describe('resolveVideoMime', () => {
  it('MIME があればそれを使う', () => {
    expect(resolveVideoMime({ type: 'video/webm', name: 'a.bin' })).toBe('video/webm');
  });
  it('MIME が空なら拡張子で判定する', () => {
    expect(resolveVideoMime({ type: '', name: 'IMG_0001.MOV' })).toBe('video/quicktime');
    expect(resolveVideoMime({ type: '', name: 'clip.m4v' })).toBe('video/mp4');
  });
  it('非対応形式は null', () => {
    expect(resolveVideoMime({ type: 'video/x-msvideo', name: 'a.avi' })).toBeNull();
  });
});

describe('validateVideoFile', () => {
  const cfg = { ...config, allowed_mime_types: [...config.allowed_mime_types] };
  it('許可形式・上限内なら null', () => {
    expect(validateVideoFile({ type: 'video/mp4', name: 'a.mp4', size: 1000 }, cfg)).toBeNull();
  });
  it('形式・サイズ違反を検出する', () => {
    expect(validateVideoFile({ type: 'image/png', name: 'a.png', size: 1 }, cfg)).toMatch('MP4');
    expect(validateVideoFile({ type: 'video/mp4', name: 'a.mp4', size: 0 }, cfg)).toMatch('空');
    expect(validateVideoFile({ type: 'video/mp4', name: 'a.mp4', size: 11 * 1024 * 1024 }, cfg)).toMatch('10.0 MB');
  });
});

describe('validateDuration', () => {
  it('上限を超えたらメッセージを返す', () => {
    expect(validateDuration(60, 60)).toBeNull();
    expect(validateDuration(60.2, 60)).toMatch('61 秒');
  });
});

describe('format helpers', () => {
  it('formatBytes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
  it('formatDuration', () => {
    expect(formatDuration(65.4)).toBe('1:05');
    expect(formatDuration(null)).toBe('-');
  });
  it('fitWithin は長辺を収め、小さい画像は拡大しない', () => {
    expect(fitWithin(1080, 1920, 720)).toEqual({ width: 405, height: 720 });
    expect(fitWithin(320, 240, 720)).toEqual({ width: 320, height: 240 });
  });
});
