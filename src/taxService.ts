import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nyTaxRates from './data/ny/tax-rates.generated.json';

export type SpecialRateItem = {
  name: string;
  rate: number;
};

export interface TaxBreakdown {
  composite_tax_rate: number;
  tax_amount: number;
  total_amount: number;
  breakdown: {
    state_rate: number;
    county_rate: number;
    city_rate: number;
    special_rates: SpecialRateItem[];
  };
  jurisdictions: string[];
}

type TaxRatesData = typeof nyTaxRates;
type LocalityRate = TaxRatesData['localities'][number];

const MCTD_COUNTIES = new Set([
  'Bronx',
  'Kings',
  'New York',
  'Queens',
  'Richmond',
  'Nassau',
  'Suffolk',
  'Westchester',
  'Rockland',
  'Putnam',
  'Orange',
  'Dutchess'
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nyCounties = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'data/ny/ny-counties.geojson'), 'utf8')
) as { features: any[] };
const nyPlaces = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'data/ny/ny-places.geojson'), 'utf8')
) as { features: any[] };

const COUNTY_FEATURES = nyCounties.features;
const PLACE_FEATURES = nyPlaces.features;

const COUNTY_BY_NORMALIZED_NAME = new Map(
  Object.keys(nyTaxRates.counties).map((name) => [normalizeName(name), name])
);

const LOCALITY_INDEX = new Map<string, LocalityRate>();
for (const locality of nyTaxRates.localities) {
  LOCALITY_INDEX.set(`${normalizeName(locality.county)}::${normalizeName(locality.name)}`, locality);
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function roundRate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function countyForFeatureName(raw: string): string | null {
  const cleaned = raw.replace(/\s+County$/i, '').trim();
  return COUNTY_BY_NORMALIZED_NAME.get(normalizeName(cleaned)) ?? null;
}

export function findCounty(lat: number, lon: number): string | null {
  const pt = point([lon, lat]);
  for (const feature of COUNTY_FEATURES) {
    if (booleanPointInPolygon(pt, feature as any)) {
      const county = countyForFeatureName(String(feature?.properties?.name ?? ''));
      if (county) {
        return county;
      }
    }
  }

  return null;
}

function findLocalityForPoint(lat: number, lon: number, county: string): LocalityRate | null {
  const pt = point([lon, lat]);
  for (const feature of PLACE_FEATURES) {
    if (!booleanPointInPolygon(pt, feature as any)) {
      continue;
    }

    const placeName = String(feature?.properties?.name ?? '').trim();
    if (!placeName) {
      continue;
    }

    const matched = LOCALITY_INDEX.get(`${normalizeName(county)}::${normalizeName(placeName)}`);
    if (matched) {
      return matched;
    }
  }

  return null;
}

export function isWithinNY(lat: number, lon: number): boolean {
  return findCounty(lat, lon) !== null;
}

export function calculateNYTax(lat: number, lon: number, subtotal: number): TaxBreakdown {
  const county = findCounty(lat, lon);
  if (!county) {
    throw new Error('Unable to determine county for NY coordinates');
  }

  const countyRateData = nyTaxRates.counties[county as keyof typeof nyTaxRates.counties];
  if (!countyRateData) {
    throw new Error(`Missing county tax rate for ${county}`);
  }

  const locality = findLocalityForPoint(lat, lon, county);
  const appliesMctd = MCTD_COUNTIES.has(county);

  const stateRate = nyTaxRates.state_rate;
  const specialRates: SpecialRateItem[] = appliesMctd
    ? [{ name: 'MCTD', rate: nyTaxRates.mctd_rate }]
    : [];
  const specialTotal = specialRates.reduce((sum, item) => sum + item.rate, 0);

  const countyCombined = countyRateData.combined_rate;
  const effectiveCombined = locality?.combined_rate ?? countyCombined;

  const countyLocalPart = Math.max(0, countyCombined - stateRate - specialTotal);
  const effectiveLocalPart = Math.max(0, effectiveCombined - stateRate - specialTotal);

  const countyRate = roundRate(countyLocalPart);
  const cityRate = roundRate(Math.max(0, effectiveLocalPart - countyLocalPart));

  const compositeRate = roundRate(stateRate + countyRate + cityRate + specialTotal);
  const taxAmount = roundMoney(subtotal * compositeRate);
  const totalAmount = roundMoney(subtotal + taxAmount);

  const jurisdictions = ['New York State', `${county} County`];
  if (locality) {
    jurisdictions.push(locality.name);
  }
  for (const special of specialRates) {
    jurisdictions.push(special.name);
  }

  return {
    composite_tax_rate: compositeRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    breakdown: {
      state_rate: stateRate,
      county_rate: countyRate,
      city_rate: cityRate,
      special_rates: specialRates
    },
    jurisdictions
  };
}
