import { CacheEntry } from "@/types";

export class BoundedCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private groupIndex: Map<string, Set<string>> = new Map();

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) {
      throw new Error("maxSize must be atleast 1");
    }
  }

  invalidateGroup(groupKey: string): number {
    const keys = this.groupIndex.get(groupKey);
    let count = 0;

    if (!keys) {
      return 0;
    }

    for (const key of keys) {
      if (this.cache.delete(key)) {
        count++;
      }
    }

    this.groupIndex.delete(groupKey);
    return count;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt !== null && now > entry.expiresAt) {
      this.deleteEntry(key, entry);
      return undefined;
    }

    entry.lastAccessed = Date.now();
    entry.accessCount++;
    return entry.value;
  }

  set(
    key: string,
    value: T,
    options?: {
      ttlMs?: number | null;
      groupKey?: string | null;
    }
  ) {
    const existing = this.cache.get(key);
    const now = Date.now();
    const ttlMs = options?.ttlMs ?? null;
    const groupKey = options?.groupKey ?? null;

    if (existing) {
      this.deleteEntry(key, existing);
    }

    while (this.cache.size >= this.maxSize) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry<T> = {
      value,
      expiresAt: ttlMs !== null ? now + ttlMs : null,
      lastAccessed: now,
      accessCount: 1,
      groupKey
    };

    this.cache.set(key, entry);

    if (groupKey !== null) {
      let keys = this.groupIndex.get(groupKey);
      if (!keys) {
        keys = new Set();
        this.groupIndex.set(groupKey, keys);
      }
      keys.add(key);
    }
  }

  private evictLeastUsed() {
    let lowestScore = Infinity;
    let evictKey: string | null = null;
    const now = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.deleteEntry(key, entry);
        return;
      }

      const ageSeconds = Math.max(1, (now - entry.lastAccessed) / 1000);

      const score = entry.accessCount / ageSeconds;

      if (score < lowestScore) {
        lowestScore = score;
        evictKey = key;
      }
    }

    if (evictKey !== null) {
      const entry = this.cache.get(evictKey);
      if (entry) {
        this.deleteEntry(evictKey, entry);
      }
    }
  }

  private deleteEntry(key: string, entry: CacheEntry<T>): void {
    this.cache.delete(key);

    if (entry.groupKey !== null) {
      const keys = this.groupIndex.get(entry.groupKey);

      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.groupIndex.delete(entry.groupKey);
        }
      }
    }
  }

  clear() {
    this.cache.clear();
    this.groupIndex.clear();
  }
}
