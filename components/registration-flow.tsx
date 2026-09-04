'use client';

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Gift,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Image from 'next/image';
import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Progress } from '@/components/ui/progress';
import {
  type AccountType,
  checkPhone,
  registerAccount,
  SkilldApiError,
  verifyOtp,
} from '@/lib/skilld-api';
import { cn } from '@/lib/utils';

type FlowStep = 'role' | 'phone' | 'otp' | 'details' | 'existing' | 'success';
type FieldName =
  | 'phone'
  | 'otp'
  | 'name'
  | 'email'
  | 'password'
  | 'passwordConfirmation'
  | 'idNumber'
  | 'referralCode';
type FormErrors = Partial<Record<FieldName, string>>;

const REFERRAL_PATTERN = /^[A-Z0-9]{1,27}-[A-HJ-NP-Z2-9]{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_OTP_RETRY_SECONDS = 5 * 60;
const FIELD_IDS: Record<FieldName, string> = {
  phone: 'phone',
  otp: 'otp',
  name: 'name',
  email: 'email',
  password: 'password',
  passwordConfirmation: 'password-confirmation',
  idNumber: 'id-number',
  referralCode: 'referral-code',
};

const ROLE_CONTENT: Record<
  AccountType,
  { label: string; shortLabel: string; title: string; description: string }
> = {
  customer: {
    label: 'I need a service',
    shortLabel: 'Customer',
    title: 'Create your customer account',
    description: 'Book trusted professionals and manage services in the Skilld customer app.',
  },
  provider: {
    label: 'I provide services',
    shortLabel: 'Provider',
    title: 'Create your provider account',
    description: 'Grow your business and manage jobs in the Skilld provider app.',
  },
};

const API_FIELD_MAP: Record<string, FieldName> = {
  phone: 'phone',
  otp: 'otp',
  name: 'name',
  email: 'email',
  password: 'password',
  id_number: 'idNumber',
  referral_code: 'referralCode',
};

function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 20);
}

function normalizeReferral(value: string) {
  return value.trim().toUpperCase().slice(0, 32);
}

