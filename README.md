# Oversight

A comprehensive GitHub repository monitoring dashboard for the SnickerSec organization. Track repositories, security alerts, deployments, and integrated services all in one place.

## Features

- **GitHub Integration**: Monitor repositories, commits, issues, pull requests, and workflows
- **Security Monitoring**: Track Dependabot alerts, code scanning results, and secret scanning
- **Multi-Service Integration**:
  - Railway deployment tracking
  - Supabase project monitoring
  - GCP resources (Cloud Run, Functions, Compute Engine, Storage)
  - ElevenLabs subscription and voice management
- **Real-time Updates**: Automatic data refresh with SWR
- **Repository Analytics**: Language statistics, activity feeds, and health scores

## Tech Stack

- **Framework**: Next.js 14.2.35 (App Router)
- **Language**: TypeScript 5.9.3
- **Styling**: TailwindCSS 3.4.19
- **Data Fetching**: SWR 2.3.7
- **Runtime**: React 18.3.1

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- GitHub Personal Access Token
- (Optional) API tokens for Railway, Supabase, GCP, and ElevenLabs

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd oversight
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Edit `.env.local` and add your tokens (see Configuration section below)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Configuration

### Required Environment Variables

**GITHUB_TOKEN** (Required)
- Create at: https://github.com/settings/tokens
- Required scopes: `repo`, `security_events`
- Used for: Repository data, security alerts, workflows, issues, PRs

### Optional Environment Variables

**RAILWAY_TOKEN** (Optional)
- Create at: https://railway.app/account/tokens
- Used for: Deployment status on repository cards

**SUPABASE_ACCESS_TOKEN** (Optional)
- Create at: https://supabase.com/dashboard/account/tokens
- Used for: Project monitoring and advisor alerts

**GCP_PROJECT_ID** (Optional)
- Your Google Cloud Platform project ID
- Used for: GCP resource monitoring

**GCP_SERVICE_ACCOUNT_KEY** (Optional)
- JSON service account key (base64 encoded or as JSON string)
- Used for: Authenticating GCP API requests
- Required IAM roles for full functionality:
  - **Viewer** - Basic read access to resources
  - **Cloud Run Viewer** - View Cloud Run services
  - **Cloud Functions Viewer** - View Cloud Functions
  - **Compute Viewer** - View Compute Engine instances
  - **Storage Object Viewer** - View Storage buckets
  - **Service Usage Consumer** - View enabled APIs and services
- Grant these roles at: `https://console.cloud.google.com/iam-admin/iam`

**ELEVENLABS_API_KEY** (Optional)
- Create at: https://elevenlabs.io/app/settings/api-keys
- Used for: Subscription and voice tracking

## Project Structure

```
oversight/
├── app/
│   ├── api/
│   │   └── github/
│   │       └── route.ts          # Main API endpoint (aggregates all data)
│   ├── components/
│   │   ├── Nav.tsx                # Navigation with activity dropdown
│   │   ├── RepoCard.tsx           # Repository display card
│   │   ├── SecurityAlerts.tsx     # Security alerts panel
│   │   ├── StatsOverview.tsx      # Dashboard statistics
│   │   ├── WorkflowStatus.tsx     # GitHub Actions workflows
│   │   ├── RefreshIndicator.tsx   # Data refresh status
│   │   ├── ActivityFeed.tsx       # Recent commits
│   │   ├── IssuesList.tsx         # Issues component
│   │   ├── PRsList.tsx            # Pull requests component
│   │   └── LanguageStats.tsx      # Language breakdown
│   ├── (routes)/
│   │   ├── page.tsx               # Dashboard (main page)
│   │   ├── repos/page.tsx         # Repositories list
│   │   ├── security/page.tsx      # Security alerts
│   │   ├── railway/page.tsx       # Railway deployments
│   │   ├── supabase/page.tsx      # Supabase projects
│   │   ├── gcp/page.tsx           # GCP resources
│   │   ├── elevenlabs/page.tsx    # ElevenLabs account
│   │   └── layout.tsx             # Root layout
│   └── globals.css                # Global styles
├── lib/
│   └── github.ts                  # GitHub API utilities and types
└── public/                        # Static assets
```

## Available Scripts

- `npm run dev` - Start development server on http://localhost:3000
- `npm run build` - Build for production
- `npm start` - Start production server

## Pages

- **/** - Dashboard with overview statistics, security alerts, and workflow status
- **/repos** - Detailed repository listing with deployment status
- **/security** - Unified security alerts view (Dependabot, code scanning, secrets)
- **/railway** - Railway deployment monitoring
- **/supabase** - Supabase project health and advisors
- **/gcp** - Google Cloud Platform resources
- **/elevenlabs** - ElevenLabs subscription and voice management

## API Endpoints

### GET /api/github

Main API endpoint that aggregates data from all configured services.

**Response:**
```typescript
{
  repos: RepoWithDetails[];      // Repositories with all metadata
  hasToken: boolean;              // Whether GitHub token is configured
  railwayProjects?: Project[];   // Railway projects (if configured)
  supabaseProjects?: any[];      // Supabase projects (if configured)
  gcpResources?: GCPResources;   // GCP resources (if configured)
  elevenLabsData?: any;          // ElevenLabs data (if configured)
}
```

## Development

### Adding New Integrations

1. Add environment variables to `.env.local.example` and `.env.local`
2. Update the main API route at `app/api/github/route.ts`
3. Create a new page under `app/` for the integration
4. Add navigation link to `app/components/Nav.tsx`

### Type Definitions

Core types are defined in `lib/github.ts`:
- `RepoWithDetails` - Repository with all metadata
- `SecurityAlert` - Security alert interface
- `WorkflowRun` - GitHub Actions workflow
- Additional service-specific types

## Deployment

### Vercel (Recommended)

1. Push your repository to GitHub
2. Import project in Vercel dashboard
3. Add environment variables in Vercel project settings
4. Deploy

### Other Platforms

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

3. Ensure all environment variables are set in your hosting platform

## Troubleshooting

**No data showing:**
- Verify `GITHUB_TOKEN` is set correctly in `.env.local`
- Check token has `repo` and `security_events` scopes
- Restart the development server after adding environment variables

**Integration not working:**
- Verify the corresponding API token is set in `.env.local`
- Check API token permissions and validity
- Review browser console and server logs for errors

**Build errors:**
- Run `npm install` to ensure all dependencies are installed
- Delete `.next` folder and rebuild: `rm -rf .next && npm run build`

## License

ISC

## Contributing

This is a private dashboard for the SnickerSec organization. For issues or feature requests, please contact the repository maintainer.
