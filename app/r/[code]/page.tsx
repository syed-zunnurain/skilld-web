import { RegistrationFlow } from '@/components/registration-flow';

export default async function ReferralRegistrationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return <RegistrationFlow initialReferralCode={code.slice(0, 32)} />;
}
