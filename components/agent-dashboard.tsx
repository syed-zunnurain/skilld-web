'use client';

import {
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Link2,
  LogOut,
  Users,
  Wallet,
  HandCoins,
  UserRound,
} from 'lucide-react';
import { useState } from 'react';

import { AgentAccount } from '@/components/agent-account';
import { AgentReferrals } from '@/components/agent-referrals';
import { AgentWallet } from '@/components/agent-wallet';
import { AgentWithdrawals } from '@/components/agent-withdrawals';
import { Feedback } from '@/components/agent-ui';
import { SkilldBrand } from '@/components/skilld-brand';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { money, type AgentProfile } from '@/lib/agent-types';

export function AgentDashboard({
  profile,
  onRefresh,
  onLogout,
}: {
  profile: AgentProfile;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [tab, setTab] = useState('referrals');
  const [error, setError] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    setError('');

    try {
      await onLogout();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign out.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-svh">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <SkilldBrand />
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm sm:block">
              {profile.agent.name}
            </span>
            <Button
              variant="ghost"
              className="h-10 gap-2 px-2 sm:px-3"
              disabled={loggingOut}
              onClick={logout}
              aria-label={loggingOut ? 'Signing out' : 'Sign out'}
            >
              <LogOut aria-hidden="true" />
              <span className="hidden sm:inline">
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Referrals & earnings
          </h1>
          <p className="mt-1.5 break-words text-sm text-muted-foreground">
            Welcome back, {profile.agent.name}.
          </p>
        </div>
        {error && <Feedback tone="error">{error}</Feedback>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Card className="col-span-2 rounded-2xl sm:col-span-1">
            <CardContent className="px-5 py-1">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="size-4 text-primary" aria-hidden="true" />{' '}
                Wallet balance
              </p>
              <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums">
                {money(
                  profile.agent.wallet_amount,
                  profile.agent.wallet_currency,
                )}
              </p>
            </CardContent>
          </Card>
          {[
            {
              label: 'Pending referrals',
              value: profile.stats.pending,
              icon: Clock3,
            },
            {
              label: 'Approved referrals',
              value: profile.stats.approved,
              icon: CircleCheck,
            },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="rounded-2xl">
              <CardContent className="px-4 py-1 sm:px-5">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Icon
                    className="mt-0.5 hidden size-4 shrink-0 sm:block"
                    aria-hidden="true"
                  />
                  {label}
                </p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          className="gap-5"
        >
          <TabsList
            variant="line"
            aria-label="Agent account"
            className="w-full justify-start border-b p-0 group-data-horizontal/tabs:h-12"
          >
            {[
              { value: 'referrals', label: 'Referrals', icon: Users },
              { value: 'wallet', label: 'Wallet', icon: Wallet },
              { value: 'withdrawals', label: 'Withdrawals', icon: HandCoins },
              { value: 'account', label: 'Account', icon: UserRound },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="gap-2 rounded-none px-1 data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-0 sm:flex-none sm:px-5"
              >
                <Icon className="hidden sm:block" aria-hidden="true" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="referrals" className="space-y-5">
            <ReferralInvite profile={profile} />
            <AgentReferrals />
          </TabsContent>
          <TabsContent value="wallet">
            <AgentWallet />
          </TabsContent>
          <TabsContent value="withdrawals">
            <AgentWithdrawals profile={profile} onRefresh={onRefresh} />
          </TabsContent>
          <TabsContent value="account">
            <AgentAccount agent={profile.agent} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ReferralInvite({ profile }: { profile: AgentProfile }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState('');

  async function copy(target: 'code' | 'link') {
    setError('');
    setCopied(null);

    try {
      await navigator.clipboard.writeText(
        target === 'code'
          ? profile.agent.referral_code
          : profile.agent.share_url,
      );
      setCopied(target);
    } catch {
      setError('Unable to copy. Select and copy the code or link below.');
    }
  }

  return (
    <Card className="gap-4 rounded-2xl bg-primary-soft py-5 ring-primary/15">
      <CardHeader className="gap-2 px-5 sm:px-6">
        <h2 className="text-base font-semibold">Invite a provider</h2>
        <CardDescription className="max-w-2xl leading-relaxed">
          {profile.program.rewards_enabled
            ? `Earn ${money(profile.program.reward_amount)} when a provider you refer is approved. The reward amount at approval applies.`
            : 'Rewards are currently paused. You can still invite providers and track their approval.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-5 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 max-w-full items-center gap-3 rounded-xl border border-primary/15 bg-card py-1 pr-1 pl-4">
            <span className="min-w-0 break-all font-mono text-base font-semibold tracking-wide">
              {profile.agent.referral_code}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-primary"
              aria-label={
                copied === 'code'
                  ? 'Referral code copied'
                  : 'Copy referral code'
              }
              onClick={() => copy('code')}
            >
              {copied === 'code' ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
            </Button>
          </div>
          <Button className="h-11 gap-2 px-4" onClick={() => copy('link')}>
            {copied === 'link' ? (
              <Check aria-hidden="true" />
            ) : (
              <Link2 aria-hidden="true" />
            )}
            {copied === 'link' ? 'Link copied' : 'Copy invite link'}
          </Button>
        </div>
        <p className="break-all text-xs leading-relaxed text-muted-foreground">
          {profile.agent.share_url}
        </p>
        <output className="sr-only">
          {copied ? `Referral ${copied} copied to clipboard.` : ''}
        </output>
        {error && <Feedback tone="error">{error}</Feedback>}
      </CardContent>
    </Card>
  );
}
