'use client';

import { ArrowUpRight, BriefcaseBusiness, UserRound } from 'lucide-react';
import { useEffect } from 'react';

import { SkilldBrand } from '@/components/skilld-brand';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    <main className="flex min-h-svh items-center justify-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-md space-y-7">
        <SkilldBrand label="Invitation" />
        <Card className="rounded-2xl py-7 sm:py-8">
          <CardContent className="space-y-6 px-6 sm:px-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                You’re invited to Skilld
              </h1>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Open the{' '}
                {target === 'provider'
                  ? 'provider'
                  : target === 'customer'
                    ? 'customer'
                    : 'Skilld'}{' '}
                app to register with your referral code.
              </p>
            </div>
            <div className="rounded-xl border border-primary/15 bg-primary-soft px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Your referral code
              </p>
              <p className="mt-2 break-all font-mono text-lg font-semibold tracking-wide">
                {code}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {target !== 'customer' && (
                <Button
                  className="h-11 gap-2 px-4"
                  nativeButton={false}
                  render={
                    <a
                      href={providerLink}
                      aria-label="Open Skilld Provider app"
                    />
                  }
                >
                  <BriefcaseBusiness aria-hidden="true" /> Provider app{' '}
                  <ArrowUpRight aria-hidden="true" />
                </Button>
              )}
              {target !== 'provider' && (
                <Button
                  variant={target === 'customer' ? 'default' : 'outline'}
                  className="h-11 gap-2 px-4"
                  nativeButton={false}
                  render={
                    <a
                      href={customerLink}
                      aria-label="Open Skilld Customer app"
                    />
                  }
                >
                  <UserRound aria-hidden="true" /> Customer app{' '}
                  <ArrowUpRight aria-hidden="true" />
                </Button>
              )}
            </div>
            <p className="border-t pt-5 text-sm leading-relaxed text-muted-foreground">
              Your code will be filled in automatically. If the app isn’t
              installed, keep this code and enter it when you register.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
