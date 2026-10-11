import { decryptQrcLyric, extractQrcContent } from '../../../src/util/qrcDecrypt';

describe('QRC lyric decoding', () => {
  test('decrypts a pinned QQ Music QRC payload', () => {
    const encrypted = 'B5B302E9D93FE91A623AB8C85F7B63D75EF437514B12C750753D73020E0FC4F9A06F6E682A30B71C';

    expect(decryptQrcLyric(encrypted)).toBe('[1000,2000]密(1000,500)文(1500,500)');
  });

  test('extracts and unescapes the timed lyric content from QRC XML', () => {
    expect(extractQrcContent('<Lyric_1 LyricType="1" LyricContent="[1000,500]你(1000,500)&amp;我"/>'))
      .toBe('[1000,500]你(1000,500)&我');
  });
});
