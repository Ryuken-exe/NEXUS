import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 60_000,
    use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure' },
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { DATABASE_URL: 'postgresql://dogfood:dogfood@localhost:5432/dogfood?schema=public', JWT_SECRET: 'local-docker-jwt-secret-change-for-production', JUDGE_SIGNING_SECRET: 'local-docker-judge-secret-change-for-production' }
    }
});