export function createRateLimiter(limit: number, windowMs: number, maxKeys = 10_000) {
    const windows = new Map<string, { startedAt: number; count: number }>();
    return (key: string, now = Date.now()) => {
        let entry = windows.get(key);
        if (!entry || now - entry.startedAt >= windowMs) {
            if (!entry && windows.size >= maxKeys) {
                for (const [storedKey, value] of windows) if (now - value.startedAt >= windowMs) windows.delete(storedKey);
                if (windows.size >= maxKeys) return false;
            }
            entry = { startedAt: now, count: 0 };
            windows.set(key, entry);
        }
        if (entry.count >= limit) return false;
        entry.count++;
        return true;
    };
}