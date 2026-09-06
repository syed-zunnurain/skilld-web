'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SubmitEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { agentApi } from '@/lib/agent-api';
import {
  date,
  money,
  type AgentProfile,
  type Referral,
  type WalletTransaction,
  type Withdrawal,
} from '@/lib/agent-types';

type Tab = 'Referrals' | 'Wallet' | 'Withdrawals' | 'Account';

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 sm:p-7">
      <h2 className="mb-5 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <output className="block rounded-xl bg-secondary p-4 text-sm">
      {children}
    </output>
  );
}

function Table({
  headings,
  children,
}: {
  headings: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm [&_td]:border-t [&_td]:px-3 [&_td]:py-4 [&_th]:px-3 [&_th]:pb-3 [&_th]:font-medium [&_th]:text-muted-foreground">
        <thead>
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function AgentDashboard({
  profile,
  onRefresh,
  onLogout,
}: {
  profile: AgentProfile;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>('Referrals');
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied to clipboard.');
    } catch {
      setNotice('Select and copy the referral code or link below.');
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign out.');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div>
            <p className="font-semibold text-primary">Skilld</p>
            <p className="text-xs text-muted-foreground">Agent portal</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">{profile.agent.name}</span>
            <Button variant="outline" disabled={loggingOut} onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-8 sm:px-8">
        <div>
          <h1 className="text-3xl font-semibold">
            Your referrals and earnings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite providers and follow their progress.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Wallet balance', money(profile.agent.wallet_amount)],
            ['Pending referrals', profile.stats.pending],
            ['Approved referrals', profile.stats.approved],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-white p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-3 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <section className="rounded-2xl border border-teal-200 bg-primary-soft p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Invite a provider</h2>
              <p className="mt-2 text-sm">
                {profile.program.rewards_enabled
                  ? `Current reward: ${money(profile.program.reward_amount)} per approved provider. The amount at approval applies.`
                  : 'Agent rewards are currently paused. You can still refer providers and track their approval.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => copy(profile.agent.referral_code)}
              >
                Copy code
              </Button>
              <Button onClick={() => copy(profile.agent.share_url)}>
                Copy invite link
              </Button>
            </div>
          </div>
          <p className="mt-4 font-mono text-lg font-semibold">
            {profile.agent.referral_code}
          </p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {profile.agent.share_url}
          </p>
        </section>
        {notice && <Notice>{notice}</Notice>}
        <nav aria-label="Agent account" className="flex flex-wrap gap-2">
          {(['Referrals', 'Wallet', 'Withdrawals', 'Account'] as Tab[]).map(
            (item) => (
              <Button
                key={item}
                variant={tab === item ? 'default' : 'outline'}
                aria-current={tab === item ? 'page' : undefined}
                onClick={() => {
                  setTab(item);
                  setNotice('');
                }}
              >
                {item}
              </Button>
            ),
          )}
        </nav>
        {tab === 'Referrals' && <Referrals />}
        {tab === 'Wallet' && <Wallet />}
        {tab === 'Withdrawals' && (
          <Withdrawals profile={profile} onRefresh={onRefresh} />
        )}
        {tab === 'Account' && <Account />}
      </main>
    </div>
  );
}

function Referrals() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Referral[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;

    agentApi<Referral[]>(`agent/referrals?status=${status}&page=${page}`)
      .then((result) => {
        if (current) {
          setError('');
          setRows(result.data);
          setLastPage(result.meta?.last_page ?? 1);
        }
      })
      .catch((error) => {
        if (current) setError(error.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [status, page, retry]);

  return (
    <Panel title="Referred providers">
      <label className="mb-5 block text-sm">
        Approval status{' '}
        <select
          className="ml-3 rounded-lg border p-2"
          value={status}
          onChange={(event) => {
            setLoading(true);
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
        </select>
      </label>
      {loading ? (
        <Notice>Loading referrals…</Notice>
      ) : error ? (
        <Notice>
          {error}{' '}
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Retry
          </Button>
        </Notice>
      ) : rows.length === 0 ? (
        <Notice>No {status} referrals yet.</Notice>
      ) : (
        <Table
          headings={[
            'Provider',
            'Phone',
            'Registered',
            'Provider status',
            'Reward',
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.phone}</td>
              <td>{date(row.registered_at)}</td>
              <td className="capitalize">{row.provider_status}</td>
              <td>
                {row.reward_amount
                  ? money(row.reward_amount)
                  : row.reward_status === 'skipped'
                    ? 'No reward at approval'
                    : 'Awaiting approval'}
              </td>
            </tr>
          ))}
        </Table>
      )}
      <div className="mt-5 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          disabled={loading || page === 1}
          onClick={() => {
            setLoading(true);
            setPage(page - 1);
          }}
        >
          Previous
        </Button>
        <span className="text-xs">
          Page {page} of {lastPage}
        </span>
        <Button
          variant="outline"
          disabled={loading || page >= lastPage}
          onClick={() => {
            setLoading(true);
            setPage(page + 1);
          }}
        >
          Next
        </Button>
      </div>
    </Panel>
  );
}

function Wallet() {
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback((next?: string | null) => {
    return agentApi<WalletTransaction[]>(
      `agent/wallet/transactions${next ? `?cursor=${encodeURIComponent(next)}` : ''}`,
    )
      .then((result) => {
        setError('');
        setRows((current) =>
          next ? [...current, ...result.data] : result.data,
        );
        setCursor(result.meta?.next_cursor ?? null);
      })
      .catch((error) => {
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to load transactions.',
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Panel title="Wallet transactions">
      {error && (
        <Notice>
          {error}{' '}
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load(cursor);
            }}
          >
            Retry
          </Button>
        </Notice>
      )}
      {!loading && !error && rows.length === 0 && (
        <Notice>
          Your wallet history will appear here when a reward or payment is
          recorded.
        </Notice>
      )}
      {rows.length > 0 && (
        <Table headings={['Date', 'Description', 'Amount', 'Balance after']}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{date(row.created_at)}</td>
              <td>{row.description}</td>
              <td className={row.direction === 'credit' ? 'text-teal-700' : ''}>
                {row.direction === 'credit' ? '+' : '−'}
                {money(row.amount)}
              </td>
              <td>{money(row.balance_after)}</td>
            </tr>
          ))}
        </Table>
      )}
      {loading && <Notice>Loading transactions…</Notice>}
      {cursor && (
        <Button
          className="mt-5"
          variant="outline"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            void load(cursor);
          }}
        >
          Load more
        </Button>
      )}
    </Panel>
  );
}

function Withdrawals({
  profile,
  onRefresh,
}: {
  profile: AgentProfile;
  onRefresh: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const key = useRef<string | null>(null);

  const load = useCallback(() => {
    return agentApi<Withdrawal[]>(`agent/withdrawals?page=${page}`)
      .then((result) => {
        setRows(result.data);
        setLastPage(result.meta?.last_page ?? 1);
      })
      .catch((error) => {
        setError(
          error instanceof Error
            ? error.message
            : 'Unable to load withdrawals.',
        );
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    key.current ??= crypto.randomUUID();
    try {
      await agentApi('agent/withdrawals', 'POST', {
        amount,
        request_key: key.current,
      });
      setAmount('');
      key.current = null;
      setNotice(
        'Withdrawal requested. Your balance changes when the administrator records payment.',
      );
      setLoading(true);
      await Promise.all([load(), onRefresh()]);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to request withdrawal.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="Request a withdrawal">
        {profile.pending_withdrawal ? (
          <Notice>
            Your request for {money(profile.pending_withdrawal.amount)} is
            awaiting review. One pending request is allowed at a time.
          </Notice>
        ) : (
          <form onSubmit={submit} className="max-w-lg space-y-4">
            <p className="text-sm text-muted-foreground">
              Request between {money(profile.program.withdrawal_minimum)} and{' '}
              {money(profile.program.withdrawal_maximum)}, up to your wallet
              balance. Requests cannot be cancelled. Your balance stays
              unchanged until payment.
            </p>
            <label htmlFor="withdrawal-amount" className="block text-sm">
              Amount (PKR)
              <Input
                id="withdrawal-amount"
                className="mt-2"
                inputMode="decimal"
                pattern="[0-9]+([.][0-9]{1,2})?"
                required
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  key.current = null;
                }}
              />
            </label>
            <Button type="submit" disabled={busy || !amount}>
              {busy ? 'Submitting…' : 'Request withdrawal'}
            </Button>
          </form>
        )}
        {notice && (
          <div className="mt-4">
            <Notice>{notice}</Notice>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </Panel>
      <Panel title="Withdrawal history">
        {loading ? (
          <Notice>Loading withdrawals…</Notice>
        ) : rows.length === 0 ? (
          <Notice>
            No withdrawal requests yet.{' '}
            <Button
              variant="outline"
              onClick={() => {
                setLoading(true);
                setError('');
                void load();
              }}
            >
              Refresh
            </Button>
          </Notice>
        ) : (
          <Table
            headings={['Requested', 'Amount', 'Status', 'Payment', 'Details']}
          >
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{date(row.created_at)}</td>
                <td>{money(row.amount)}</td>
                <td className="capitalize">
                  {row.status === 'approved' ? 'Paid' : row.status}
                </td>
                <td>{row.payment_method?.replace('_', ' ') ?? '—'}</td>
                <td>
                  {row.rejection_reason ||
                    (row.has_proof ? (
                      <a
                        className="text-primary underline"
                        href={`/api/skilld/agent/withdrawals/${row.id}/proof`}
                      >
                        Download proof
                      </a>
                    ) : (
                      date(row.reviewed_at)
                    ))}
                </td>
              </tr>
            ))}
          </Table>
        )}
        <div className="mt-5 flex items-center justify-end gap-3">
          <Button
            variant="outline"
            disabled={loading || page === 1}
            onClick={() => {
              setLoading(true);
              setPage(page - 1);
            }}
          >
            Previous
          </Button>
          <span className="text-xs">
            Page {page} of {lastPage}
          </span>
          <Button
            variant="outline"
            disabled={loading || page >= lastPage}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            Next
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function Account() {
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setNotice('');
    try {
      await agentApi('agent/password', 'PUT', Object.fromEntries(data));
      form.reset();
      setNotice('Password updated.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Unable to update password.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Change password">
      <form onSubmit={submit} className="max-w-md space-y-5">
        <label htmlFor="current-password" className="block text-sm">
          Current password
          <Input
            id="current-password"
            className="mt-2"
            name="current_password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <label htmlFor="new-password" className="block text-sm">
          New password
          <Input
            id="new-password"
            className="mt-2"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <label htmlFor="confirm-password" className="block text-sm">
          Confirm new password
          <Input
            id="confirm-password"
            className="mt-2"
            name="password_confirmation"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        {notice && <Notice>{notice}</Notice>}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Update password'}
        </Button>
      </form>
    </Panel>
  );
}
