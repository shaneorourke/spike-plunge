export type GamePhase =
  | 'TITLE'
  | 'READY'
  | 'FALLING'
  | 'DYING'
  | 'LANDED'
  | 'GAME_OVER';

export interface VerletNode {
  id: string;
  x: number;
  y: number;
  oldX: number;
  oldY: number;
  radius: number;
  mass: number;
  pinned?: boolean;
  bloodCooldown: number;
  impaled?: boolean;
}

export interface StickBone {
  id: string;
  a: number;
  b: number;
  length: number;
  stiffness: number;
  thickness: number;
  severable: boolean;
  severed: boolean;
  isPostureSpring?: boolean;
  limbName?: string;
}

export interface Ragdoll {
  nodes: VerletNode[];
  bones: StickBone[];
  alive: boolean;
  tucking: boolean;
  limbsLost: number;
  fatalCause: string | null;
  deathTime: number;
  landTimer: number;
  maxSpeed: number;
  floorBounceCount: number;
  previousSubDt?: number;
  impactDepth?: number;
  bodyAngle: number;
  turnSpeed: number;
  tuckAmount: number;
  restPose: { x: number; y: number }[];
}

export interface Spike {
  id: string;
  baseX1: number;
  baseY1: number;
  baseX2: number;
  baseY2: number;
  tipX: number;
  tipY: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  stained: number;
}

export interface SpikeLedge {
  id: string;
  side: 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
  spikes: Spike[];
}

export interface MovingPiston {
  id: string;
  side: 'left' | 'right';
  y: number;
  wallX: number;
  baseWidth: number;
  height: number;
  amplitude: number;
  speed: number;
  phase: number;
  currentExtend: number;
  stained: number;
}

export interface SawBlade {
  id: string;
  x: number;
  y: number;
  baseX: number;
  moveAmp: number;
  moveSpeed: number;
  phase: number;
  radius: number;
  angle: number;
  stained: number;
}

export interface WindZone {
  id: string;
  yStart: number;
  yEnd: number;
  velocityX: number;
  velocityY: number;
  density: number;
  label: string;
}

export interface ShaftPoint {
  y: number;
  left: number;
  right: number;
}

export interface FlightPlan {
  elevation: number;
  power: number;
  segments: { from: number; to: number; tuck: boolean; angle: number }[];
}

export interface LevelConfig {
  reference: FlightPlan;
  seed: string;
  family: string;
  profile: ShaftPoint[];
  briefing: string;
  tier: string;
  level: number;
  worldWidth: number;
  topLeftX: number;
  topRightX: number;
  bottomLeftX: number;
  bottomRightX: number;
  shaftHeight: number;
  platformX: number;
  platformY: number;
  platformWidth: number;
  platformSide: 'left' | 'right';
  floorY: number;
  gravity: number;
  wallSpikes: Spike[];
  ledges: SpikeLedge[];
  pistons: MovingPiston[];
  saws: SawBlade[];
  windZones: WindZone[];
  difficultyLabel: string;
}

export interface BloodParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface BloodDecal {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  color: string;
  dripLength: number;
  dripProgress: number;
}

export interface Gib {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  size: number;
  kind: 'flesh' | 'bone';
  life: number;
}

export interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface InputState {
  rotate?: number;
  tuck: boolean;
  aimActive: boolean;
  aimAngle: number;
  aimPower: number;
}

export interface RunTelemetry {
  level: number;
  levelsCleared: number;
  currentDepthMeters: number;
  totalHeightMeters: number;
  progressRatio: number;
  speedKmh: number;
  maxSpeedKmh: number;
  totalMetersRun: number;
  limbsLost: number;
  tucking: boolean;
  windForce: number;
  verticalWind?: number;
  airLabel?: string;
  dragArea?: number;
  fatalCause: string | null;
}

export interface LeaderboardEntry {
  id: string;
  callsign: string;
  highestLevelCleared: number;
  reachedLevel: number;
  totalClears: number;
  totalMeters: number;
  bestSpeedKmh: number;
  deaths: number;
  limbsLost: number;
  createdAt: number;
  updatedAt?: number;
}

export type CharacterId =
  | 'stickman'
  | 'chicken'
  | 'bunny'
  | 'capybara'
  | 'sloth'
  | 'shark'
  | 'frog'
  | 'penguin'
  | 'skeleton';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  requiredStreak: number;
  requiredTotalJumps: number;
  primaryColor: string;
  accentColor: string;
}

export interface StageStats {
  clears: number;
  attempts: number;
  bestSpeedKmh: number;
}

export interface PlayerProgress {
  selectedCharacter: CharacterId;
  unlockedIds: CharacterId[];
  bestStreak: number;
  totalJumpsCleared: number;
  highestStageReached: number;
  stageStats: Record<number, StageStats>;
}
