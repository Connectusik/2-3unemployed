import fs from 'node:fs/promises';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const DEFAULT_SOURCE_URL = 'https://www.tax.ny.gov/pdf/publications/sales/pub718.pdf';
const OUTPUT_PATH = path.resolve('src/data/ny/tax-rates.generated.json');

const NY_COUNTIES = [
  'Albany', 'Allegany', 'Bronx', 'Broome', 'Cattaraugus', 'Cayuga', 'Chautauqua', 'Chemung',
  'Chenango', 'Clinton', 'Columbia', 'Cortland', 'Delaware', 'Dutchess', 'Erie', 'Essex',
  'Franklin', 'Fulton', 'Genesee', 'Greene', 'Hamilton', 'Herkimer', 'Jefferson', 'Kings',
  'Lewis', 'Livingston', 'Madison', 'Monroe', 'Montgomery', 'Nassau', 'New York', 'Niagara',
  'Oneida', 'Onondaga', 'Ontario', 'Orange', 'Orleans', 'Oswego', 'Otsego', 'Putnam',
  'Queens', 'Rensselaer', 'Richmond', 'Rockland', 'St. Lawrence', 'Saratoga', 'Schenectady',
  'Schoharie', 'Schuyler', 'Seneca', 'Steuben', 'Suffolk', 'Sullivan', 'Tioga', 'Tompkins',
  'Ulster', 'Warren', 'Washington', 'Wayne', 'Westchester', 'Wyoming', 'Yates'
];

const BOROUGH_COUNTIES = ['Bronx', 'Kings', 'New York', 'Queens', 'Richmond'];

type CountyRate = {
  combined_rate_percent: number;
  combined_rate: number;
  reporting_code?: string;
  see_new_york_city?: boolean;
};

