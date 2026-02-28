import { calculateNYTax, findCounty, isWithinNY } from '../src/taxService.ts';

const checks = [
  { label: 'NYC (Lower Manhattan)', lat: 40.7128, lon: -74.006, subtotal: 100 },
  { label: 'Buffalo', lat: 42.8864, lon: -78.8784, subtotal: 100 },
  { label: 'Albany', lat: 42.6526, lon: -73.7562, subtotal: 100 }
];

for (const check of checks) {
  const inNy = isWithinNY(check.lat, check.lon);
  const county = findCounty(check.lat, check.lon);

  if (!inNy || !county) {
    console.log(`${check.label}: outside NY or county unresolved`);
    continue;
  }

  const tax = calculateNYTax(check.lat, check.lon, check.subtotal);
  const specialTotal = tax.breakdown.special_rates.reduce((sum, item) => sum + item.rate, 0);
  const reconstructed = tax.breakdown.state_rate + tax.breakdown.county_rate + tax.breakdown.city_rate + specialTotal;

  console.log(`${check.label}`);
  console.log(`  county=${county}`);
  console.log(`  composite=${tax.composite_tax_rate.toFixed(6)} reconstructed=${reconstructed.toFixed(6)}`);
  console.log(`  jurisdictions=${tax.jurisdictions.join(' | ')}`);
  console.log(`  tax_amount=$${tax.tax_amount.toFixed(2)} total=$${tax.total_amount.toFixed(2)}`);

  const drift = Math.abs(tax.composite_tax_rate - reconstructed);
  if (drift > 0.000001) {
    throw new Error(`Composite mismatch for ${check.label} (drift=${drift})`);
  }
}

console.log('Smoke check completed.');
