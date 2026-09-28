export class ApiError extends Error {
    constructor(message: string, public status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

export async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
    const response = await fetch(input, init);
    const payload = await response.json().catch(() => null) as unknown;
    if (!response.ok) {
        const body = payload as { error?: string | { message?: string } } | null;
        const message = typeof body?.error === 'string' ? body.error : body?.error?.message;
        throw new ApiError(message ?? `Request failed (${response.status})`, response.status);
    }
    return payload as T;
}

export function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}