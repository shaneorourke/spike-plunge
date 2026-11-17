import type { LeaderboardEntry } from '../types/game';

const LEADERBOARD_KEY = 'spike_plunge_leaderboard_v1';
const CALLSIGN_KEY = 'spike_plunge_callsign_v1';
const MAX_ENTRIES = 50;

export function getSavedCallsign(): string {
  try {
    const saved = localStorage.getItem(CALLSIGN_KEY);
    if (saved && saved.trim().length > 0) {
      return saved.trim().slice(0, 16);
    }
  } catch {
    // ignore storage errors
  }
  return 'DIVER-01';
}

export function saveCallsign(callsign: string): string {
  const cleaned = callsign.trim().slice(0, 16) || 'DIVER-01';
  try {
    localStorage.setItem(CALLSIGN_KEY, cleaned);
  } catch {
    // ignore
  }
  return cleaned;
}

function normalizeEntry(raw: Partial<LeaderboardEntry>): LeaderboardEntry | null {
  if (!raw || typeof raw.callsign !== 'string') return null;
  const highestLevelCleared =
    typeof raw.highestLevelCleared === 'number'
      ? Math.max(0, raw.highestLevelCleared)
      : 0;
  return {
    id:
      typeof raw.id === 'string' && raw.id.length > 0
        ? raw.id
        : `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    callsign: raw.callsign.trim().slice(0, 16) || 'DIVER-01',
    highestLevelCleared,
    reachedLevel:
      typeof raw.reachedLevel === 'number'
        ? Math.max(1, raw.reachedLevel)
        : Math.max(1, highestLevelCleared + 1),
    totalClears:
      typeof raw.totalClears === 'number'
        ? Math.max(0, raw.totalClears)
        : highestLevelCleared,
    totalMeters:
      typeof raw.totalMeters === 'number' ? Math.max(0, raw.totalMeters) : 0,
    bestSpeedKmh:
      typeof raw.bestSpeedKmh === 'number' ? Math.max(0, raw.bestSpeedKmh) : 0,
    deaths: typeof raw.deaths === 'number' ? Math.max(0, raw.deaths) : 0,
    limbsLost:
      typeof raw.limbsLost === 'number' ? Math.max(0, raw.limbsLost) : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : undefined,
  };
}

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((item) => normalizeEntry(item as Partial<LeaderboardEntry>))
      .filter((item): item is LeaderboardEntry => item !== null);
    return sortLeaderboard(normalized);
  } catch {
    return [];
  }
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.highestLevelCleared !== a.highestLevelCleared) {
      return b.highestLevelCleared - a.highestLevelCleared;
    }
    if (b.totalClears !== a.totalClears) {
      return b.totalClears - a.totalClears;
    }
    if (b.bestSpeedKmh !== a.bestSpeedKmh) {
      return b.bestSpeedKmh - a.bestSpeedKmh;
    }
    if (b.totalMeters !== a.totalMeters) {
      return b.totalMeters - a.totalMeters;
    }
    return a.createdAt - b.createdAt;
  });
}

function saveEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = sortLeaderboard(entries).slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(sorted));
  } catch {
    // ignore storage quota errors
  }
  return sorted;
}

export function recordStageClearOnLeaderboard(params: {
  callsign: string;
  clearedStage: number;
  clearedMeters: number;
  maxSpeedKmh: number;
}): {
  entries: LeaderboardEntry[];
  entryId: string;
  rank: number | null;
  isNewBestStage: boolean;
} {
  const cleanedCallsign = saveCallsign(params.callsign);
  const existing = loadLeaderboard();
  const prevTopStage =
    existing.length > 0 ? existing[0].highestLevelCleared : 0;

  const key = cleanedCallsign.toLowerCase();
  const idx = existing.findIndex((e) => e.callsign.toLowerCase() === key);
  const now = Date.now();

  let targetEntry: LeaderboardEntry;
  let updatedList: LeaderboardEntry[];

  if (idx >= 0) {
    const prev = existing[idx];
    targetEntry = {
      ...prev,
      callsign: cleanedCallsign,
      highestLevelCleared: Math.max(
        prev.highestLevelCleared,
        params.clearedStage
      ),
      reachedLevel: Math.max(prev.reachedLevel, params.clearedStage + 1),
      totalClears: prev.totalClears + 1,
      totalMeters: prev.totalMeters + Math.max(0, params.clearedMeters),
      bestSpeedKmh: Math.max(prev.bestSpeedKmh, params.maxSpeedKmh),
      updatedAt: now,
    };
    updatedList = existing.map((item, i) => (i === idx ? targetEntry : item));
  } else {
    targetEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      callsign: cleanedCallsign,
      highestLevelCleared: params.clearedStage,
      reachedLevel: params.clearedStage + 1,
      totalClears: 1,
      totalMeters: Math.max(0, params.clearedMeters),
      bestSpeedKmh: params.maxSpeedKmh,
      deaths: 0,
      limbsLost: 0,
      createdAt: now,
      updatedAt: now,
    };
    updatedList = [...existing, targetEntry];
  }

  const merged = saveEntries(updatedList);
  const newIdx = merged.findIndex((item) => item.id === targetEntry.id);
  return {
    entries: merged,
    entryId: targetEntry.id,
    rank: newIdx >= 0 ? newIdx + 1 : null,
    isNewBestStage:
      params.clearedStage > 0 && params.clearedStage > prevTopStage,
  };
}

export function recordStageFailureOnLeaderboard(params: {
  callsign: string;
  stageNumber: number;
  fallenMeters: number;
  maxSpeedKmh: number;
  limbsLost: number;
}): {
  entries: LeaderboardEntry[];
  entryId: string;
  rank: number | null;
} {
  const cleanedCallsign = saveCallsign(params.callsign);
  const existing = loadLeaderboard();
  const key = cleanedCallsign.toLowerCase();
  const idx = existing.findIndex((e) => e.callsign.toLowerCase() === key);
  const now = Date.now();

  let targetEntry: LeaderboardEntry;
  let updatedList: LeaderboardEntry[];

  if (idx >= 0) {
    const prev = existing[idx];
    targetEntry = {
      ...prev,
      callsign: cleanedCallsign,
      reachedLevel: Math.max(prev.reachedLevel, params.stageNumber),
      totalMeters: prev.totalMeters + Math.max(0, params.fallenMeters),
      bestSpeedKmh: Math.max(prev.bestSpeedKmh, params.maxSpeedKmh),
      deaths: prev.deaths + 1,
      limbsLost: prev.limbsLost + params.limbsLost,
      updatedAt: now,
    };
    updatedList = existing.map((item, i) => (i === idx ? targetEntry : item));
  } else {
    targetEntry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      callsign: cleanedCallsign,
      highestLevelCleared: 0,
      reachedLevel: params.stageNumber,
      totalClears: 0,
      totalMeters: Math.max(0, params.fallenMeters),
      bestSpeedKmh: params.maxSpeedKmh,
      deaths: 1,
      limbsLost: params.limbsLost,
      createdAt: now,
      updatedAt: now,
    };
    updatedList = [...existing, targetEntry];
  }

  const merged = saveEntries(updatedList);
  const newIdx = merged.findIndex((item) => item.id === targetEntry.id);
  return {
    entries: merged,
    entryId: targetEntry.id,
    rank: newIdx >= 0 ? newIdx + 1 : null,
  };
}

export function clearLeaderboard(): LeaderboardEntry[] {
  try {
    localStorage.removeItem(LEADERBOARD_KEY);
  } catch {
    // ignore
  }
  return [];
}
