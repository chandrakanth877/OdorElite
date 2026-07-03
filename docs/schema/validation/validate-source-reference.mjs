#!/usr/bin/env node
/**
 * Validates the claims in docs/schema/ against the real enriched-products.jsonl.
 *
 *   node validate-source-reference.mjs <path-to-enriched-products.jsonl>
 *   node validate-source-reference.mjs sample.jsonl --sample
 *
 * --sample skips the file-level count/rate expectations (they describe the real
 * 5,560-line file) and runs only structural checks + the field inventory.
 *
 * Exit code 1 on any failed expectation; every failure names the doc claim to fix.
 * Zero dependencies; Node >= 18.
 */
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const sampleMode = args.includes('--sample');
const inputPath = args.find((a) => !a.startsWith('--'));
if (!inputPath) {
  console.error('usage: node validate-source-reference.mjs <file.jsonl> [--sample]');
  process.exit(2);
}
const exp = JSON.parse(await readFile(join(here, 'expectations.json'), 'utf8'));

const isNA = (v) => typeof v === 'string' && v.trim().toUpperCase() === 'N/A';
const enrichmentEmpty = (e) =>
  e == null ||
  (typeof e === 'object' && Object.values(e).every((v) => v == null || v === '' || isNA(v)));

// ---- accumulators -----------------------------------------------------------
let totalLines = 0;
let parseErrors = 0;
const idLines = new Map(); // source.id -> [{ hasEnrichment }]
const genders = new Map();
const concentrations = new Map();
const sourceFields = new Set();
const variantFields = new Set();
const enrichedFields = new Set();
let withCompareAt = 0, availFalse = 0, zeroPrice = 0, imageless = 0;
let dupeTagged = 0, ygroupTagged = 0;
let oilNA = 0, awardsNA = 0, enrichedCount = 0;
let staleEmpty = 0;

const rl = createInterface({ input: createReadStream(inputPath), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  totalLines++;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    parseErrors++;
    continue;
  }
  const src = rec.source ?? {};
  const enr = rec.enriched ?? null;

  const empty = enrichmentEmpty(enr);
  if (empty) staleEmpty++;
  const id = src.id ?? rec.id;
  if (id != null) {
    if (!idLines.has(id)) idLines.set(id, []);
    idLines.get(id).push({ hasEnrichment: !empty });
  }

  for (const k of Object.keys(src)) sourceFields.add(k);
  for (const v of src.variants ?? []) for (const k of Object.keys(v)) variantFields.add(k);
  if (enr && typeof enr === 'object') for (const k of Object.keys(enr)) enrichedFields.add(k);

  const v0 = (src.variants ?? [])[0] ?? {};
  if (v0.compare_at_price != null && v0.compare_at_price !== '') withCompareAt++;
  if (v0.available === false) availFalse++;
  if (Number.parseFloat(v0.price ?? '0') === 0) zeroPrice++;
  if (!src.images || src.images.length === 0) imageless++;

  const tags = (src.tags ?? []).map(String);
  if (tags.some((t) => t.trim().toUpperCase() === 'DUPE')) dupeTagged++;
  if (tags.some((t) => t.startsWith('YGroup_'))) ygroupTagged++;

  if (enr && typeof enr === 'object' && !empty) {
    enrichedCount++;
    const g = enr.gender, c = enr.concentration;
    if (typeof g === 'string' && !isNA(g)) genders.set(g.trim().toLowerCase(), (genders.get(g.trim().toLowerCase()) ?? 0) + 1);
    if (typeof c === 'string' && !isNA(c)) concentrations.set(c.trim().toLowerCase(), (concentrations.get(c.trim().toLowerCase()) ?? 0) + 1);
    if (enr.oil_percentage == null || isNA(enr.oil_percentage)) oilNA++;
    if (enr.awards == null || isNA(enr.awards) || (Array.isArray(enr.awards) && enr.awards.length === 0)) awardsNA++;
  }
}

const duplicateRetryLines = [...idLines.values()].reduce((n, ls) => n + (ls.length - 1), 0);
const distinctIds = idLines.size;

// ---- checks -----------------------------------------------------------------
const results = [];
const check = (name, ok, actual, expected) =>
  results.push({ name, ok, actual: String(actual), expected: String(expected) });
