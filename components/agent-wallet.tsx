'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  LoaderCircle,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { ListState } from '@/components/agent-ui';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { agentApi } from '@/lib/agent-api';
import { date, money, type WalletTransaction } from '@/lib/agent-types';
import { cn } from '@/lib/utils';

export function AgentWallet() {
  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [requestCursor, setRequestCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let current = true;

    agentApi<WalletTransaction[]>(
      `agent/wallet/transactions${requestCursor ? `?cursor=${encodeURIComponent(requestCursor)}` : ''}`,
    )
      .then((result) => {
        if (!current) return;

        setError('');
        setRows((rows) => {
          if (!requestCursor) return result.data;

          const existing = new Set(rows.map((row) => row.id));
          return [
            ...rows,
            ...result.data.filter((row) => !existing.has(row.id)),
          ];
        });
        setCursor(result.meta?.next_cursor ?? null);
      })
      .catch((error) => {
        if (current)
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load transactions.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [requestCursor, retry]);

  return (
    <Card className="gap-0 rounded-2xl py-0" aria-busy={loading}>
      <CardHeader className="gap-1 px-5 py-5 sm:px-6">
        <h2 className="text-base font-semibold">Wallet transactions</h2>
        <CardDescription>
          Your referral rewards and withdrawal payments.
        </CardDescription>
      </CardHeader>
      {rows.length > 0 && (
        <>
          <div className="hidden md:block">
            <Table className="[&_td]:px-6 [&_td]:py-4 [&_th]:px-6">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-3">
                        <TransactionIcon direction={row.direction} />
                        <span className="font-medium">{row.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {date(row.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <TransactionAmount transaction={row} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {money(row.balance_after, row.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y border-t md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <TransactionIcon direction={row.direction} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium">{row.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {date(row.created_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Balance {money(row.balance_after, row.currency)}
                  </p>
                  <TransactionAmount transaction={row} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {loading && rows.length === 0 ? (
        <ListState loading title="Loading transactions…" />
      ) : error ? (
        <ListState
          error
          title={
            rows.length
              ? 'Unable to load more transactions'
              : 'Unable to load transactions'
          }
          description={error}
          onRetry={
            loading
              ? undefined
              : () => {
                  setLoading(true);
                  setRetry((value) => value + 1);
                }
          }
        />
      ) : rows.length === 0 ? (
        <ListState
          icon={<Wallet aria-hidden="true" />}
          title="No transactions yet"
          description="Rewards and withdrawal payments will appear here as they are recorded."
        />
      ) : null}
      {cursor && !error && (
        <div className="flex justify-center border-t px-5 py-3">
          <Button
            variant="ghost"
            className="h-10 gap-2 px-4"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setRequestCursor(cursor);
            }}
          >
            {loading && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {loading ? 'Loading…' : 'Load more transactions'}
          </Button>
        </div>
      )}
    </Card>
  );
}

function TransactionIcon({
  direction,
}: {
  direction: WalletTransaction['direction'];
}) {
  const Icon = direction === 'credit' ? ArrowDownLeft : ArrowUpRight;

  return (
    <span
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
        direction === 'credit' && 'bg-primary-soft text-primary',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}

function TransactionAmount({
  transaction,
}: {
  transaction: WalletTransaction;
}) {
  return (
    <span
      className={cn(
        'font-medium tabular-nums',
        transaction.direction === 'credit' && 'text-primary',
      )}
    >
      {transaction.direction === 'credit' ? '+' : '−'}
      {money(transaction.amount, transaction.currency)}
    </span>
  );
}
