import type {
  CharacterDef,
  CharacterId,
  PlayerProgress,
  StageStats,
} from '../types/game';

const PROGRESS_KEY = 'spike_plunge_progress_v1';

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'stickman',
    name: 'Stickman',
    tagline: 'Original crash-test diver.',
    requiredStreak: 0,
    requiredTotalJumps: 0,
    primaryColor: '#F8FAFC',
    accentColor: '#94A3B8',
  },
  {
    id: 'chicken',
    name: 'Cluck Norris',
    tagline: 'Aerodynamics of a brick with feathers.',
    requiredStreak: 2,
    requiredTotalJumps: 2,
    primaryColor: '#FFFBEB',
    accentColor: '#EF4444',
  },
  {
    id: 'bunny',
    name: 'Hopper',
    tagline: 'Floppy ears catch every crosswind.',
    requiredStreak: 3,
    requiredTotalJumps: 5,
    primaryColor: '#F1F5F9',
    accentColor: '#F472B6',
  },
  {
    id: 'capybara',
    name: 'Chillbara',
    tagline: 'Unbothered at 140 km/h.',
    requiredStreak: 5,
    requiredTotalJumps: 9,
    primaryColor: '#A16207',
    accentColor: '#713F12',
  },
  {
    id: 'sloth',
    name: 'Hang Ten',
    tagline: 'Too relaxed to panic near spikes.',
    requiredStreak: 8,
    requiredTotalJumps: 15,
    primaryColor: '#857566',
    accentColor: '#E7E0D8',
  },
  {
    id: 'shark',
    name: 'Chomp',
    tagline: 'Apex predator out of water.',
    requiredStreak: 11,
    requiredTotalJumps: 23,
    primaryColor: '#475569',
    accentColor: '#38BDF8',
  },
  {
    id: 'frog',
    name: 'Ribbit',
    tagline: 'Spring-loaded amphibian.',
    requiredStreak: 14,
    requiredTotalJumps: 33,
    primaryColor: '#4ADE80',
    accentColor: '#BEF264',
  },
  {
    id: 'penguin',
    name: 'Waddles',
    tagline: 'Flightless bird, maximal terminal velocity.',
    requiredStreak: 18,
    requiredTotalJumps: 45,
    primaryColor: '#1E293B',
    accentColor: '#F59E0B',
  },
  {
    id: 'skeleton',
    name: 'Rattlebones',
    tagline: 'Already missing the soft parts.',
    requiredStreak: 23,
    requiredTotalJumps: 63,
    primaryColor: '#E2E8F0',
    accentColor: '#94A3B8',
  },
];

export function getCharacterById(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function loadPlayerProgress(): PlayerProgress {
  const fallback: PlayerProgress = {
    selectedCharacter: 'stickman',
    unlockedIds: ['stickman'],
    bestStreak: 0,
    totalJumpsCleared: 0,
    highestStageReached: 1,
    stageStats: {},
  };
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PlayerProgress>;
    const validIds = new Set(CHARACTERS.map((c) => c.id));
    const unlockedSet = new Set<CharacterId>(['stickman']);
    if (Array.isArray(parsed.unlockedIds)) {
      for (const id of parsed.unlockedIds) {
        if (validIds.has(id)) unlockedSet.add(id);
      }
    }
    const selected =
      parsed.selectedCharacter && unlockedSet.has(parsed.selectedCharacter)
        ? parsed.selectedCharacter
        : 'stickman';
    const bestStreak =
      typeof parsed.bestStreak === 'number' ? Math.max(0, parsed.bestStreak) : 0;
    const highestStageReached = Math.max(
      1,
      bestStreak + 1,
      typeof parsed.highestStageReached === 'number'
        ? parsed.highestStageReached
        : 1
    );

    const stageStats: Record<number, StageStats> = {};
    if (parsed.stageStats && typeof parsed.stageStats === 'object') {
      for (const [k, v] of Object.entries(parsed.stageStats)) {
        const num = Number(k);
        if (Number.isInteger(num) && num >= 1 && v && typeof v === 'object') {
          const rec = v as Partial<StageStats>;
          stageStats[num] = {
            clears: typeof rec.clears === 'number' ? rec.clears : 0,
            attempts: typeof rec.attempts === 'number' ? rec.attempts : 0,
            bestSpeedKmh:
              typeof rec.bestSpeedKmh === 'number' ? rec.bestSpeedKmh : 0,
          };
        }
      }
    }

    return {
      selectedCharacter: selected,
      unlockedIds: Array.from(unlockedSet),
      bestStreak,
      totalJumpsCleared:
        typeof parsed.totalJumpsCleared === 'number'
          ? parsed.totalJumpsCleared
          : 0,
      highestStageReached,
      stageStats,
    };
  } catch {
    return fallback;
  }
}

