export type AccountType = 'customer' | 'provider';

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export type PhoneCheckResult = {
  status: 'exists' | 'verified' | 'otp_required';
  retry_after_seconds?: number;
  registered_as?: AccountType;
};

export type RegistrationPayload = {
  name: string;
  phone: string;
  email: string | null;
  password: string;
  referral_code?: string;
  id_number?: string;
};

export class SkilldApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: Record<string, string[]> = {},
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'SkilldApiError';
  }

  fieldError(field: string): string | undefined {
    return this.errors[field]?.[0];
  }
}

async function postSkilld<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`/api/skilld/${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });

    const body = await response.text();
    let envelope: ApiEnvelope<T>;

    try {
      envelope = body ? (JSON.parse(body) as ApiEnvelope<T>) : { success: response.ok };
    } catch {
      throw new SkilldApiError(
        'Skilld is temporarily unavailable. Please try again.',
        response.status,
      );
    }

    if (!response.ok || envelope.success === false) {
      throw new SkilldApiError(
        envelope.message || 'We could not complete that request. Please try again.',
        response.status,
        envelope.errors,
        (envelope.data ?? {}) as Record<string, unknown>,
      );
    }

    return envelope.data as T;
  } catch (error) {
    if (error instanceof SkilldApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SkilldApiError('The request took too long. Please try again.', 408);
    }

    throw new SkilldApiError(
      'We could not reach Skilld. Check your connection and try again.',
      0,
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export function checkPhone(phone: string, accountType: AccountType) {
  return postSkilld<PhoneCheckResult>('auth/check', {
    phone,
    user_type: accountType,
  });
}

export function verifyOtp(phone: string, otp: string) {
  return postSkilld<{ status: 'verified' }>('auth/otp/verify', { phone, otp });
}

export function registerAccount(accountType: AccountType, payload: RegistrationPayload) {
  const route = accountType === 'customer' ? 'auth/customers/register' : 'auth/providers/register';
  return postSkilld<Record<string, unknown>>(route, payload);
}
