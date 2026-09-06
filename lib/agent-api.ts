export class AgentApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function agentApi<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' = 'GET',
  body?: Record<string, unknown>,
): Promise<{
  data: T;
  meta?: {
    current_page: number;
    last_page: number;
    total: number;
    next_cursor?: string | null;
    has_more?: boolean;
  };
}> {
  const options: RequestInit = {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
  };

  if (method !== 'GET' && body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api/skilld/${path}`, options);
  const data = (await response.json()) as {
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
    data: T;
    meta?: {
      current_page: number;
      last_page: number;
      total: number;
      next_cursor?: string | null;
      has_more?: boolean;
    };
  };
  if (!response.ok || !data.success) {
    throw new AgentApiError(
      Object.values(data.errors ?? {})
        .flat()
        .join(' ') ||
        data.message ||
        'The request failed.',
      response.status,
    );
  }

  return data;
}
