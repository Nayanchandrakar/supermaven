import { createHash } from "node:crypto";

export const generateHash = (content: string): string =>
  createHash("md5").update(content).digest("hex").slice(0, 16);
