// TEST FILE - Delete after verifying scan works
// This file contains intentional security findings for testing

// Gitleaks should detect these (using patterns that aren't in allowlists)
const GITHUB_TOKEN = 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx1234';
const SLACK_TOKEN = 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx';
const GENERIC_SECRET = 'api_key_1234567890abcdefghijklmnopqrstuvwxyz';

// Private key pattern (gitleaks should detect)
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7R9EXAMPLE
-----END RSA PRIVATE KEY-----`;

// Semgrep should detect hardcoded credentials
const config = {
  database: {
    host: 'localhost',
    user: 'admin',
    password: 'SuperSecret123!', // hardcoded password
  },
};

// Insecure: eval usage (Semgrep)
function unsafeEval(input: string) {
  return eval(input);
}

export { config, unsafeEval, GITHUB_TOKEN, SLACK_TOKEN, GENERIC_SECRET, PRIVATE_KEY };
