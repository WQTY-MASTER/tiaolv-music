import { createDecipheriv } from 'node:crypto';

const responseKey = [122, 63, 140, 29, 94, 155, 47, 10, 108, 77, 126, 139, 31, 58, 92, 157, 14, 43, 111, 74, 129];
export function responseBytes(data: unknown) {
  return Buffer.from(Buffer.from(JSON.stringify(data)).map((byte, index) => byte ^ responseKey[index % responseKey.length]));
}
export function decodeRequest(body: string) {
  const bytes = Buffer.from(body, 'base64');
  const cipher = createDecipheriv('aes-128-gcm', Buffer.from([189, 48, 95, 16, 208, 255, 116, 182, 239, 84, 218, 184, 53, 181, 225, 207]), bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString('utf8');
}
