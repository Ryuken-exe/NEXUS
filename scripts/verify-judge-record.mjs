import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const [file] = process.argv.slice(2);
const secret = process.env.JUDGE_SIGNING_SECRET;
if (!file || !secret) {
    console.error('Usage: JUDGE_SIGNING_SECRET=<shared-key> node scripts/verify-judge-record.mjs <record.json>');
    process.exit(2);
}

const record = JSON.parse(await readFile(file, 'utf8'));
const hash = createHash('sha256').update(record.payload).digest('hex');
const signature = createHmac('sha256', secret).update(hash).digest('hex');
const equal = (left, right) => {
    const a = Buffer.from(left); const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
};
const valid = equal(hash, record.recordHash) && equal(signature, record.signature);
console.log(valid ? 'VALID: record payload and signature match.' : 'INVALID: record was changed or signed with another key.');
process.exit(valid ? 0 : 1);