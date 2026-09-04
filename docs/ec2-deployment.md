# Deploy Skilld Web on EC2

This deployment runs Next.js in a non-root Node container behind Nginx on **HTTP port 80**. Cloudflare provides browser HTTPS. The registration UI and referral links keep using the public web hostname.

Traffic flow: browser → HTTPS → Cloudflare → HTTP → Nginx → Next.js → HTTPS → Skilld API.

Cloudflare **Flexible** mode leaves the Cloudflare-to-EC2 hop unencrypted, including registration payloads. This is the HTTP-origin setup requested; it is not end-to-end TLS. [Cloudflare Flexible documentation](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/flexible/)

## 1. Prepare an EC2 instance

Use Ubuntu Server **24.04 LTS, x86-64**. A `t3.medium` with 4 GiB RAM and 30 GiB gp3 storage is a practical starting point for building the image on the instance; it is not a guaranteed minimum. Smaller instances may run out of memory during the Next.js build. [AWS T3 specifications](https://aws.amazon.com/ec2/instance-types/t3/)

Attach an Elastic IP and use a public subnet with an Internet Gateway route. An Elastic IP keeps the DNS target stable across stop/start; allocated public IPv4 addresses incur AWS charges. [AWS networking](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html), [Elastic IPs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)

Configure the security group:

| Port | Source | Purpose |
| --- | --- | --- |
| TCP 22 | Your public IP only, e.g. `203.0.113.10/32` | SSH |
| TCP 80 | Cloudflare's current IPv4 ranges | HTTP origin |
| TCP 3000 | No inbound rule | Private Next.js service |
| TCP 443 | No inbound rule needed for this stack | TLS terminates at Cloudflare |

Cloudflare ranges are included in `deploy/nginx/cloudflare-real-ip.conf`; use the same current ranges for the EC2 TCP 80 rules. Add IPv6 origin rules only if you configure IPv6. Keep outbound access available for Docker/package downloads, DNS, and the backend API. [Cloudflare origin IP allowlisting](https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/), [AWS security-group rules](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html)

This Compose stack owns port 80. If another Nginx or backend already uses port 80 on the instance, use a separate instance or integrate the web upstream into that existing proxy. Do not start two proxies on the same host port.

## 2. Configure Cloudflare

Use a hostname such as `register.example.com`:

1. Add an **A** record pointing to the EC2 Elastic IP and enable **Proxied** (orange cloud). Remove an incorrect AAAA record if the origin has no IPv6.
2. Confirm that Cloudflare has an active edge certificate for this hostname.
3. Under **Rules → Overview → Create rule → Configuration Rule**, match `http.host eq "register.example.com"` and set **SSL → Flexible**. Scope the rule to the web hostname so an existing backend API can retain Full (strict). Ensure a later rule does not override it.
4. Redirect visitors to HTTPS at the Cloudflare edge. Use a hostname-scoped redirect if only this host should change, or **SSL/TLS → Edge Certificates → Always Use HTTPS** if the entire zone should redirect.
5. Keep the default cache behavior; do not add a Cache Everything rule for registration/API routes. The API returns `Cache-Control: no-store`.

Do not add an HTTP-to-HTTPS redirect in Nginx: Cloudflare reaches this origin over HTTP, and an origin redirect would loop. [Cloudflare configuration rules](https://developers.cloudflare.com/rules/configuration-rules/create-dashboard/), [SSL overrides](https://developers.cloudflare.com/rules/configuration-rules/settings/#ssl), [edge HTTPS redirects](https://developers.cloudflare.com/ssl/edge-certificates/encrypt-visitor-traffic/)

## 3. Install Docker and Compose on EC2

Connect from your computer:

```bash
chmod 400 /path/to/key.pem
ssh -i /path/to/key.pem ubuntu@YOUR_ELASTIC_IP
```

Run these commands on the Ubuntu 24.04 **x86-64** instance:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -d -m 0755 /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod 0644 /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
```

These use Docker's official apt repository. If using ARM/Graviton instead, select an ARM Ubuntu image and use `Architectures: arm64`. [Docker Ubuntu installation](https://docs.docker.com/engine/install/ubuntu/)

## 4. Copy the updated project and configure it

The repository/source you copy must include the new Docker files and updated lockfile. For a Git-hosted project, replace the placeholder URL:

```bash
git clone 'YOUR_SKILLD_WEB_REPOSITORY_URL' skilld-web
cd skilld-web
cp .env.docker.example .env.docker
chmod 600 .env.docker
nano .env.docker
```

Set:

```dotenv
SITE_DOMAIN=register.example.com
SITE_URL=https://register.example.com
SKILLD_API_URL=https://api.example.com/api
IMAGE_TAG=latest
HTTP_BIND=0.0.0.0
HTTP_PORT=80
```

- `SITE_DOMAIN` is the public hostname without a scheme or path.
- `SITE_URL` is the URL visitors use, so keep **https** with Cloudflare SSL even though Nginx uses HTTP. It supplies the API origin check at runtime and social metadata at build time. Rebuild after changing it.
- `SKILLD_API_URL` is server-only and read at runtime. Include `/api`, use an address reachable from inside the container, and use HTTPS for a remote backend. `localhost` inside this container means the web container itself.
- `.env.docker` is passed explicitly to Compose. The local development `.env` is neither copied into the image nor loaded into the container.
- The web container needs no database, Redis, AWS credentials, or login configuration.

In the **backend** environment, set the matching referral base URL so mobile/API-generated links open this site:

```dotenv
REFERRAL_SHARE_BASE_URL=https://register.example.com/r
```

Refresh the backend's cached configuration using its normal deployment process, e.g. `php artisan config:cache`, and restart long-running backend workers as appropriate. The website's success screen already builds referral links from the browser's own origin.

Nginx forwards verified visitor IPs to the web proxy. If the Laravel API uses client-IP throttles, its trusted-proxy configuration must trust the actual web proxy path before honoring forwarded IPs; otherwise requests may share the web server's IP. Do not configure trust for arbitrary internet clients.

## 5. Build and start

From the EC2 project's directory:

```bash
sudo docker compose --env-file .env.docker config --quiet
sudo docker compose --env-file .env.docker up -d --build --wait
sudo docker compose --env-file .env.docker ps
sudo docker compose --env-file .env.docker exec nginx nginx -t
```

Compose starts Nginx after the web health check passes. Both services restart after a host reboot through Docker's restart policy. No host Node installation or process manager is needed.

Check locally on EC2, including when the public origin is restricted to Cloudflare:

```bash
curl -fsS -H 'Host: register.example.com' http://127.0.0.1/api/health
```

Then check through Cloudflare:

```bash
curl -fsS https://register.example.com/api/health
curl -I https://register.example.com/r/EXAMPLE-7K4M
```

The health endpoint returns `{"status":"ok"}`. It checks the web server, not backend availability. Open the public URL, verify OTP delivery against your configured backend, register a test account, and confirm that its copied referral link uses the public web hostname. There is no web login.

## 6. Updates and troubleshooting

After retrieving your reviewed source update:

```bash
sudo docker compose --env-file .env.docker up -d --build --wait
sudo docker compose --env-file .env.docker logs --tail=100 web nginx
```

If only `SKILLD_API_URL` changes, running `up -d --wait` is enough. If `SITE_URL` changes, include `--build`. Nginx re-resolves the web container through Docker DNS after recreation.

When files under `deploy/nginx/` change, recreate Nginx so its startup script renders the updated template and remounts the current files:

```bash
sudo docker compose --env-file .env.docker up -d --no-deps --force-recreate nginx
sudo docker compose --env-file .env.docker exec nginx nginx -t
```

- **Port 80 already in use:** inspect the existing listener and integrate with it or use another instance.
- **Cloudflare 521/522:** check the EC2 address, TCP 80 security-group rules, and Nginx container.
- **Cloudflare 525/526:** this origin is HTTP-only; check the hostname's Flexible override.
- **Redirect loop:** remove an origin-side HTTPS redirect; redirect at Cloudflare.
- **Registration returns 403:** `SITE_URL` must exactly match the browser's origin (scheme, hostname, and port). Use the Cloudflare URL rather than the EC2 IP.
- **Registration returns 503:** check `SKILLD_API_URL`, backend reachability, and a valid backend HTTPS certificate. Verify the backend is not protected by a browser-only Cloudflare challenge.
- **Health works but registration returns 429:** verify backend trusted proxies/client-IP throttles.
- **Build killed for memory:** increase build memory or build on a larger machine/CI runner. Images built on Apple Silicon must target `linux/amd64` for the x86-64 instance.
- **Nginx/Cloudflare IP updates:** refresh `deploy/nginx/cloudflare-real-ip.conf` and the security-group allowlist from Cloudflare's [IPv4](https://www.cloudflare.com/ips-v4/) and [IPv6](https://www.cloudflare.com/ips-v6/) lists, then recreate Nginx with the commands above. A reload alone does not re-render its startup template.

## Local Docker check

The backend URL below must be a reachable HTTPS development/test API. This check exposes Nginx only on local port 8080:

```bash
cp .env.docker.example .env.docker
```

Set `SITE_DOMAIN=localhost`, `SITE_URL=http://localhost:8080`, `HTTP_BIND=127.0.0.1`, `HTTP_PORT=8080`, and your `SKILLD_API_URL`. Then:

```bash
docker compose --env-file .env.docker up -d --build --wait
curl -fsS http://localhost:8080/api/health
```

Plain HTTP is fine for the local check; browser clipboard support may differ outside localhost. Use the HTTPS Cloudflare URL in production.

The existing `npm run dev`, `npm run build`, and `npm start` remain the Vinext/Cloudflare development flow. Docker uses `npm run build:docker` and Next.js standalone output instead. [Next.js standalone deployment](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
