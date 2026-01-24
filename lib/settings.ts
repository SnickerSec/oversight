import { getRedis } from './redis';
import { encrypt, decrypt } from './encryption';

const SETTINGS_KEY = 'oversight:settings:tokens';

export interface TokenConfig {
  key: string;
  label: string;
  description: string;
  required: boolean;
  envVar: string;
  docsUrl?: string;
}

export const TOKEN_CONFIGS: TokenConfig[] = [
  {
    key: 'GITHUB_TOKEN',
    label: 'GitHub Token',
    description: 'Personal access token for accessing private repos and security alerts',
    required: true,
    envVar: 'GITHUB_TOKEN',
    docsUrl: 'https://github.com/settings/tokens',
  },
  {
    key: 'RAILWAY_TOKEN',
    label: 'Railway Token',
    description: 'API token for monitoring Railway deployments',
    required: false,
    envVar: 'RAILWAY_TOKEN',
    docsUrl: 'https://railway.app/account/tokens',
  },
  {
    key: 'SUPABASE_ACCESS_TOKEN',
    label: 'Supabase Token',
    description: 'Access token for monitoring Supabase projects',
    required: false,
    envVar: 'SUPABASE_ACCESS_TOKEN',
    docsUrl: 'https://supabase.com/dashboard/account/tokens',
  },
  {
    key: 'GCP_PROJECT_ID',
    label: 'GCP Project ID',
    description: 'Google Cloud project identifier',
    required: false,
    envVar: 'GCP_PROJECT_ID',
  },
  {
    key: 'GCP_SERVICE_ACCOUNT_KEY',
    label: 'GCP Service Account Key',
    description: 'JSON key for GCP service account authentication',
    required: false,
    envVar: 'GCP_SERVICE_ACCOUNT_KEY',
    docsUrl: 'https://console.cloud.google.com/iam-admin/serviceaccounts',
  },
  {
    key: 'ELEVENLABS_API_KEY',
    label: 'ElevenLabs API Key',
    description: 'API key for ElevenLabs voice service monitoring',
    required: false,
    envVar: 'ELEVENLABS_API_KEY',
    docsUrl: 'https://elevenlabs.io/app/settings/api-keys',
  },
  {
    key: 'SLACK_WEBHOOK_URL',
    label: 'Slack Webhook URL',
    description: 'Webhook URL for deployment failure alerts',
    required: false,
    envVar: 'SLACK_WEBHOOK_URL',
    docsUrl: 'https://api.slack.com/messaging/webhooks',
  },
];

export interface StoredTokens {
  [key: string]: string;
}

/**
 * Get all stored tokens from Redis
 */
export async function getStoredTokens(): Promise<StoredTokens> {
  const redis = getRedis();
  if (!redis) return {};

  try {
    // Check if encryption key is available before attempting to decrypt
    if (!process.env.ENCRYPTION_KEY && !process.env.NEXTAUTH_SECRET) {
      return {};
    }

    const encrypted = await redis.get(SETTINGS_KEY);
    if (!encrypted) return {};

    const decrypted = decrypt(encrypted);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Failed to get stored tokens:', error);
    return {};
  }
}

/**
 * Store a token in Redis (encrypted)
 */
export async function storeToken(key: string, value: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    throw new Error('Redis not configured. Add REDIS_URL to enable token storage.');
  }

  try {
    const existing = await getStoredTokens();
    existing[key] = value;

    const encrypted = encrypt(JSON.stringify(existing));
    await redis.set(SETTINGS_KEY, encrypted);
    return true;
  } catch (error) {
    console.error('Failed to store token:', error);
    throw error;
  }
}

/**
 * Delete a token from Redis
 */
export async function deleteToken(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
    const existing = await getStoredTokens();
    delete existing[key];

    if (Object.keys(existing).length === 0) {
      await redis.del(SETTINGS_KEY);
    } else {
      const encrypted = encrypt(JSON.stringify(existing));
      await redis.set(SETTINGS_KEY, encrypted);
    }
    return true;
  } catch (error) {
    console.error('Failed to delete token:', error);
    return false;
  }
}

/**
 * Get a token value - checks Redis first, then falls back to env var
 */
export async function getToken(key: string): Promise<string | undefined> {
  // Check Redis first
  const stored = await getStoredTokens();
  if (stored[key]) {
    return stored[key];
  }

  // Fall back to environment variable
  return process.env[key];
}

/**
 * Get token status for all configured tokens
 */
export async function getTokenStatus(): Promise<
  Array<TokenConfig & { configured: boolean; source: 'redis' | 'env' | 'none' }>
> {
  const stored = await getStoredTokens();

  return TOKEN_CONFIGS.map((config) => {
    const inRedis = !!stored[config.key];
    const inEnv = !!process.env[config.envVar];

    return {
      ...config,
      configured: inRedis || inEnv,
      source: inRedis ? 'redis' : inEnv ? 'env' : 'none',
    };
  });
}
