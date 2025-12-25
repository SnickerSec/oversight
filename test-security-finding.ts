// TEST FILE - Delete after verifying scan works
// This file contains intentional security findings for testing

// Gitleaks should detect this fake API key
const FAKE_API_KEY = 'AKIAIOSFODNN7EXAMPLE';
const FAKE_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

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

export { config, unsafeEval, FAKE_API_KEY, FAKE_SECRET };
