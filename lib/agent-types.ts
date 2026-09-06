export interface Agent {
  id: number;
  name: string;
  phone: string;
  status: 'active' | 'suspended';
  referral_code: string;
  share_url: string;
  wallet_amount: string;
  wallet_currency: string;
}

export interface Withdrawal {
  id: number;
  amount: string;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  payment_method: 'cash' | 'bank_transfer' | null;
  has_proof: boolean;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface AgentProfile {
  agent: Agent;
  stats: { pending: number; approved: number };
  program: {
    rewards_enabled: boolean;
    reward_amount: string;
    withdrawal_minimum: string;
    withdrawal_maximum: string;
  };
  pending_withdrawal: Withdrawal | null;
}

export interface Referral {
  id: number;
  name: string;
  phone: string;
  registered_at: string;
  provider_status: string;
  status: 'pending' | 'approved';
  approved_at: string | null;
  reward_status: 'pending' | 'paid' | 'skipped';
  reward_amount: string | null;
}

export interface WalletTransaction {
  id: string;
  direction: 'credit' | 'debit';
  amount: string;
  description: string;
  balance_after: string;
  created_at: string;
}

export function money(amount: string) {
  const [whole, fraction = '00'] = amount.split('.');
  return `PKR ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`;
}

export function date(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}
