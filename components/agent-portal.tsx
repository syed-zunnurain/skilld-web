'use client';

import { ArrowRight, LoaderCircle, LockKeyhole, Phone } from 'lucide-react';
import { useCallback, useEffect, useState, type SubmitEvent } from 'react';

import { AgentDashboard } from '@/components/agent-dashboard';
import { SkilldBrand } from '@/components/skilld-brand';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { agentApi, AgentApiError } from '@/lib/agent-api';
import type { AgentProfile } from '@/lib/agent-types';

export function AgentPortal() {
  const [profile, setProfile] = useState<AgentProfile>();
  const [checking, setChecking] = useState(true);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [force, setForce] = useState(false);

  const refresh = useCallback(async () => {
    const result = await agentApi<AgentProfile>('agent/profile');
    setProfile(result.data);
  }, []);

  useEffect(() => {
    let current = true;

    agentApi<AgentProfile>('agent/profile')
      .then((result) => {
        if (current) setProfile(result.data);
      })
      .catch((error) => {
        if (
          current &&
          !(error instanceof AgentApiError && [401, 403].includes(error.status))
        ) {
          setError(error.message);
        }
      })
      .finally(() => {
        if (current) setChecking(false);
      });

    return () => {
      current = false;
    };
  }, []);

  async function logout() {
    try {
      await agentApi('auth/logout', 'POST', {});
    } catch (error) {
      if (
        !(error instanceof AgentApiError && [401, 403].includes(error.status))
      ) {
        throw error;
      }
    }

    setProfile(undefined);
    setPassword('');
    setError('');
    setForce(false);
  }

  async function login(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      await agentApi('auth/login', 'POST', { phone, password, force });
      await refresh();
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
      setForce(e instanceof AgentApiError && e.status === 409);
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="grid min-h-svh place-items-center px-5">
        <div className="space-y-6">
          <SkilldBrand />
          <output className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Opening your account…
          </output>
        </div>
      </main>
    );
  }

  if (profile) {
    return (
      <AgentDashboard profile={profile} onRefresh={refresh} onLogout={logout} />
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-5 py-10 sm:py-16">
      <div className="w-full max-w-md space-y-7">
        <SkilldBrand />
        <Card className="rounded-2xl py-7 sm:py-8">
          <CardContent className="px-6 sm:px-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              Sign in to track your referrals and manage your earnings.
            </p>
            <form onSubmit={login} className="mt-7">
              <fieldset disabled={busy} className="space-y-5">
                <Field>
                  <FieldLabel htmlFor="phone">Phone number</FieldLabel>
                  <div className="relative">
                    <Phone
                      className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="phone"
                      className="form-input pl-11"
                      type="tel"
                      autoComplete="username"
                      placeholder="923001234567"
                      required
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value);
                        setForce(false);
                      }}
                    />
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <div className="relative">
                    <LockKeyhole
                      className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="password"
                      className="form-input pl-11"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </div>
                </Field>
                {error && (
                  <Alert variant="destructive" className="p-3">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <Button
                  type="submit"
                  className="h-12 w-full gap-2 rounded-xl px-4 whitespace-normal"
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  ) : null}
                  {busy
                    ? 'Signing in…'
                    : force
                      ? 'Sign in and end other session'
                      : 'Sign in'}
                  {!busy && <ArrowRight aria-hidden="true" />}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
        <p className="px-3 text-center text-sm leading-relaxed text-muted-foreground">
          Use the credentials provided by your administrator. Contact them if
          you need an account or a password reset.
        </p>
      </div>
    </main>
  );
}
