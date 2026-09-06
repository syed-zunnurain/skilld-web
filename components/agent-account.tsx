'use client';

import { LoaderCircle } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';

import { Feedback } from '@/components/agent-ui';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { agentApi } from '@/lib/agent-api';
import type { Agent } from '@/lib/agent-types';

export function AgentAccount({ agent }: { agent: Agent }) {
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setNotice('');
    setError('');

    if (data.get('password') !== data.get('password_confirmation')) {
      setError('The new passwords do not match.');
      form
        .querySelector<HTMLInputElement>('[name="password_confirmation"]')
        ?.focus();
      return;
    }

    setBusy(true);

    try {
      await agentApi('agent/password', 'PUT', Object.fromEntries(data));
      form.reset();
      setNotice('Password updated.');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Unable to update password.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-0 rounded-2xl py-0">
      <CardHeader className="gap-1 border-b px-5 py-5 sm:px-6">
        <h2 className="text-base font-semibold">Account settings</h2>
        <CardDescription className="break-words">
          {agent.name} · {agent.phone}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 px-5 py-6 md:grid-cols-2 md:gap-12 sm:px-6">
        <div>
          <h3 className="font-medium">Change password</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Choose a password with at least 8 characters. Contact your
            administrator if you need to update your account details.
          </p>
        </div>
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="space-y-5">
            <Field>
              <FieldLabel htmlFor="current-password">
                Current password
              </FieldLabel>
              <Input
                id="current-password"
                className="form-input h-11"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                className="form-input h-11"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={255}
                aria-describedby="password-hint"
                required
              />
              <FieldDescription id="password-hint">
                At least 8 characters.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">
                Confirm new password
              </FieldLabel>
              <Input
                id="confirm-password"
                className="form-input h-11"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={255}
                required
              />
            </Field>
            {notice && <Feedback tone="success">{notice}</Feedback>}
            {error && <Feedback tone="error">{error}</Feedback>}
            <div className="border-t pt-5">
              <Button type="submit" className="h-11 gap-2 px-4">
                {busy && (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                )}
                {busy ? 'Saving…' : 'Update password'}
              </Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