const inRange = (name, actual, { min, max }) =>
  check(name, actual >= min && actual <= max, actual.toFixed(4), `${min}..${max}`);

check('lines parse as JSON', parseErrors === 0, `${parseErrors} errors`, '0 errors');

if (!sampleMode) {
  check('total lines [verified 5,560]', totalLines === exp.totalLines, totalLines, exp.totalLines);
  check('distinct source.id [verified 5,428]', distinctIds === exp.distinctSourceIds, distinctIds, exp.distinctSourceIds);
  check('duplicate retry lines [verified 132]', duplicateRetryLines === exp.duplicateRetryLines, duplicateRetryLines, exp.duplicateRetryLines);
  check('stale empty-enrichment lines [verified 126]', staleEmpty === exp.staleEmptyEnrichmentLines, staleEmpty, exp.staleEmptyEnrichmentLines);
  inRange('compare_at_price coverage [verified ~99.1%]', withCompareAt / totalLines, exp.rates.compareAtPriceCoverage);
  inRange('available:false rate [verified ~83%]', availFalse / totalLines, exp.rates.availableFalse);
  inRange('oil_percentage N/A rate [verified ~99%]', oilNA / Math.max(enrichedCount, 1), exp.rates.oilPercentageNA);
  inRange('awards N/A rate [verified ~95%]', awardsNA / Math.max(enrichedCount, 1), exp.rates.awardsNA);
  check('zero-price rows [verified 10]', zeroPrice === exp.counts.zeroPriceRows, zeroPrice, exp.counts.zeroPriceRows);
  check('imageless records [verified 135]', imageless === exp.counts.imagelessRecords, imageless, exp.counts.imagelessRecords);
  check('DUPE-tagged [verified 627]', dupeTagged === exp.counts.dupeTagged, dupeTagged, exp.counts.dupeTagged);
  check('YGroup-tagged [verified 61]', ygroupTagged === exp.counts.ygroupTagged, ygroupTagged, exp.counts.ygroupTagged);
  check('distinct concentration spellings [verified 47]', concentrations.size === exp.spellingCounts.concentrationDistinct, concentrations.size, exp.spellingCounts.concentrationDistinct);
  check('distinct gender spellings (~30)', genders.size <= exp.spellingCounts.genderDistinctMax, genders.size, `<= ${exp.spellingCounts.genderDistinctMax}`);
}

// spelling-map coverage (both modes): every observed spelling must be mapped
const mapped = (map) => new Set(Object.values(map).flat());
const unmappedOf = (observed, map) => [...observed.keys()].filter((s) => !mapped(map).has(s));
const unmappedGenders = unmappedOf(genders, exp.genderMap);
const unmappedConc = unmappedOf(concentrations, exp.concentrationMap);
check('gender spellings all mapped (enums.md)', unmappedGenders.length === 0, unmappedGenders.join(', ') || 'all mapped', 'all mapped');
check('concentration spellings all mapped (enums.md)', unmappedConc.length === 0, unmappedConc.join(', ') || 'all mapped', 'all mapped');

// field inventory (both modes): undocumented fields must be added to the mapping matrix
const undocumented = (observed, known) => [...observed].filter((f) => !known.includes(f));
const unSrc = undocumented(sourceFields, exp.knownSourceFields);
const unVar = undocumented(variantFields, exp.knownVariantFields);
const unEnr = undocumented(enrichedFields, exp.knownEnrichedFields);
check('source fields documented (source-to-schema-mapping.md)', unSrc.length === 0, unSrc.join(', ') || 'all documented', 'all documented');
check('variant fields documented', unVar.length === 0, unVar.join(', ') || 'all documented', 'all documented');
check('enriched fields documented (43 expected)', unEnr.length === 0, unEnr.join(', ') || 'all documented', 'all documented');

// ---- report -----------------------------------------------------------------
const width = Math.max(...results.map((r) => r.name.length));
console.log(`\nvalidate-source-reference — ${inputPath}${sampleMode ? ' (sample mode)' : ''}`);
console.log(`records: ${totalLines} lines, ${distinctIds} distinct ids, ${enrichedCount} with enrichment\n`);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(width)}  actual: ${r.actual}${r.ok ? '' : `  expected: ${r.expected}`}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Each FAIL names the doc claim to correct (file referenced in the check name).');
  process.exit(1);
}
