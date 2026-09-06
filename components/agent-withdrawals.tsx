'use client';

import { Clock3, Download, HandCoins, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';

import {
  AgentStatusBadge,
  Feedback,
  ListPagination,
  ListState,
} from '@/components/agent-ui';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { agentApi } from '@/lib/agent-api';
import {
  date,
  money,
  type AgentProfile,
  type Withdrawal,
} from '@/lib/agent-types';

export function AgentWithdrawals({
  profile,
  onRefresh,
}: {
  profile: AgentProfile;
  onRefresh: () => Promise<void>;
}) {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submittedWithdrawal, setSubmittedWithdrawal] =
    useState<Withdrawal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const key = useRef<string | null>(null);
  const pending =
    profile.pending_withdrawal ??
    (submittedWithdrawal?.status === 'pending' ? submittedWithdrawal : null);
  const currency = profile.agent.wallet_currency;

  useEffect(() => {
    let current = true;

    agentApi<Withdrawal[]>(`agent/withdrawals?page=${page}`)
      .then((result) => {
        if (current) {
          setListError('');
          setRows(result.data);
          setLastPage(result.meta?.last_page ?? 1);
        }
      })
      .catch((error) => {
        if (current)
          setListError(
            error instanceof Error
              ? error.message
              : 'Unable to load withdrawals.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [page, retry]);

  async function refreshAccount() {
    setRefreshing(true);
    setRefreshError('');

    try {
      await onRefresh();
      setSubmittedWithdrawal(null);
    } catch {
      setRefreshError(
        'Your request was received, but your account details could not be refreshed.',
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || pending) return;

    setBusy(true);
    setError('');
    setNotice('');
    key.current ??= crypto.randomUUID();

    try {
      const result = await agentApi<Withdrawal>('agent/withdrawals', 'POST', {
        amount,
        request_key: key.current,
      });
      setSubmittedWithdrawal(result.data);
      setAmount('');
      key.current = null;
      setNotice(
        'Withdrawal requested. Your balance will update when payment is recorded.',
      );
      setLoading(true);
      setPage(1);
      setRetry((value) => value + 1);
      await refreshAccount();
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
      <Card className="gap-0 rounded-2xl py-0">
        <CardHeader className="gap-1 border-b px-5 py-5 sm:px-6">
          <h2 className="text-base font-semibold">Request a withdrawal</h2>
          <CardDescription>
            Withdraw your available referral earnings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-5 py-6 sm:px-6">
          {pending ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-soft p-4">
              <Clock3
                className="mt-0.5 size-5 shrink-0 text-amber-800"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  {money(pending.amount, pending.currency)} awaiting review
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Request #{pending.id} · {date(pending.created_at)}. You can
                  submit another request once this one is reviewed.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 md:gap-12">
              <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                <p>
                  Request between{' '}
                  <span className="font-medium text-foreground">
                    {money(profile.program.withdrawal_minimum, currency)}
                  </span>{' '}
                  and{' '}
                  <span className="font-medium text-foreground">
                    {money(profile.program.withdrawal_maximum, currency)}
                  </span>
                  , up to your wallet balance.
                </p>
                <p>
                  One pending request is allowed at a time. Requests cannot be
                  cancelled. Your balance changes when payment is recorded.
                </p>
              </div>
              <form onSubmit={submit}>
                <fieldset disabled={busy} className="space-y-5">
                  <Field>
                    <FieldLabel htmlFor="withdrawal-amount">
                      Amount ({currency})
                    </FieldLabel>
                    <Input
                      id="withdrawal-amount"
                      className="form-input h-11"
                      inputMode="decimal"
                      pattern="[0-9]{1,16}([.][0-9]{1,2})?"
                      placeholder="0.00"
                      aria-describedby="withdrawal-balance"
                      required
                      value={amount}
                      onChange={(event) => {
                        setAmount(event.target.value);
                        setError('');
                        key.current = null;
                      }}
                    />
                    <FieldDescription id="withdrawal-balance">
                      Available: {money(profile.agent.wallet_amount, currency)}
                    </FieldDescription>
                  </Field>
                  {error && <Feedback tone="error">{error}</Feedback>}
                  <Button
                    type="submit"
                    className="h-11 gap-2 px-4"
                    disabled={busy || !amount}
                  >
                    {busy && (
                      <LoaderCircle
                        className="animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {busy ? 'Submitting…' : 'Request withdrawal'}
                  </Button>
                </fieldset>
              </form>
            </div>
          )}
          {notice && <Feedback tone="success">{notice}</Feedback>}
          {refreshError && (
            <Feedback tone="error">
              <p>{refreshError}</p>
              <Button
                variant="outline"
                className="mt-3 h-10 px-3 text-foreground"
                disabled={refreshing}
                onClick={refreshAccount}
              >
                {refreshing ? 'Refreshing…' : 'Refresh account'}
              </Button>
            </Feedback>
          )}
        </CardContent>
      </Card>
      <Card className="gap-0 rounded-2xl py-0" aria-busy={loading}>
        <CardHeader className="gap-1 px-5 py-5 sm:px-6">
          <h2 className="text-base font-semibold">Withdrawal history</h2>
          <CardDescription>
            Review your requests, payment details, and receipts.
          </CardDescription>
        </CardHeader>
        {loading ? (
          <ListState loading title="Loading withdrawals…" />
        ) : listError ? (
          <ListState
            error
            title="Unable to load withdrawals"
            description={listError}
            onRetry={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          />
        ) : rows.length === 0 ? (
          <ListState
            icon={<HandCoins aria-hidden="true" />}
            title="No withdrawals yet"
            description="Your requests and payment details will appear here."
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <Table className="[&_td]:px-6 [&_td]:py-4 [&_th]:px-6">
                <TableHeader className="bg-muted/60">
                  <TableRow>
                    <TableHead>Request</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-medium">#{row.id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {date(row.created_at)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(row.amount, row.currency)}
                      </TableCell>
                      <TableCell>
                        <AgentStatusBadge
                          status={row.status}
                          label={row.status === 'approved' ? 'Paid' : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        {row.payment_method === 'bank_transfer'
                          ? 'Bank transfer'
                          : row.payment_method === 'cash'
                            ? 'Cash'
                            : '—'}
                      </TableCell>
                      <TableCell className="max-w-72 whitespace-normal">
                        <WithdrawalDetails withdrawal={row} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y border-t lg:hidden">
              {rows.map((row) => (
                <li key={row.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold tabular-nums">
                        {money(row.amount, row.currency)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Request #{row.id} · {date(row.created_at)}
                      </p>
                    </div>
                    <AgentStatusBadge
                      status={row.status}
                      label={row.status === 'approved' ? 'Paid' : undefined}
                    />
                  </div>
                  {row.payment_method && (
                    <p className="text-sm">
                      {row.payment_method === 'bank_transfer'
                        ? 'Bank transfer'
                        : 'Cash payment'}
                    </p>
                  )}
                  <WithdrawalDetails withdrawal={row} />
                </li>
              ))}
            </ul>
            <ListPagination
              page={page}
              lastPage={lastPage}
              loading={loading}
              onPageChange={(page) => {
                setLoading(true);
                setPage(page);
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}

function WithdrawalDetails({ withdrawal }: { withdrawal: Withdrawal }) {
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {withdrawal.rejection_reason && (
        <p className="break-words">{withdrawal.rejection_reason}</p>
      )}
      <p>
        {withdrawal.reviewed_at
          ? `Reviewed ${date(withdrawal.reviewed_at)}`
          : 'Awaiting review'}
      </p>
      {withdrawal.has_proof && (
        <Button
          variant="link"
          className="h-10 gap-1.5 px-0"
          nativeButton={false}
          render={
            <a
              href={`/api/skilld/agent/withdrawals/${withdrawal.id}/proof`}
              aria-label={`Download proof for withdrawal ${withdrawal.id}`}
              download
            />
          }
        >
          <Download aria-hidden="true" /> Download proof
        </Button>
      )}
    </div>
  );
}
