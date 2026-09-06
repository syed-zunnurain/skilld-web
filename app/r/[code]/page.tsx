import { notFound } from 'next/navigation';
import { ReferralAppLink } from '@/components/referral-app-link';

export default async function ReferralPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ target?: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const { target } = await searchParams;

  if (!/^[A-Z0-9]{1,27}-[A-HJ-NP-Z2-9]{4}$/.test(code)) notFound();

  return <ReferralAppLink code={code} target={target} />;
}