export function savePlayerProgress(progress: PlayerProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // ignore storage errors
  }
}

export function resetPlayerProgress(): PlayerProgress {
  const fresh: PlayerProgress = {
    selectedCharacter: 'stickman',
    unlockedIds: ['stickman'],
    bestStreak: 0,
    totalJumpsCleared: 0,
    highestStageReached: 1,
    stageStats: {},
  };
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore storage errors
  }
  return fresh;
}

export function selectUnlockedCharacter(
  progress: PlayerProgress,
  id: CharacterId
): PlayerProgress {
  if (!progress.unlockedIds.includes(id)) return progress;
  const next: PlayerProgress = { ...progress, selectedCharacter: id };
  savePlayerProgress(next);
  return next;
}

export function recordClearedJumpProgress(
  progress: PlayerProgress,
  clearedStage: number,
  maxSpeedKmh = 0
): { nextProgress: PlayerProgress; newlyUnlocked: CharacterDef[] } {
  const nextTotal = progress.totalJumpsCleared + 1;
  const nextBest = Math.max(progress.bestStreak, clearedStage);
  const nextReached = Math.max(progress.highestStageReached, clearedStage + 1);
  const unlockedSet = new Set<CharacterId>(progress.unlockedIds);
  const newlyUnlocked: CharacterDef[] = [];

  for (const char of CHARACTERS) {
    if (unlockedSet.has(char.id)) continue;
    if (
      nextBest >= char.requiredStreak ||
      nextTotal >= char.requiredTotalJumps
    ) {
      unlockedSet.add(char.id);
      newlyUnlocked.push(char);
    }
  }

  const prevStage = progress.stageStats[clearedStage] ?? {
    clears: 0,
    attempts: 0,
    bestSpeedKmh: 0,
  };

  const nextProgress: PlayerProgress = {
    ...progress,
    bestStreak: nextBest,
    totalJumpsCleared: nextTotal,
    highestStageReached: nextReached,
    unlockedIds: Array.from(unlockedSet),
    stageStats: {
      ...progress.stageStats,
      [clearedStage]: {
        clears: prevStage.clears + 1,
        attempts: prevStage.attempts + 1,
        bestSpeedKmh: Math.max(prevStage.bestSpeedKmh, maxSpeedKmh),
      },
    },
  };
  savePlayerProgress(nextProgress);
  return { nextProgress, newlyUnlocked };
}

export function recordFailedStageAttempt(
  progress: PlayerProgress,
  failedStage: number
): PlayerProgress {
  const prevStage = progress.stageStats[failedStage] ?? {
    clears: 0,
    attempts: 0,
    bestSpeedKmh: 0,
  };
  const nextProgress: PlayerProgress = {
    ...progress,
    stageStats: {
      ...progress.stageStats,
      [failedStage]: {
        ...prevStage,
        attempts: prevStage.attempts + 1,
      },
    },
  };
  savePlayerProgress(nextProgress);
  return nextProgress;
}
