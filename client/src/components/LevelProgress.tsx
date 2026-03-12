interface LevelProgressProps {
  level: number;
  xp: number;
  nextLevelRequiredXp: number | null;
}

export function LevelProgress({
  level,
  xp,
  nextLevelRequiredXp
}: LevelProgressProps) {
  const maxXp = nextLevelRequiredXp ?? xp;
  const progress =
    maxXp === 0 ? 0 : Math.min(100, Math.round((xp / maxXp) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>Level {level}</span>
        <span>
          {xp} XP
          {nextLevelRequiredXp !== null && ` / ${nextLevelRequiredXp} XP`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

