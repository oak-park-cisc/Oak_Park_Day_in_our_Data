export interface GenusShare {
  name: string;
  share: number;
  common?: string;
}

export type BlockStatus = 'risk' | 'cusp' | 'meets' | 'few';

type LatLng = [number, number];

export interface Block {
  id: string;
  name: string;
  trees: number;
  species: number;
  genera: number;
  shannon: number;
  topGenus: GenusShare;
  topSpecies: GenusShare;
  topGenera: GenusShare[];
  topFamily: GenusShare | null;
  status: BlockStatus;
  medianDbh: number | null;
  meanHeight: number | null;
  meanSpread: number | null;
  canopySqFt: number;
  lengthFt: number;
  treesPer100Ft: number | null;
  canopyPer100Ft: number | null;
  bg: string | null;
  priority: boolean;
  bbox: [LatLng, LatLng];
  // centerline segments of the hundred-block, each a [lat, lng] polyline
  lines: LatLng[][];
}

export interface Village {
  totalTrees: number;
  blocks: number;
  species: number;
  genera: number;
  topSpecies: GenusShare;
  topGenus: GenusShare;
  topGenera: GenusShare[];
  families: number;
  topFamilies: GenusShare[];
  shannon: number;
  statusCounts: Record<BlockStatus, number>;
  medianDbh: number | null;
  meanHeight: number | null;
  meanSpread: number | null;
  canopyAcres: number;
  topSpeciesList: GenusShare[];
  dbhClasses: { label: string; count: number }[];
  treesPerAcreRho: Record<ScatterFactor, number>;
  lowCanopyPer100Ft: number;
  landAcres: number;
  canopyCover: number;
  canopyBreaks: number[];
  priorityCount: number;
}

export type SviIndex =
  | 'poverty'
  | 'seniors'
  | 'under5'
  | 'disability'
  | 'noVehicle'
  | 'frontline'
  | 'rentBurden'
  | 'homeCostBurden'
  | 'foodStamps'
  | 'unemployment'
  | 'singleParent'
  | 'language'
  | 'race'
  | 'rentedBuildingAge';

export type ScatterFactor =
  | 'composite'
  | 'seniors'
  | 'noVehicle'
  | 'disability'
  | 'under5'
  | 'poverty';

export interface BlockGroup {
  id: string;
  composite: number;
  rank: number;
  fifth: number;
  indices: Record<SviIndex, number>;
  areaAcres: number;
  treesPerAcre: number | null;
  canopyShare: number | null;
  rings: LatLng[][];
}

export type ColorBy = 'diversity' | 'vulnerability' | 'canopy';

export interface Park {
  name: string;
  rings: LatLng[][];
}

export interface TreePoint {
  i: number;
  la: number;
  lo: number;
  g: string;
  s: string;
  p: string;
  // botanical family (APG IV); null for placeholder genera
  f: string | null;
  d: number | null;
  w: number | null;
  k: number;
  q: number;
}

export interface AppData {
  village: Village;
  // village outline rings, [lat, lng]
  boundary: LatLng[][];
  blocks: Block[];
  parks: Park[];
  vulnerability: BlockGroup[];
  names: {
    species: Record<string, string>;
    genera: Record<string, string>;
    families: Record<string, string>;
  };
  points: TreePoint[];
}
