# Skilld Web Registration

Mobile-first customer and provider registration for Skilld. The site supports direct registration and referral links at `/r/{code}`. It intentionally has no web login and sends registered users to the appropriate mobile app to continue.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Point `SKILLD_API_URL` at the Skilld backend API. HTTP is accepted only for localhost; deployed environments must use HTTPS.
3. Run `npm run dev`.

The server proxy exposes only these backend operations:

- phone check and OTP send
- OTP verification
- customer registration
- provider registration

It does not forward browser cookies or authorization headers, does not expose login endpoints, and marks responses as non-cacheable.

## Registration flow

1. Choose customer or provider.
2. Verify a phone number by OTP.
3. Enter account details and an optional referral code.
4. Copy the new account's referral link, built from the current web-app URL, then open the matching Skilld mobile app and sign in there.

Provider registration also collects a CNIC / ID number. Referral links prefill the code but the backend remains the source of truth for referral eligibility.

## Docker and AWS EC2

The production container runs Next.js standalone behind Nginx on HTTP port 80,
with browser HTTPS handled by Cloudflare. See [the EC2 deployment guide](docs/ec2-deployment.md)
for instance setup, Docker installation, Cloudflare settings, environment variables,
startup commands, and a local Docker check.

Docker uses `npm run build:docker`; the existing Vinext development and build
commands are preserved. Local environment files are excluded from the image.
