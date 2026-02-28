
import { isWithinNY, findCounty, calculateNYTax } from './src/taxService.ts';

const lat = 44.4490;
const lon = -73.3388;
const subtotal = 100;

console.log(`Checking coordinates: ${lat}, ${lon}`);
const inNY = isWithinNY(lat, lon);
console.log(`Is within NY: ${inNY}`);

if (inNY) {
  const county = findCounty(lat, lon);
  console.log(`County found: ${county ?? 'unknown'}`);
  const tax = calculateNYTax(lat, lon, subtotal);
  console.log('Tax Calculation for $100:');
  console.log(JSON.stringify(tax, null, 2));
} else {
  console.log('Point is outside NY State.');
}
