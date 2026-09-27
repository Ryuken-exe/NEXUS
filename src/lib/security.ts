import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function hashIp(ip: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET must be configured');
    return createHmac('sha256', secret).update(ip).digest('hex');
}

export function signRecord(payload: string) {
    const secret = process.env.JUDGE_SIGNING_SECRET;
    if (!secret) throw new Error('JUDGE_SIGNING_SECRET must be configured');
    const hash = createHash('sha256').update(payload).digest('hex');
    const signature = createHmac('sha256', secret).update(hash).digest('hex');
    return { hash, signature };
}

export function verifyRecord(payload: string, hash: string, signature: string, secret: string) {
    const expectedHash = createHash('sha256').update(payload).digest('hex');
    const expectedSignature = createHmac('sha256', secret).update(expectedHash).digest('hex');
    return safeEqual(expectedHash, hash) && safeEqual(expectedSignature, signature);
}

function safeEqual(left: string, right: string) {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}

export function csv(rows: Record<string, unknown>[], columns: string[]) {
    const quote = (value: unknown) => {
        let text = String(value ?? '').replaceAll('"', '""');
        if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = `'${text}`;
        return `"${text}"`;
    };
    return [columns.map(quote).join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n');
}