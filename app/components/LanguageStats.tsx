'use client';

import { LanguageStats as LanguageStatsType } from '@/lib/github';

const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  CSS: '#563d7c',
  HTML: '#e34c26',
  Go: '#00ADD8',
  Rust: '#dea584',
  Java: '#b07219',
  Ruby: '#701516',
  PHP: '#4F5D95',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Shell: '#89e051',
  Vue: '#41b883',
  SCSS: '#c6538c',
};

interface LanguageStatsProps {
  languages: LanguageStatsType;
}

export default function LanguageStats({ languages }: LanguageStatsProps) {
  const total = Object.values(languages).reduce((sum, bytes) => sum + bytes, 0);
  const sorted = Object.entries(languages)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  if (sorted.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M10.561 8.073a6.005 6.005 0 0 1 3.432 5.142.75.75 0 1 1-1.498.07 4.5 4.5 0 0 0-8.99 0 .75.75 0 0 1-1.498-.07 6.004 6.004 0 0 1 3.431-5.142 3.999 3.999 0 1 1 5.123 0ZM10.5 5a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>
          </svg>
          Languages
        </h2>
        <p className="text-[var(--text-muted)]">No language data available</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
          <path d="M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/>
        </svg>
        Languages
      </h2>

      <div className="h-3 rounded-full overflow-hidden flex mb-4 bg-[var(--card-border)]">
        {sorted.map(([lang, bytes]) => (
          <div
            key={lang}
            className="h-full"
            style={{
              width: `${(bytes / total) * 100}%`,
              backgroundColor: languageColors[lang] || '#8b949e',
            }}
            title={`${lang}: ${((bytes / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {sorted.map(([lang, bytes]) => {
          const percentage = ((bytes / total) * 100).toFixed(1);
          return (
            <div key={lang} className="flex items-center gap-2 text-sm">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: languageColors[lang] || '#8b949e' }}
              />
              <span className="truncate">{lang}</span>
              <span className="text-[var(--text-muted)] ml-auto">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
