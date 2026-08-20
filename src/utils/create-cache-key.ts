export function createCacheKey(...parts: Array<string | number>) {
    let key = '';

    for (const part of parts) {
        const typePrefix = typeof part === 'number' ? 'n' : 's'
        const value = String(part);
        key += `${typePrefix}${value.length}:${value}|`;
    }

    return key;
}
