import { aggregateLanguages, getRecentCommits } from '../github';
import type { RepoWithDetails, Commit } from '../github';

describe('aggregateLanguages', () => {
  it('should aggregate language statistics from multiple repositories', () => {
    const repos: Partial<RepoWithDetails>[] = [
      {
        languages: {
          TypeScript: 1000,
          JavaScript: 500,
        },
      },
      {
        languages: {
          TypeScript: 2000,
          Python: 1500,
        },
      },
      {
        languages: {
          JavaScript: 300,
          Python: 700,
        },
      },
    ];

    const result = aggregateLanguages(repos as RepoWithDetails[]);

    expect(result).toEqual({
      TypeScript: 3000,
      JavaScript: 800,
      Python: 2200,
    });
  });

  it('should return empty object for empty repos array', () => {
    const result = aggregateLanguages([]);
    expect(result).toEqual({});
  });

  it('should handle repositories with no languages', () => {
    const repos: Partial<RepoWithDetails>[] = [
      { languages: {} },
      { languages: {} },
    ];

    const result = aggregateLanguages(repos as RepoWithDetails[]);
    expect(result).toEqual({});
  });

  it('should handle single language across repositories', () => {
    const repos: Partial<RepoWithDetails>[] = [
      { languages: { TypeScript: 500 } },
      { languages: { TypeScript: 1000 } },
      { languages: { TypeScript: 250 } },
    ];

    const result = aggregateLanguages(repos as RepoWithDetails[]);
    expect(result).toEqual({ TypeScript: 1750 });
  });
});

describe('getRecentCommits', () => {
  const mockCommits: (Commit & { repoName?: string })[] = [
    {
      sha: 'abc123',
      commit: {
        message: 'First commit',
        author: { name: 'Alice', date: '2024-01-01T10:00:00Z' },
      },
      html_url: 'https://github.com/test/repo1/commit/abc123',
      author: { login: 'alice', avatar_url: 'https://github.com/alice.png' },
    },
    {
      sha: 'def456',
      commit: {
        message: 'Second commit',
        author: { name: 'Bob', date: '2024-01-02T10:00:00Z' },
      },
      html_url: 'https://github.com/test/repo1/commit/def456',
      author: { login: 'bob', avatar_url: 'https://github.com/bob.png' },
    },
    {
      sha: 'ghi789',
      commit: {
        message: 'Third commit',
        author: { name: 'Charlie', date: '2024-01-03T10:00:00Z' },
      },
      html_url: 'https://github.com/test/repo2/commit/ghi789',
      author: { login: 'charlie', avatar_url: 'https://github.com/charlie.png' },
    },
  ];

  it('should return recent commits sorted by date descending', () => {
    const repos: Partial<RepoWithDetails>[] = [
      { name: 'repo1', commits: [mockCommits[0], mockCommits[1]] },
      { name: 'repo2', commits: [mockCommits[2]] },
    ];

    const result = getRecentCommits(repos as RepoWithDetails[]);

    expect(result).toHaveLength(3);
    expect(result[0].commit.message).toBe('Third commit');
    expect(result[1].commit.message).toBe('Second commit');
    expect(result[2].commit.message).toBe('First commit');
    expect(result[0].repoName).toBe('repo2');
    expect(result[1].repoName).toBe('repo1');
  });

  it('should limit results to specified limit', () => {
    const repos: Partial<RepoWithDetails>[] = [
      { name: 'repo1', commits: mockCommits },
    ];

    const result = getRecentCommits(repos as RepoWithDetails[], 2);

    expect(result).toHaveLength(2);
    expect(result[0].commit.message).toBe('Third commit');
    expect(result[1].commit.message).toBe('Second commit');
  });

  it('should return empty array for repos with no commits', () => {
    const repos: Partial<RepoWithDetails>[] = [
      { name: 'repo1', commits: [] },
      { name: 'repo2', commits: [] },
    ];

    const result = getRecentCommits(repos as RepoWithDetails[]);
    expect(result).toEqual([]);
  });

  it('should default to limit of 10', () => {
    const manyCommits = Array.from({ length: 15 }, (_, i) => ({
      sha: `commit${i}`,
      commit: {
        message: `Commit ${i}`,
        author: { name: 'Test', date: new Date(2024, 0, i + 1).toISOString() },
      },
      html_url: `https://github.com/test/repo/commit${i}`,
      author: { login: 'test', avatar_url: 'https://github.com/test.png' },
    }));

    const repos: Partial<RepoWithDetails>[] = [
      { name: 'repo1', commits: manyCommits as Commit[] },
    ];

    const result = getRecentCommits(repos as RepoWithDetails[]);
    expect(result).toHaveLength(10);
  });

  it('should add repoName to each commit', () => {
    const repos: Partial<RepoWithDetails>[] = [
      { name: 'my-awesome-repo', commits: [mockCommits[0]] },
    ];

    const result = getRecentCommits(repos as RepoWithDetails[]);

    expect(result[0]).toHaveProperty('repoName', 'my-awesome-repo');
  });
});
