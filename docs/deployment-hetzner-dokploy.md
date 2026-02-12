# Hetzner + Dokploy Deployment Runbook

## 1. Provision infrastructure

1. Create a Hetzner Cloud project.
2. Provision a CX22 instance in a German region (Falkenstein or Nuremberg).
3. Install Docker and Docker Compose.

## 2. Install Dokploy

1. Follow official Dokploy installation instructions on the server.
2. Secure Dokploy with strong credentials.
3. Point your domain DNS records to the server IP.

## 3. Connect repository

1. Add this repository to Dokploy.
2. Set build method to Dockerfile.
3. Configure auto-deploy webhook on push to `master`.

## 4. Configure environment variables

- `ORS_API_KEY`: required
- Any affiliate or analytics secrets: optional

Never commit secrets to git. Set them in Dokploy only.

## 5. SSL and hardening

1. Enable Let's Encrypt certificate in Dokploy.
2. Confirm HTTPS redirect.
3. Validate security headers from `next.config.ts`.

## 6. Smoke checks

1. Open `/` and submit a sample route.
2. Verify route cards and official links render.
3. Verify legal pages `/impressum`, `/datenschutz`, `/haftungsausschluss`.
