'use client';

import { LanguageStats as LanguageStatsType } from '@/lib/github';
import { Card } from '@/components/ui/card';
import { Code, BarChart3 } from 'lucide-react';

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
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Code className="w-5 h-5" />
          Languages
        </h2>
        <p className="text-muted-foreground">No language data available</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5" />
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
              <span className="text-muted-foreground ml-auto">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
