import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from './db';

export async function dispatchWebhook(eventId: string, eventName: string, payload: Record<string, unknown>) {
    const hooks = await db.webhook.findMany({ where: { eventId, enabled: true } });
    await Promise.all(hooks.map(async (hook) => {
        let statusCode: number | undefined;
        try {
            const body = JSON.stringify({ event: eventName, data: payload, sentAt: new Date().toISOString() });
            const signature = createHmac('sha256', hook.secret).update(body).digest('hex');
            const response = await fetch(hook.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-dogfood-signature': signature }, body, signal: AbortSignal.timeout(5000) });
            statusCode = response.status;
        } catch { statusCode = 0; }
        await db.webhookDelivery.create({ data: { webhookId: hook.id, eventName, payload: payload as Prisma.InputJsonValue, statusCode } });
    }));
}