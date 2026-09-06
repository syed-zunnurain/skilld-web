'use client';

import { useEffect } from 'react';

export function ReferralAppLink({
  code,
  target,
}: {
  code: string;
  target?: string;
}) {
  const providerLink = `skilldprovider://register?referral_code=${encodeURIComponent(code)}`;
  const customerLink = `skilldcustomer://register?referral_code=${encodeURIComponent(code)}`;

  useEffect(() => {
    if (target === 'provider') window.location.href = providerLink;
    if (target === 'customer') window.location.href = customerLink;
  }, [target, providerLink, customerLink]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md space-y-6 rounded-3xl border bg-white p-8">
        <p className="font-semibold text-primary">Skilld invitation</p>
        <h1 className="text-2xl font-semibold">Continue in the mobile app</h1>
        <p className="text-sm text-muted-foreground">
          Your referral code will be filled in during registration. If the app
          is not installed, keep this code and enter it when you register.
        </p>
        <p className="break-all font-mono text-xl font-semibold">{code}</p>
        {target !== 'customer' && (
          <a
            className="block rounded-xl bg-primary p-3 text-center text-white"
            href={providerLink}
          >
            Open Skilld Provider
          </a>
        )}
        {target !== 'provider' && (
          <a
            className="block rounded-xl border p-3 text-center text-primary"
            href={customerLink}
          >
            Open Skilld Customer
          </a>
        )}
      </section>
    </main>
  );
}
