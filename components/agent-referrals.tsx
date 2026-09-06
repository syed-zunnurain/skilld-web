'use client';

import { Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  AgentStatusBadge,
  ListPagination,
  ListState,
} from '@/components/agent-ui';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { agentApi } from '@/lib/agent-api';
import { date, money, type Referral } from '@/lib/agent-types';

export function AgentReferrals() {
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
        if (current)
          setError(
            error instanceof Error
              ? error.message
              : 'Unable to load referrals.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [status, page, retry]);

  return (
    <Card className="gap-0 rounded-2xl py-0" aria-busy={loading}>
      <CardHeader className="gap-4 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-base font-semibold">Referred providers</h2>
          <CardDescription className="mt-1">
            Follow provider approvals and referral rewards.
          </CardDescription>
        </div>
        <Tabs
          value={status}
          onValueChange={(value) => {
            setLoading(true);
            setStatus(String(value));
            setPage(1);
          }}
        >
          <TabsList
            aria-label="Provider approval status"
            className="group-data-horizontal/tabs:h-10"
          >
            <TabsTrigger value="pending" className="px-4">
              Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="px-4">
              Approved
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      {loading ? (
        <ListState loading title="Loading referrals…" />
      ) : error ? (
        <ListState
          error
          title="Unable to load referrals"
          description={error}
          onRetry={() => {
            setLoading(true);
            setRetry((value) => value + 1);
          }}
        />
      ) : rows.length === 0 ? (
        <ListState
          icon={<Users aria-hidden="true" />}
          title={`No ${status} referrals yet`}
          description={
            status === 'pending'
              ? 'Providers who register with your code will appear here.'
              : 'Your approved providers and their rewards will appear here.'
          }
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table className="[&_td]:px-6 [&_td]:py-4 [&_th]:px-6">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Provider status</TableHead>
                  <TableHead className="text-right">Reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-64 whitespace-normal">
                      <p className="break-words font-medium">
                        {row.name || 'Unnamed provider'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.phone}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {date(row.registered_at)}
                    </TableCell>
                    <TableCell>
                      <AgentStatusBadge status={row.provider_status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <ReferralReward referral={row} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ul className="divide-y border-t md:hidden">
            {rows.map((row) => (
              <li key={row.id} className="space-y-3 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">
                      {row.name || 'Unnamed provider'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.phone}
                    </p>
                  </div>
                  <AgentStatusBadge status={row.provider_status} />
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Joined {date(row.registered_at)}
                  </p>
                  <div className="ml-auto text-right">
                    <ReferralReward referral={row} />
                  </div>
                </div>
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
  );
}

function ReferralReward({ referral }: { referral: Referral }) {
  if (referral.reward_status === 'paid') {
    return (
      <div>
        <p className="font-medium text-primary tabular-nums">
          {money(referral.reward_amount ?? '0.00')}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Credited {date(referral.approved_at)}
        </p>
      </div>
    );
  }

  if (referral.reward_status === 'skipped') {
    return (
      <div>
        <AgentStatusBadge status="skipped" label="No reward" />
        <p className="mt-1 text-xs text-muted-foreground">
          {referral.skip_reason === 'rewards_disabled'
            ? 'Rewards paused at approval'
            : referral.skip_reason === 'agent_inactive'
              ? 'Agent inactive at approval'
              : 'Not eligible at approval'}
        </p>
      </div>
    );
  }

  return (
    <span className="text-sm text-muted-foreground">Awaiting approval</span>
  );
}