type LocalityRate = {
  name: string;
  type: string;
  county: string;
  combined_rate: number;
  reporting_code?: string;
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeName(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\*/g, '')
      .replace(/\./g, ' ')
      .replace(/[’']/g, '')
      .replace(/\s+/g, ' ')
  ).toLowerCase();
}

function canonicalCountyName(raw: string): string {
  const cleaned = normalizeWhitespace(
    raw
      .replace(/^\*/g, '')
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .replace(/\s*County$/i, '')
      .replace(/\s*–\s*except$/i, '')
  );

  const candidate = NY_COUNTIES.find((county) => normalizeName(county) === normalizeName(cleaned));
  return candidate ?? cleaned;
}

function parsePercent(raw: string): number {
  const base = Number.parseInt(raw.match(/^\d+/)?.[0] ?? '0', 10);
  const fractionChar = raw.replace(/^\d+/, '');
  const fractionMap: Record<string, number> = {
    '¼': 0.25,
    '½': 0.5,
    '¾': 0.75,
    '⅛': 0.125,
    '⅜': 0.375,
    '⅝': 0.625,
    '⅞': 0.875
  };
  return base + (fractionMap[fractionChar] ?? 0);
}

async function readPdfBuffer(pdfArgPath?: string): Promise<{ sourceUrl: string; data: Uint8Array }> {
  const envPath = process.env.PUB718_PATH?.trim();
  const inputPath = pdfArgPath || envPath;

  if (inputPath) {
    const absolute = path.resolve(inputPath);
    const file = await fs.readFile(absolute);
    return { sourceUrl: `file://${absolute}`, data: new Uint8Array(file) };
  }

  const sourceUrl = process.env.PUB718_URL?.trim() || DEFAULT_SOURCE_URL;
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download Publication 718 (${response.status} ${response.statusText}) from ${sourceUrl}`);
  }

  const buffer = new Uint8Array(await response.arrayBuffer());
  return { sourceUrl, data: buffer };
}

async function extractPdfText(pdfData: Uint8Array): Promise<string> {
  const loadingTask = getDocument({ data: pdfData });
  const doc = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str ?? '').join(' '));
  }

  return normalizeWhitespace(pages.join(' '));
}

function cleanLabel(label: string): string {
  let value = normalizeWhitespace(label);

  // Remove in-flow references like "*Bronx – see New York City" before the next real token.
  value = value.replace(/(?:\*?[A-Za-z.'()\-\s]+?\s*–\s*see\s*New\s+York\s+City\s*)+/gi, '').trim();

  if (!value) {
    return value;
  }

  return normalizeWhitespace(value.replace(/^\*+/, ''));
}

function localityTypeFromLabel(label: string): string {
  const match = label.match(/\(([^)]+)\)/);
  if (!match) {
    return 'locality';
  }
  return normalizeWhitespace(match[1].toLowerCase());
}

function localityNameFromLabel(label: string): string {
  return normalizeWhitespace(label.replace(/\([^)]*\)/g, '').replace(/^\*+/, ''));
}

function parseTaxTable(text: string) {
  const startKey = 'New York State only';
  const endKey = '*Rates in these jurisdictions include';

  const start = text.indexOf(startKey);
  const end = text.indexOf(endKey);

  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Could not locate tax table boundaries in Publication 718 text');
  }

  const table = text.slice(start, end);
  const rateRegex = /(\d+(?:[¼½¾⅛⅜⅝⅞])?)\s+(\d{4})/g;

  const records: Array<{ label: string; percent: number; rate: number; reportingCode: string }> = [];

  let previousEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = rateRegex.exec(table)) !== null) {
    const labelRaw = table.slice(previousEnd, match.index);
    previousEnd = match.index + match[0].length;

    const label = cleanLabel(labelRaw);
    if (!label) {
      continue;
    }

    const percent = parsePercent(match[1]);
    records.push({
      label,
      percent,
      rate: percent / 100,
      reportingCode: match[2]
    });
  }

  const counties: Record<string, CountyRate> = {};
  const localities: LocalityRate[] = [];

  let currentCounty: string | null = null;
  let nycCombinedRate: number | null = null;
  let nycReportingCode: string | undefined;

  for (const record of records) {
    const rawLabel = record.label;
    if (/^New\s+York\s+State\s+only$/i.test(rawLabel)) {
      continue;
    }

    if (/^New\s+York\s+City$/i.test(rawLabel)) {
      nycCombinedRate = record.rate;
      nycReportingCode = record.reportingCode;
      continue;
    }

    if (/–\s*except$/i.test(rawLabel)) {
      const county = canonicalCountyName(rawLabel);
      counties[county] = {
        combined_rate_percent: record.percent,
        combined_rate: record.rate,
        reporting_code: record.reportingCode
      };
      currentCounty = county;
      continue;
    }

    const countyCandidate = canonicalCountyName(rawLabel);
    if (NY_COUNTIES.some((county) => normalizeName(county) === normalizeName(countyCandidate))) {
      counties[countyCandidate] = {
        combined_rate_percent: record.percent,
        combined_rate: record.rate,
        reporting_code: record.reportingCode
      };
      currentCounty = countyCandidate;
      continue;
    }

    if (!currentCounty) {
      continue;
    }

    localities.push({
      name: localityNameFromLabel(rawLabel),
      type: localityTypeFromLabel(rawLabel),
      county: currentCounty,
      combined_rate: record.rate,
      reporting_code: record.reportingCode
    });
  }

  if (!nycCombinedRate) {
    throw new Error('Failed to detect New York City combined rate from Publication 718');
  }

  for (const county of BOROUGH_COUNTIES) {
    counties[county] = {
      combined_rate_percent: nycCombinedRate * 100,
      combined_rate: nycCombinedRate,
      reporting_code: nycReportingCode,
      see_new_york_city: true
    };
  }

  // Ensure county key normalization remains stable for geometry joins.
  if (counties['St Lawrence']) {
    counties['St. Lawrence'] = counties['St Lawrence'];
    delete counties['St Lawrence'];
  }

  const missingCounties = NY_COUNTIES.filter((county) => !counties[county]);
  if (missingCounties.length > 0) {
    throw new Error(`Missing county rates for: ${missingCounties.join(', ')}`);
  }

  return {
    counties: Object.fromEntries(
      Object.entries(counties).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => [name, data])
    ),
    localities: localities
      .map((entry) => ({
        ...entry,
        county: canonicalCountyName(entry.county)
      }))
      .sort((a, b) => (a.county + a.name).localeCompare(b.county + b.name))
  };
}

async function main() {
  const pdfPathArg = process.argv[2];
  const { sourceUrl, data } = await readPdfBuffer(pdfPathArg);
  const text = await extractPdfText(data);

  const parsed = parseTaxTable(text);
  const output = {
    generated_at: new Date().toISOString(),
    source_url: sourceUrl,
    state_rate: 0.04,
    mctd_rate: 0.00375,
    counties: parsed.counties,
    localities: parsed.localities
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Generated ${OUTPUT_PATH}`);
  console.log(`Counties: ${Object.keys(output.counties).length}`);
  console.log(`Localities: ${output.localities.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
