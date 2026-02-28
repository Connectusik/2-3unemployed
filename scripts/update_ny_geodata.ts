import fs from 'node:fs/promises';
import path from 'node:path';
import { simplify } from '@turf/turf';

const COUNTIES_URL = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query';
const PLACES_URL = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/4/query';

const OUT_COUNTIES = path.resolve('src/data/ny/ny-counties.geojson');
const OUT_PLACES = path.resolve('src/data/ny/ny-places.geojson');

type FeatureCollection = {
  type: 'FeatureCollection';
  features: any[];
};

function normalizeCountyName(raw: string): string {
  return raw.replace(/\s+County$/i, '').trim();
}

async function queryLayerGeoJson(url: string, where: string, outFields: string[], pageSize = 100): Promise<FeatureCollection> {
  let offset = 0;
  const features: any[] = [];

  while (true) {
    const params = new URLSearchParams({
      where,
      outFields: outFields.join(','),
      outSR: '4326',
      f: 'geojson',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize)
    });

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`TIGERweb request failed (${response.status} ${response.statusText}) for ${url}`);
    }

    const data = await response.json();
    if (data?.error) {
      throw new Error(`TIGERweb error ${data.error.code}: ${data.error.message || 'unknown error'}`);
    }

    const pageFeatures = Array.isArray(data.features) ? data.features : [];
    features.push(...pageFeatures);

    if (pageFeatures.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return {
    type: 'FeatureCollection',
    features
  };
}

function simplifyCollection(collection: FeatureCollection, tolerance: number): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: collection.features.map((feature) =>
      simplify(feature, {
        tolerance,
        highQuality: false,
        mutate: false
      })
    )
  };
}

async function main() {
  console.log('Downloading NY counties from TIGERweb...');
  const countiesRaw = await queryLayerGeoJson(COUNTIES_URL, "STATE = '36'", ['NAME', 'STATE', 'GEOID'], 80);

  const countiesFiltered: FeatureCollection = {
    type: 'FeatureCollection',
    features: countiesRaw.features
      .filter((feature) => feature?.properties?.STATE === '36')
      .map((feature) => ({
        ...feature,
        properties: {
          name: normalizeCountyName(String(feature.properties?.NAME ?? '')),
          statefp: String(feature.properties?.STATE ?? ''),
          geoid: String(feature.properties?.GEOID ?? '')
        }
      }))
  };

  console.log('Downloading NY incorporated places from TIGERweb...');
  const placesRaw = await queryLayerGeoJson(PLACES_URL, "STATE = '36'", ['NAME', 'STATE', 'GEOID', 'LSADC'], 150);

  const placesFiltered: FeatureCollection = {
    type: 'FeatureCollection',
    features: placesRaw.features
      .filter((feature) => feature?.properties?.STATE === '36')
      .map((feature) => ({
        ...feature,
        properties: {
          name: String(feature.properties?.NAME ?? '').replace(/\s+(city|village|town)$/i, '').trim(),
          place_type: String(feature.properties?.LSADC ?? ''),
          statefp: String(feature.properties?.STATE ?? ''),
          geoid: String(feature.properties?.GEOID ?? '')
        }
      }))
  };

  // Simplify aggressively enough for repository size while preserving point-in-polygon usability.
  const counties = simplifyCollection(countiesFiltered, 0.0016);
  const places = simplifyCollection(placesFiltered, 0.0012);

  await fs.mkdir(path.dirname(OUT_COUNTIES), { recursive: true });
  await fs.writeFile(OUT_COUNTIES, JSON.stringify(counties), 'utf8');
  await fs.writeFile(OUT_PLACES, JSON.stringify(places), 'utf8');

  console.log(`Generated ${OUT_COUNTIES} (${counties.features.length} counties)`);
  console.log(`Generated ${OUT_PLACES} (${places.features.length} places)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
