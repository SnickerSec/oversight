# Oversight

GitHub repository monitoring and security scanning dashboard built with Next.js.

## Quick Reference

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm test             # Run Jest tests
npm run test:watch   # Tests in watch mode
docker build -t oversight .  # Build Docker image with security tools
```

## Architecture

- **Framework**: Next.js 16 (App Router, `output: 'standalone'`)
- **Language**: TypeScript, React 19
- **Styling**: Tailwind CSS 3 + shadcn/ui components (`/components/ui/`)
- **Auth**: NextAuth with GitHub OAuth (`/app/api/auth/[...nextauth]/`)
- **State**: SWR for data fetching/caching
- **Cache**: Redis (optional, via `lib/redis.ts`)
- **Deployment**: Docker on Coolify at `coolify.cigardealsonline.com` (must use Dockerfile build, not Nixpacks)
- **Production URL**: `oversight.cigardealsonline.com`
- **Coolify CLI**: v1.4 installed locally, can interface with the Coolify server

## Project Structure

```
app/                    # Next.js App Router
  api/                  # API routes
    github/             # GitHub data endpoint
    security/scan/      # Trigger & poll security scans
    security/tools/     # Tool availability diagnostic endpoint
    settings/           # User settings CRUD
  components/           # App-specific components (Nav, RepoCard, ScanButton, etc.)
  security/             # Security alerts page
  repos/                # Repository list page
  costs/                # Cost tracking page
  settings/             # Settings page
  (service pages)       # railway/, supabase/, gcp/, elevenlabs/
components/ui/          # shadcn/ui primitives (badge, button, card, etc.)
lib/                    # Business logic
  scanner/              # Security scanning (trivy, gitleaks, semgrep)
  github.ts             # GitHub API client
  redis.ts              # Redis connection
  settings.ts           # Encrypted settings store
  encryption.ts         # AES encryption for settings
  utils.ts              # Shared utilities (normalizeSeverity, timeAgo, etc.)
```

## Security Scanning

The app runs three security tools via `child_process.spawn()`:
- **Trivy** — dependency vulnerability scanning
- **Gitleaks** — secret detection
- **Semgrep** — static analysis (SAST)

These are installed in the Dockerfile (not available in Nixpacks builds). The `/api/security/tools` endpoint reports tool availability. Scanner source files are in `lib/scanner/`.

## Key Conventions

- Icons: use `lucide-react` (no inline SVGs)
- CSS variables for theme colors: `--accent`, `--accent-red`, `--accent-green`, `--accent-orange`, `--accent-purple`
- API routes return `NextResponse.json()`
- SWR keys use descriptive strings (e.g., `'dashboard'`)
- Error messages for missing tools reference Docker/Nixpacks (not brew/pip)

## Environment Variables

See `.env.local.example` for all options. Required:
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `GITHUB_OAUTH_ID`, `GITHUB_OAUTH_SECRET`
- `GITHUB_TOKEN` (scopes: `repo`, `security_events`)

Optional: `RAILWAY_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `GCP_PROJECT_ID`, `GCP_SERVICE_ACCOUNT_KEY`, `ELEVENLABS_API_KEY`, `SLACK_WEBHOOK_URL`, `REDIS_URL`
