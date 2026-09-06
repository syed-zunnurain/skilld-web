# Skilld Agent Portal

Agents sign in with an admin-issued phone number and password to share provider invitations, track referrals, view their wallet, request withdrawals and change their password. Accounts are created in Skilld Admin.

Customer and provider registration happens in the mobile apps. Public invitation links at `/r/{code}` open the matching app and prefill the referral code. `?target=provider` or `?target=customer` selects the app; without a target, the page offers both. The code remains visible if the app is not installed.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Point `SKILLD_API_URL` at the backend API. HTTP is accepted for localhost; deployed environments require HTTPS.
3. Run `npm run dev`.

The server proxy allows agent login/logout, profile, referrals, wallet transactions, withdrawals, payment proof and password changes. The session token is held in an HttpOnly, SameSite cookie and is not returned to browser JavaScript. Mutations require JSON from the same origin. Configure `SKILLD_WEB_ORIGIN` to the public site origin behind a reverse proxy. Responses are not cached.

The backend agent migration and matching admin changes are required. Custom URL schemes also require rebuilt mobile apps; updating JavaScript alone does not register the new schemes.

## Checks

Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Use `npm run build:docker` to validate the Next.js production build.

## Docker and AWS EC2

The production container runs Next.js standalone behind Nginx on HTTP port 80, with browser HTTPS handled by Cloudflare. See [the EC2 deployment guide](docs/ec2-deployment.md) for the existing deployment workflow.

Docker uses `npm run build:docker`; the Vinext development and build commands remain available. Local environment files are excluded from the image.
