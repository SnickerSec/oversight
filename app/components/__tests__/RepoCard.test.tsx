import { render, screen } from '@testing-library/react';
import RepoCard from '../RepoCard';
import type { RepoWithDetails } from '@/lib/github';

// Mock SWR to avoid network calls during tests
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, error: undefined, isLoading: false })),
}));

describe('RepoCard', () => {
  const mockRepo: RepoWithDetails = {
    id: 1,
    name: 'test-repo',
    full_name: 'SnickerSec/test-repo',
    private: false,
    description: 'A test repository',
    html_url: 'https://github.com/SnickerSec/test-repo',
    language: 'TypeScript',
    stargazers_count: 10,
    forks_count: 5,
    open_issues_count: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    pushed_at: '2024-01-15T00:00:00Z',
    fork: false,
    commits: [],
    issues: [],
    pullRequests: [],
    languages: { TypeScript: 1000 },
    securityInfo: {
      hasSecurityPolicy: true,
      hasLicense: true,
      licenseName: 'MIT',
      hasCodeOfConduct: false,
      hasContributing: false,
      healthPercentage: 75,
    },
    securityAlerts: {
      dependabot: [],
      codeScanning: [],
      secretScanning: [],
    },
    workflowRuns: [],
  };

  it('should render repository name', () => {
    render(<RepoCard repo={mockRepo} />);
    expect(screen.getByText('test-repo')).toBeInTheDocument();
  });

  it('should render repository description', () => {
    render(<RepoCard repo={mockRepo} />);
    expect(screen.getByText('A test repository')).toBeInTheDocument();
  });

  it('should render language badge', () => {
    render(<RepoCard repo={mockRepo} />);
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
  });

  it('should render repository stats', () => {
    render(<RepoCard repo={mockRepo} />);
    expect(screen.getByText('10')).toBeInTheDocument(); // stars
    expect(screen.getByText('5')).toBeInTheDocument();  // forks
    expect(screen.getByText('3')).toBeInTheDocument();  // issues
  });

  it('should handle repository without description', () => {
    const repoWithoutDescription = { ...mockRepo, description: null };
    render(<RepoCard repo={repoWithoutDescription} />);
    expect(screen.getByText('test-repo')).toBeInTheDocument();
  });

  it('should handle repository without language', () => {
    const repoWithoutLanguage = { ...mockRepo, language: null };
    render(<RepoCard repo={repoWithoutLanguage} />);
    expect(screen.getByText('test-repo')).toBeInTheDocument();
  });

  it('should link to GitHub repository', () => {
    render(<RepoCard repo={mockRepo} />);
    const link = screen.getByRole('link', { name: /test-repo/i });
    expect(link).toHaveAttribute('href', 'https://github.com/SnickerSec/test-repo');
  });
});
