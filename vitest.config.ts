import { defineConfig } from 'vitest/config';

process.env.JWT_SECRET ??= 'unit-test-jwt-secret';
process.env.JUDGE_SIGNING_SECRET ??= 'unit-test-judge-secret';

export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });