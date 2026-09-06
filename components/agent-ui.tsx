import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

export function Feedback({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'error';
}) {
  const Icon =
    tone === 'error' ? CircleAlert : tone === 'success' ? CircleCheck : Info;

  return (
    <Alert
      role={tone === 'error' ? 'alert' : 'status'}
      variant={tone === 'error' ? 'destructive' : 'default'}
      className={cn(
        'p-4',
        tone === 'success' && 'border-primary/20 bg-primary-soft text-primary',
      )}
    >
      <Icon aria-hidden="true" />
      <AlertDescription className="text-inherit">{children}</AlertDescription>
    </Alert>
  );
}

export function ListState({
  title,
  description,
  icon,
  loading = false,
  error = false,
  onRetry,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Empty className="rounded-none py-12" role={error ? 'alert' : 'status'}>
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className={cn(
            'size-10 rounded-xl',
            error && 'bg-destructive/10 text-destructive',
          )}
        >
          {loading ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : error ? (
            <CircleAlert aria-hidden="true" />
          ) : (
            icon
          )}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {onRetry && (
        <Button variant="outline" className="h-10 px-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Empty>
  );
}

export function ListPagination({
  page,
  lastPage,
  loading,
  onPageChange,
}: {
  page: number;
  lastPage: number;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  if (lastPage <= 1) return null;

  return (
    <Pagination
      className="justify-between border-t px-5 py-3"
      aria-label="Results pages"
    >
      <span className="self-center text-sm text-muted-foreground">
        Page {page} of {lastPage}
      </span>
      <PaginationContent className="gap-2">
        <PaginationItem>
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Previous page"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
        </PaginationItem>
        <PaginationItem>
          <Button
            variant="outline"
            size="icon"
            className="size-10"
            aria-label="Next page"
            disabled={loading || page >= lastPage}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export function AgentStatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tones: Record<string, string> = {
    active: 'bg-primary-soft text-primary',
    approved: 'bg-primary-soft text-primary',
    paid: 'bg-primary-soft text-primary',
    pending: 'bg-amber-soft text-amber-800',
    'in review': 'bg-amber-soft text-amber-800',
    blocked: 'bg-destructive/10 text-destructive',
    rejected: 'bg-destructive/10 text-destructive',
    suspended: 'bg-destructive/10 text-destructive',
  };

  return (
    <Badge
      variant="secondary"
      className={cn('h-auto px-2.5 py-1 capitalize', tones[status])}
    >
      {label ?? status.replaceAll('_', ' ')}
    </Badge>
  );
}
