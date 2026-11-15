export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

export type SpotDifficulty = 'blue' | 'red' | 'black' | 'pro';
export type SpotType = 'bikepark' | 'pumptrack' | 'enduro' | 'dirt' | 'street';

export interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  label?: string;
}

export interface Spot {
  id: string;
  name: string;
  locationStatus: 'verified' | 'unverified';
  locationSource?: string;
  region: string;
  locationName?: string;
  coords?: {
    lat: number;
    lng: number;
  };
  type?: SpotType;
  difficulty?: SpotDifficulty;
  elevationDropM?: number;
  trailLengthKm?: number;
  trailsCount?: number;
  liftAvailable?: boolean;
  surface?: string;
  description?: string;
  topTip?: string;
  startElevationM?: number;
  finishElevationM?: number;
  avgGradePercent?: number;
  featuredTrails?: string[];
  elevationProfile?: ElevationPoint[];
  city?: string;
  isSecret?: boolean;
  secretLore?: string;
  osmType?: 'node' | 'way' | 'relation';
  osmId?: number;
  checkedAt?: string;
}

export type BikeDiscipline = 'XC' | 'Trail' | 'Enduro' | 'DH' | 'Gravel';

export const BIKE_DISCIPLINE_LABELS: Record<BikeDiscipline, string> = {
  XC: 'Крос-кантрі (XC)',
  Trail: 'Трейл',
  Enduro: 'Ендуро',
  DH: 'Даунгіл (DH)',
  Gravel: 'Гравел',
};

export interface GeometryData {
  discipline: BikeDiscipline;
  riderHeightCm: number;
  reachMm: number;
  stackMm: number;
  headAngleDeg: number;
  chainstayMm: number;
  wheelbaseMm: number;
  seatTubeAngleDeg: number;
}

export interface CompatibilityCheckItem {
  id: string;
  category: 'Freehub' | 'BottomBracket' | 'Axle' | 'Drivetrain';
  name: string;
  standardA: string;
  standardB: string;
  isCompatible: boolean;
  statusText: string;
  details: string;
  warningNote?: string;
}

export interface RiderProfile {
  username: string;
  callsign: string;
  discipline: BikeDiscipline;
  bikeModel: string;
  riderWeightKg: number;
  riderHeightCm?: number;
  frameSize?: string;
  forkTravelMm: number;
  shockTravelMm: number;
  frontTirePsi: number;
  rearTirePsi: number;
}
