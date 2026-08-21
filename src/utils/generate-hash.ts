import { createHash } from "node:crypto";

export function generateHash(content: string): string {
  return createHash("md5").update(content).digest("hex").slice(0, 16);
}