function pluralizeSeconds(seconds: number) {
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

function errorsFromApi(error: SkilldApiError): FormErrors {
  return Object.entries(error.errors).reduce<FormErrors>((result, [field, messages]) => {
    const mappedField = API_FIELD_MAP[field];
    if (mappedField && messages[0]) {
      result[mappedField] = messages[0];
    }
    return result;
  }, {});
}

export function RegistrationFlow({ initialReferralCode = '' }: { initialReferralCode?: string }) {
  const normalizedInitialReferral = normalizeReferral(initialReferralCode);
  const referralFromValidLink = REFERRAL_PATTERN.test(normalizedInitialReferral);
  const [step, setStep] = useState<FlowStep>('role');
  const [accountType, setAccountType] = useState<AccountType>('customer');
  const [existingAccountType, setExistingAccountType] = useState<AccountType>('customer');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [referralCode, setReferralCode] = useState(normalizedInitialReferral);
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestError, setRequestError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const role = ROLE_CONTENT[accountType];
  const referralStillMatchesLink =
    referralFromValidLink && referralCode === normalizedInitialReferral;
  const progress = useMemo(() => {
    if (step === 'role') return { number: 1, value: 25, label: 'Choose account' };
    if (step === 'phone' || step === 'otp') return { number: 2, value: 50, label: 'Verify phone' };
    if (step === 'details') return { number: 3, value: 75, label: 'Your details' };
    return { number: 4, value: 100, label: 'Complete' };
  }, [step]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (retryAfter <= 0) return;

    const interval = window.setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [retryAfter]);

  function clearFeedback() {
    setErrors({});
    setRequestError('');
  }

  function clearFieldError(field: FieldName) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function focusFirstInvalid(validationErrors: FormErrors) {
    const firstInvalid = (Object.keys(FIELD_IDS) as FieldName[]).find(
      (field) => validationErrors[field],
    );

    if (!firstInvalid) return;

    window.requestAnimationFrame(() => {
      const element = document.getElementById(FIELD_IDS[firstInvalid]);
      element?.focus();
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function moveTo(nextStep: FlowStep) {
    clearFeedback();
    setStep(nextStep);
  }

  function showExisting(type: AccountType) {
    setExistingAccountType(type);
    moveTo('existing');
  }

  function handleApiError(
    error: unknown,
    fallbackField?: FieldName,
    hiddenFields: FieldName[] = [],
  ) {
    if (error instanceof SkilldApiError) {
      const fieldErrors = errorsFromApi(error);
      if (fallbackField && Object.keys(fieldErrors).length === 0) {
        fieldErrors[fallbackField] = error.message;
      }

      const hiddenMessages = hiddenFields.flatMap((field) => {
        const message = fieldErrors[field];
        delete fieldErrors[field];
        return message ? [message] : [];
      });

      setErrors(fieldErrors);
      setRequestError(
        hiddenMessages.length > 0
          ? `${hiddenMessages.join(' ')} Go back and verify the phone number again.`
          : Object.keys(fieldErrors).length === 0
            ? error.message
            : '',
      );
      focusFirstInvalid(fieldErrors);
      return;
    }

    setRequestError('Something went wrong. Please try again.');
  }

  async function submitPhone(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const normalizedPhone = normalizePhone(phone);
    if (normalizedPhone.length < 8) {
      setErrors({ phone: 'Enter a complete phone number, including the country code.' });
      return;
    }

    setPhone(normalizedPhone);
    setIsSubmitting(true);

    try {
      const result = await checkPhone(normalizedPhone, accountType);

      if (result.status === 'exists') {
        showExisting(accountType);
      } else if (result.status === 'verified') {
        moveTo('details');
      } else {
        setRetryAfter(result.retry_after_seconds ?? DEFAULT_OTP_RETRY_SECONDS);
        moveTo('otp');
      }
    } catch (error) {
      if (error instanceof SkilldApiError) {
        const registeredAs = error.data.registered_as;

        if (error.status === 422 && (registeredAs === 'customer' || registeredAs === 'provider')) {
          showExisting(registeredAs);
          return;
        }

        if (error.status === 429 && error.data.status === 'otp_required') {
          const seconds = Number(error.data.retry_after_seconds);
          setRetryAfter(
            Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_OTP_RETRY_SECONDS,
          );
          moveTo('otp');
          return;
        }
      }

      handleApiError(error, 'phone');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitOtp(code = otp) {
    clearFeedback();

    if (!/^\d{6}$/.test(code)) {
      setErrors({ otp: 'Enter the complete 6-digit code.' });
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyOtp(phone, code);
      setOtp('');
      moveTo('details');
    } catch (error) {
      handleApiError(error, 'otp');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendOtp() {
    if (retryAfter > 0 || isSubmitting) return;

    clearFeedback();
    setIsSubmitting(true);

    try {
      const result = await checkPhone(phone, accountType);

      if (result.status === 'exists') {
        showExisting(accountType);
      } else if (result.status === 'verified') {
        moveTo('details');
      } else {
        setRetryAfter(result.retry_after_seconds ?? DEFAULT_OTP_RETRY_SECONDS);
      }
    } catch (error) {
      if (error instanceof SkilldApiError && error.status === 429) {
        const seconds = Number(error.data.retry_after_seconds);
        setRetryAfter(
          Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_OTP_RETRY_SECONDS,
        );
        return;
      }

      handleApiError(error, 'otp');
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateDetails(): FormErrors {
    const validationErrors: FormErrors = {};
    const normalizedEmail = email.trim();
    const normalizedCode = normalizeReferral(referralCode);

    if (!name.trim()) validationErrors.name = 'Enter your full name.';
    if (name.trim().length > 255) validationErrors.name = 'Name cannot exceed 255 characters.';
    if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
      validationErrors.email = 'Enter a valid email address.';
    }
    if (normalizedEmail.length > 255) validationErrors.email = 'Email cannot exceed 255 characters.';
    if (password.length < 8) validationErrors.password = 'Use at least 8 characters.';
    if (passwordConfirmation !== password) {
      validationErrors.passwordConfirmation = 'Passwords do not match.';
    }
    if (accountType === 'provider' && !idNumber.trim()) {
      validationErrors.idNumber = 'Enter your CNIC or ID number.';
    }
    if (idNumber.trim().length > 20) {
      validationErrors.idNumber = 'ID number cannot exceed 20 characters.';
    }
    if (normalizedCode && !REFERRAL_PATTERN.test(normalizedCode)) {
      validationErrors.referralCode = 'Enter a valid Skilld referral code.';
    }

    return validationErrors;
  }

  async function submitDetails(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const validationErrors = validateDetails();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstInvalid(validationErrors);
      return;
    }

    const normalizedCode = normalizeReferral(referralCode);
    setReferralCode(normalizedCode);
    setIsSubmitting(true);

    try {
      await registerAccount(accountType, {
        name: name.trim(),
        phone,
        email: email.trim() || null,
        password,
        ...(accountType === 'provider' ? { id_number: idNumber.trim() } : {}),
        ...(normalizedCode ? { referral_code: normalizedCode } : {}),
      });
      setPassword('');
      setPasswordConfirmation('');
      moveTo('success');
    } catch (error) {
      handleApiError(error, undefined, ['phone']);
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetFlow() {
    setStep('role');
    setPhone('');
    setOtp('');
    setName('');
    setEmail('');
    setPassword('');
    setPasswordConfirmation('');
    setIdNumber('');
    setReferralCode(normalizedInitialReferral);
    setRetryAfter(0);
    clearFeedback();
  }

  return (
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto grid min-h-svh max-w-6xl lg:grid-cols-[1fr_520px]">
        <BrandPanel />

        <section className="flex min-h-svh items-start justify-center px-5 py-6 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <div className="w-full max-w-[440px]">
            <header className="mb-7 flex items-center justify-between lg:hidden">
              <Image
                src="/skilld-logo.png"
                alt="Skilld"
                width={1983}
                height={793}
                className="h-auto w-40"
                priority
              />
              {referralFromValidLink && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-xs font-bold text-amber-700">
                  <Gift className="size-3.5" /> Referred
                </span>
              )}
            </header>

            <div className="mb-7">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-primary">Step {progress.number} of 4</span>
                <span className="text-muted-foreground">{progress.label}</span>
              </div>
              <Progress value={progress.value} aria-label={`Registration: ${progress.label}`} />
            </div>

            <div className="flow-enter" key={step}>
              {step === 'role' && (
                <RoleStep
                  accountType={accountType}
                  setAccountType={setAccountType}
                  headingRef={headingRef}
                  referralCode={referralCode}
                  referralFromValidLink={referralStillMatchesLink}
                  onContinue={() => moveTo('phone')}
                />
              )}

              {step === 'phone' && (
                <form onSubmit={submitPhone} noValidate>
                  <StepHeading
                    ref={headingRef}
                    eyebrow={role.shortLabel}
                    title="Verify your phone"
                    description="We’ll send a 6-digit verification code by SMS."
                  />
                  <Field data-invalid={Boolean(errors.phone)}>
                    <FieldLabel htmlFor="phone">Mobile number</FieldLabel>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                      <span className="pointer-events-none absolute left-11 top-1/2 -translate-y-1/2 text-base font-semibold text-foreground">
                        +
                      </span>
                      <Input
                        id="phone"
                        name="phone"
                        className="form-input pl-[58px]"
                        value={phone}
                        onChange={(event) => {
                          setPhone(normalizePhone(event.target.value));
                          setErrors((current) => ({ ...current, phone: undefined }));
                        }}
                        placeholder="923001234567"
                        inputMode="tel"
                        autoComplete="tel"
                        maxLength={20}
                        aria-invalid={Boolean(errors.phone)}
                        aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'}
                        aria-required="true"
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <FieldDescription id="phone-hint">
                      Include your country code. For Pakistan, start with 92.
                    </FieldDescription>
                    <FieldError id="phone-error">{errors.phone}</FieldError>
                  </Field>
                  <RequestError message={requestError} />
                  <FlowActions
                    onBack={() => moveTo('role')}
                    busy={isSubmitting}
                    submitLabel="Send verification code"
                  />
                </form>
              )}

              {step === 'otp' && (
                <div>
                  <StepHeading
                    ref={headingRef}
                    eyebrow="Phone verification"
                    title="Enter your code"
                    description={
                      <>
                        We sent it to <strong className="font-semibold text-foreground">+{phone}</strong>.
                      </>
                    }
                  />
                  <Field data-invalid={Boolean(errors.otp)}>
                    <FieldLabel htmlFor="otp">6-digit code</FieldLabel>
                    <InputOTP
                      id="otp"
                      maxLength={6}
                      value={otp}
                      onChange={(value) => {
                        setOtp(value.replace(/\D/g, ''));
                        setErrors((current) => ({ ...current, otp: undefined }));
                      }}
                      onComplete={(value) => void submitOtp(value)}
                      pattern="^[0-9]*$"
                      inputMode="numeric"
                      disabled={isSubmitting}
                      aria-invalid={Boolean(errors.otp)}
                      aria-describedby={errors.otp ? 'otp-error' : undefined}
                      aria-required="true"
                      containerClassName="w-full"
                      required
                    >
                      <InputOTPGroup className="grid w-full grid-cols-6 gap-2">
                        {Array.from({ length: 6 }, (_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-[52px] w-full rounded-xl border-[1.5px] bg-white text-lg font-bold"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <FieldError id="otp-error">{errors.otp}</FieldError>
                  </Field>

                  <div className="mt-4 flex min-h-8 items-center justify-center text-sm">
                    {retryAfter > 0 ? (
                      <span className="text-muted-foreground">
                        Resend available in {pluralizeSeconds(retryAfter)}
                      </span>
                    ) : (
                      <Button
                        type="button"
                        variant="link"
                        className="h-8 px-2 font-bold"
                        onClick={() => void resendOtp()}
                        disabled={isSubmitting}
                      >
                        Resend code
                      </Button>
                    )}
                  </div>
                  <RequestError message={requestError} />
                  <div className="mt-6 grid gap-3">
                    <Button
                      type="button"
                      className="h-[52px] w-full rounded-xl text-base font-bold"
                      onClick={() => void submitOtp()}
                      disabled={isSubmitting || otp.length !== 6}
                    >
                      {isSubmitting ? <LoadingLabel label="Verifying" /> : 'Verify phone'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-11 w-full rounded-xl font-semibold"
                      onClick={() => {
                        setOtp('');
                        moveTo('phone');
                      }}
                      disabled={isSubmitting}
                    >
                      <ArrowLeft data-icon="inline-start" /> Change phone number
                    </Button>
                  </div>
                </div>
              )}

              {step === 'details' && (
                <form onSubmit={submitDetails} noValidate>
                  <StepHeading
                    ref={headingRef}
                    eyebrow={role.shortLabel}
                    title={role.title}
                    description="Your phone is verified. Add the details you’ll use in the mobile app."
                  />
                  <FieldGroup className="gap-4">
                    <TextField
                      id="name"
                      label="Full name"
                      value={name}
                      onChange={(value) => {
                        setName(value);
                        clearFieldError('name');
                      }}
                      icon={<UserRound />}
                      error={errors.name}
                      autoComplete="name"
                      maxLength={255}
                      required
                      disabled={isSubmitting}
                    />
                    <TextField
                      id="email"
                      label="Email address"
                      optional
                      value={email}
                      onChange={(value) => {
                        setEmail(value);
                        clearFieldError('email');
                      }}
                      icon={<Mail />}
                      error={errors.email}
                      type="email"
                      autoComplete="email"
                      maxLength={255}
                      disabled={isSubmitting}
                    />
                    {accountType === 'provider' && (
                      <TextField
                        id="id-number"
                        label="CNIC / ID number"
                        value={idNumber}
                        onChange={(value) => {
                          setIdNumber(value);
                          clearFieldError('idNumber');
                        }}
                        icon={<ShieldCheck />}
                        error={errors.idNumber}
                        autoComplete="off"
                        maxLength={20}
                        required
                        disabled={isSubmitting}
                      />
                    )}
                    <TextField
                      id="password"
                      label="Create password"
                      value={password}
                      onChange={(value) => {
                        setPassword(value);
                        clearFieldError('password');
                        clearFieldError('passwordConfirmation');
                      }}
                      icon={<LockKeyhole />}
                      error={errors.password}
                      type="password"
                      autoComplete="new-password"
                      hint="Use at least 8 characters."
                      required
                      disabled={isSubmitting}
                    />
                    <TextField
                      id="password-confirmation"
                      label="Confirm password"
                      value={passwordConfirmation}
                      onChange={(value) => {
                        setPasswordConfirmation(value);
                        clearFieldError('passwordConfirmation');
                      }}
                      icon={<LockKeyhole />}
                      error={errors.passwordConfirmation}
                      type="password"
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                    />
                    <TextField
                      id="referral-code"
                      label="Referral code"
                      optional
                      value={referralCode}
                      onChange={(value) => {
                        setReferralCode(value.toUpperCase());
                        clearFieldError('referralCode');
                      }}
                      icon={<Gift />}
                      error={errors.referralCode}
                      autoComplete="off"
                      maxLength={32}
                      hint={
                        referralStillMatchesLink
                          ? 'Added from your referral link. Eligibility is checked when you register.'
                          : undefined
                      }
                      disabled={isSubmitting}
                    />
                  </FieldGroup>
                  <RequestError message={requestError} />
                  <FlowActions
                    onBack={() => moveTo('phone')}
                    busy={isSubmitting}
                    submitLabel="Create account"
                  />
                  <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                    Registration only. Skilld will not sign you in on this website.
                  </p>
                </form>
              )}

              {step === 'existing' && (
                <CompletionStep
                  headingRef={headingRef}
                  icon={<Phone className="size-8" />}
                  title="Your account already exists"
                  description={
                    <>
                      This number is registered as a{' '}
                      <strong className="font-semibold text-foreground">
                        {ROLE_CONTENT[existingAccountType].shortLabel.toLowerCase()}
                      </strong>
                      . Open the Skilld {ROLE_CONTENT[existingAccountType].shortLabel.toLowerCase()} app and sign in to continue.
                    </>
                  }
                  phone={phone}
                  note="For your security, login is only available in the mobile apps."
                  actionLabel="Use a different number"
                  onAction={() => {
                    setPhone('');
                    moveTo('phone');
                  }}
                />
              )}

              {step === 'success' && (
                <CompletionStep
                  headingRef={headingRef}
                  icon={<CheckCircle2 className="size-9" />}
                  title="Your account is ready"
                  description={
                    <>
                      Open the Skilld {role.shortLabel.toLowerCase()} app and sign in with{' '}
                      <strong className="font-semibold text-foreground">+{phone}</strong> and the password you just created.
                    </>
                  }
                  note={
                    accountType === 'provider'
                      ? 'Continue your provider setup and account review in the mobile app. No web session was created.'
                      : 'Book and manage your services in the mobile app. No web session was created.'
                  }
                  actionLabel="Register another account"
                  onAction={resetFlow}
                />
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <section className="brand-panel hidden px-14 py-12 lg:flex lg:flex-col lg:justify-between">
      <Image
        src="/skilld-logo.png"
        alt="Skilld"
        width={1983}
        height={793}
        className="h-auto w-48"
        priority
      />
      <div className="max-w-lg py-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90">
          <ShieldCheck className="size-4 text-amber-300" /> Secure registration
        </div>
        <h1 className="text-balance text-5xl font-bold leading-[1.08] tracking-[-0.045em] text-white">
          Join Skilld. Continue in the app.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-7 text-teal-50/75">
          Create a customer or provider account in a few simple steps. Your mobile app is where the journey continues.
        </p>
      </div>
      <p className="text-sm text-teal-50/55">Trusted services. Skilled people.</p>
    </section>
  );
}

function StepHeading({
  eyebrow,
  title,
  description,
  ref,
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  ref: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="mb-7">
      <span className="mb-3 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] text-primary">
        {eyebrow}
      </span>
      <h2
        ref={ref}
        tabIndex={-1}
        className="text-[1.8rem] font-bold leading-9 tracking-[-0.035em] outline-none sm:text-[2rem] sm:leading-10"
      >
        {title}
      </h2>
      <p className="mt-2 text-base leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function RoleStep({
  accountType,
  setAccountType,
  headingRef,
  referralCode,
  referralFromValidLink,
  onContinue,
}: {
  accountType: AccountType;
  setAccountType: (type: AccountType) => void;
  headingRef: React.Ref<HTMLHeadingElement>;
  referralCode: string;
  referralFromValidLink: boolean;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepHeading
        ref={headingRef}
        eyebrow="Create an account"
        title="Welcome to Skilld"
        description="First, choose how you’ll use the app."
      />

      {referralCode && (
        <Alert
          className={cn(
            'mb-5 px-3.5 py-3',
            referralFromValidLink ? 'border-amber-200 bg-amber-soft' : 'border-destructive/25',
          )}
          variant={referralFromValidLink ? 'default' : 'destructive'}
        >
          <Gift className="size-4" />
          <AlertTitle>
            {referralFromValidLink ? 'Referral added' : 'Check this referral link'}
          </AlertTitle>
          <AlertDescription>
            {referralFromValidLink
              ? `${referralCode} will be checked when you register.`
              : 'The code in this link is not in the expected format. You can correct it before registration.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3" role="radiogroup" aria-label="Account type">
        <RoleCard
          type="customer"
          selected={accountType === 'customer'}
          onSelect={setAccountType}
          icon={<UserRound className="size-6" />}
        />
        <RoleCard
          type="provider"
          selected={accountType === 'provider'}
          onSelect={setAccountType}
          icon={<BriefcaseBusiness className="size-6" />}
        />
      </div>
      <Button
        type="button"
        className="mt-6 h-[52px] w-full rounded-xl text-base font-bold shadow-sm"
        onClick={onContinue}
      >
        Continue <ArrowRight data-icon="inline-end" className="size-5" />
      </Button>
      <p className="mt-6 text-center text-sm leading-5 text-muted-foreground">
        Already registered? Open the Skilld mobile app to sign in.
      </p>
    </div>
  );
}

function RoleCard({
  type,
  selected,
  onSelect,
  icon,
}: {
  type: AccountType;
  selected: boolean;
  onSelect: (type: AccountType) => void;
  icon: React.ReactNode;
}) {
  const content = ROLE_CONTENT[type];

  return (
    <label
      className={cn(
        'role-card group flex min-h-24 w-full cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 text-left transition-all',
        selected && 'role-card-active',
      )}
    >
      <input
        type="radio"
        name="account-type"
        value={type}
        checked={selected}
        onChange={() => onSelect(type)}
        className="sr-only"
      />
      <span
        className={cn(
          'flex size-12 shrink-0 items-center justify-center rounded-xl',
          type === 'customer' ? 'bg-primary-soft text-primary' : 'bg-amber-soft text-amber-700',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{content.label}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">{content.description}</span>
      </span>
      <span className="selection-dot" aria-hidden="true">
        {selected && <Check className="size-2.5 text-white" strokeWidth={4} />}
      </span>
    </label>
  );
}

function TextField({
  id,
  label,
  optional = false,
  value,
  onChange,
  icon,
  error,
  hint,
  type = 'text',
  ...inputProps
}: {
  id: string;
  label: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
  icon: React.ReactNode;
  error?: string;
  hint?: string;
} & Omit<React.ComponentProps<'input'>, 'id' | 'value' | 'onChange' | 'type'> & {
    type?: React.HTMLInputTypeAttribute;
  }) {
  return (
    <Field data-invalid={Boolean(error)}>
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {optional && <span className="text-xs text-muted-foreground">Optional</span>}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center text-muted-foreground [&>svg]:size-5">
          {icon}
        </span>
        <Input
          id={id}
          name={id}
          className="form-input pl-12"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...inputProps}
        />
      </div>
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

function FlowActions({
  onBack,
  busy,
  submitLabel,
}: {
  onBack: () => void;
  busy: boolean;
  submitLabel: string;
}) {
  return (
    <div className="mt-7 grid gap-3">
      <Button
        type="submit"
        className="h-[52px] w-full rounded-xl text-base font-bold"
        disabled={busy}
      >
        {busy ? <LoadingLabel label="Please wait" /> : submitLabel}
        {!busy && <ArrowRight data-icon="inline-end" className="size-5" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-11 w-full rounded-xl font-semibold"
        onClick={onBack}
        disabled={busy}
      >
        <ArrowLeft data-icon="inline-start" /> Back
      </Button>
    </div>
  );
}

function LoadingLabel({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LoaderCircle className="size-4 animate-spin" /> {label}
    </span>
  );
}

function RequestError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <Alert variant="destructive" className="mt-4 px-3.5 py-3">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function CompletionStep({
  headingRef,
  icon,
  title,
  description,
  phone,
  note,
  actionLabel,
  onAction,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  phone?: string;
  note: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="pt-3 text-center sm:pt-8">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary-soft text-primary">
        {icon}
      </span>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-6 text-[1.8rem] font-bold leading-9 tracking-[-0.035em] outline-none sm:text-[2rem] sm:leading-10"
      >
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-base leading-6 text-muted-foreground">{description}</p>
      {phone && (
        <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full bg-primary-soft px-4 py-2 text-sm font-bold text-primary">
          <Phone className="size-4" /> +{phone}
        </div>
      )}
      <div className="mt-7 rounded-2xl border bg-card p-4 text-left shadow-sm">
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-soft text-amber-700">
            <ShieldCheck className="size-4" />
          </span>
          <div>
            <p className="text-sm font-bold">Continue in the mobile app</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{note}</p>
          </div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-6 h-[52px] w-full rounded-xl text-base font-bold"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}
