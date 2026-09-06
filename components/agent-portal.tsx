'use client';

import { useCallback, useEffect, useState, type SubmitEvent } from 'react';
import { AgentDashboard } from './agent-dashboard';
import type { AgentProfile } from '@/lib/agent-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { agentApi, AgentApiError } from '@/lib/agent-api';

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
      <main className="grid min-h-screen place-items-center">
        <p>Opening your account…</p>
      </main>
    );
  }

  if (profile) {
    return (
      <AgentDashboard profile={profile} onRefresh={refresh} onLogout={logout} />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">
          Skilld · Agent portal
        </p>
        <h1 className="mt-6 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with the phone number and password provided by your
          administrator.
        </p>
        <form onSubmit={login} className="mt-8 space-y-5">
          <label htmlFor="phone" className="block text-sm">
            Phone number
            <Input
              id="phone"
              className="mt-2"
              type="tel"
              autoComplete="username"
              required
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setForce(false);
              }}
            />
          </label>
          <label htmlFor="password" className="block text-sm">
            Password
            <Input
              id="password"
              className="mt-2"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy
              ? 'Signing in…'
              : force
                ? 'Sign in and end other session'
                : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          Need an account or a password reset? Contact your administrator.
        </p>
      </section>
    </main>
  );
}
