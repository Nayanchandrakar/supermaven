export const createCacheKey = (...parts: (string | number)[]): string => {
  let key = "";

  for (const part of parts) {
    const value = String(part);
    const typePrefix = Number.isInteger(part) ? "n" : "s";
    key += `${typePrefix}${value.length}:${value}|`;
  }

  return key;
};
