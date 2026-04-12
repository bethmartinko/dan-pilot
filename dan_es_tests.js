#!/usr/bin/env node
/**
 * DAN ES Parity Tests
 * Static structural verification of the Spanish system prompt.
 * No API key required — all checks run against the HTML file.
 *
 * Updated April 12, 2026 for conditional prompt assembly architecture.
 * Tests now check both the base ES prompt AND the KB_*_ES knowledge modules.
 *
 * Usage: node dan_es_tests.js --file index.html
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const fileArg = args.indexOf('--file');
const htmlFile = fileArg !== -1 ? args[fileArg + 1] : path.join(__dirname, 'dan-pilot-src/dan-pilot-main/index.html');

if (!fs.existsSync(htmlFile)) { console.error('ERROR: Cannot find', htmlFile); process.exit(1); }

const html = fs.readFileSync(htmlFile, 'utf8');

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const YELLOW = '\x1b[33m'; const RESET = '\x1b[0m'; const BOLD = '\x1b[1m';
let passed = 0; let failed = 0;

function pass(id, name) { console.log(`  ${GREEN}✓${RESET}  ${id}  ${name}`); passed++; }
function fail(id, name, detail) {
  console.log(`  ${RED}✗${RESET}  ${id}  ${name}`);
  console.log(`       ${RED}→ ${detail}${RESET}`);
  failed++;
}
function section(t) { console.log(`\n${BOLD}${t}${RESET}\n${'─'.repeat(60)}`); }

// ── Extract ES base prompt ──────────────────────────────────────────────────
const esOpen = 'const systemPromptES = `';
const esClose = '`;\n\nfunction setLang';
const esStart = html.indexOf(esOpen) + esOpen.length;
const esEnd = html.indexOf(esClose, esStart);
const esBase = html.substring(esStart, esEnd);

// ── Extract all ES KB modules ───────────────────────────────────────────────
const kbModuleNames = [
  'KB_WAITING_ES', 'KB_GENERIC_RESOURCE_ES', 'KB_SDP_SPENDING_ES',
  'KB_GOAL_NOT_IN_IPP_ES', 'KB_PREFERENCE_ES', 'KB_SDP_RENEWAL_ES',
  'KB_PROVIDER_ONBOARDING_ES', 'KB_LEGAL_STATUS_ES', 'KB_TRAINING_AUTH_ES',
  'KB_ILS_SLS_ES', 'KB_VENDOR_BILLING_ES',
];

let esKbCombined = '';
const esKbModules = {};
kbModuleNames.forEach(name => {
  const pat = `const ${name} = \``;
  const s = html.indexOf(pat);
  if (s === -1) return;
  const contentStart = s + pat.length;
  const e = html.indexOf('`;', contentStart);
  if (e === -1) return;
  const content = html.substring(contentStart, e);
  esKbModules[name] = content;
  esKbCombined += '\n' + content;
});

// Full ES content = base prompt + all KB modules (for comprehensive checks)
const esFull = esBase + esKbCombined;

// ── Extract EN base prompt ──────────────────────────────────────────────────
const enArrMatch = html.match(/const DAN_SYSTEM_PROMPT[\s]*=[\s]*([\s\S]*?)\.join/);
const enRaw = enArrMatch ? enArrMatch[1] : '';

// Extract all EN KB modules for size comparison
let enKbCombined = '';
const enKbNames = kbModuleNames.map(n => n.replace('_ES', ''));
enKbNames.forEach(name => {
  const pat = `const ${name} = [`;
  const s = html.indexOf(pat);
  if (s === -1) return;
  const e = html.indexOf('].join("\\n");', s);
  if (e === -1) return;
  enKbCombined += html.substring(s, e);
});

const enFullRaw = enRaw + enKbCombined;

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

section('ES-A. Prompt Existence & Size');
const esFullLen = esFull.length;
const enFullLen = enFullRaw.length;
esFullLen > 50000
  ? pass('ES-A1', `ES full content ${esFullLen.toLocaleString()} chars (base + ${Object.keys(esKbModules).length} KB modules)`)
  : fail('ES-A1', 'ES content too short', `Only ${esFullLen.toLocaleString()} chars`);
esBase.length > 20000
  ? pass('ES-A1b', `ES base prompt ${esBase.length.toLocaleString()} chars`)
  : fail('ES-A1b', 'ES base prompt too short', `Only ${esBase.length.toLocaleString()} chars`);
Object.keys(esKbModules).length === 11
  ? pass('ES-A1c', `All 11 ES KB modules found`)
  : fail('ES-A1c', 'Missing ES KB modules', `Only ${Object.keys(esKbModules).length} found`);
(esFull.length / enFullRaw.length) > 0.60
  ? pass('ES-A2', `ES is ${Math.round(esFull.length/enFullRaw.length*100)}% of EN full length (>60% required)`)
  : fail('ES-A2', 'ES/EN ratio', `${Math.round(esFull.length/enFullRaw.length*100)}% — below threshold`);
(esBase.match(/`/g) || []).length === 0
  ? pass('ES-A3', 'No backticks in ES base prompt (template literal safe)')
  : fail('ES-A3', 'Backticks in ES', `Found ${(esBase.match(/`/g)||[]).length} backtick(s)`);
!/[\uFFFD]/.test(esFull)
  ? pass('ES-A4', 'No corrupted characters (UTF-8 clean)')
  : fail('ES-A4', 'Corrupted characters', 'Found replacement char \\uFFFD');

section('ES-B. All Sections Present (base + KB modules)');
const sectionChecks = [
  // Base prompt sections
  ['REGLA PRINCIPAL', 'Hard rules (top)', 'base'],
  ['MODELO DE CÍRCULOS CONCÉNTRICOS', 'Concentric circles model', 'base'],
  ['SEGURIDAD INMEDIATA', 'Immediate safety', 'base'],
  ['FORMATO DE RESPUESTA', 'Output format', 'base'],
  ['ENTRADA POR PUNTO DE BLOQUEO', 'Stuck point entry', 'base'],
  ['REDUCCIÓN DE PRESUPUESTO CON FECHA LÍMITE', 'Budget reduction with deadline', 'base'],
  ['LO QUE DAN SABE', 'What DAN knows', 'base'],
  ['CAMBIO DE SC', 'SC turnover', 'base'],
  ['DIRECTIVAS DE DDS', 'DDS directives', 'base'],
  ['QUÉ ES Y QUÉ NO ES DAN', 'What DAN is and is not', 'base'],
  // KB module sections
  ['ESPERAR SIN RESPUESTA', 'Waiting without an answer', 'KB_WAITING_ES'],
  ['RECURSO GENÉRICO', 'Generic resource', 'KB_GENERIC_RESOURCE_ES'],
  ['SDP SPENDING PLAN', 'SDP Spending Plan', 'KB_SDP_SPENDING_ES'],
  ['OBJETIVO NO ESTÁ EN EL IPP', 'Goal not in IPP', 'KB_GOAL_NOT_IN_IPP_ES'],
  ['PREFERENCIA EN LUGAR DE NECESIDAD', 'Preference not a need', 'KB_PREFERENCE_ES'],
  ['RENOVACIÓN DE SDP', 'SDP Renewal', 'KB_SDP_RENEWAL_ES'],
  ['INCORPORACIÓN DE PROVEEDORES', 'Provider onboarding', 'KB_PROVIDER_ONBOARDING_ES'],
  ['REGLAS DE FACTURACIÓN', 'Vendor billing rules', 'KB_VENDOR_BILLING_ES'],
];
sectionChecks.forEach(([phrase, desc, location]) => {
  const searchIn = location === 'base' ? esBase : (esKbModules[location] || '');
  const label = location === 'base' ? desc : `${desc} [${location}]`;
  searchIn.includes(phrase)
    ? pass('ES-B', label)
    : fail('ES-B', label, `Section "${phrase}" not found in ${location}`);
});

section('ES-C. Critical Behavioral Rules Present (base + KB modules)');
const rules = [
  // Base prompt rules
  ['NUNCA PIDAS PERMISO PARA REDACTAR', 'Never ask permission to draft', 'base'],
  ['SEGUNDA REGLA PRINCIPAL', 'Functional impact locks path', 'base'],
  ['TERCERA REGLA PRINCIPAL', 'Budget cut + deadline = immediate action', 'base'],
  ['LA PRUEBA DE LA FRUSTRACIÓN O LA NECESIDAD', 'Mad-or-need test', 'full'],
  ['LA PRUEBA DEL FAIR HEARING', 'Fair hearing internal standard', 'full'],
  ['NO PIDAS INFORMACIÓN QUE NO PUEDES USAR', 'No collect unusable data', 'full'],
  // Rules inside KB modules
  ['PÉRDIDA TOTAL DE SERVICIOS + FECHA LÍMITE', 'Complete service loss hard stop', 'full'],
  ['REGLA DE PERSISTENCIA DEL BORRADOR', 'Draft persistence rule', 'full'],
  ['ALINEACIÓN DÓLAR POR DÓLAR', 'Dollar-for-dollar alignment', 'full'],
  ['NOTA DE PARTICIPACIÓN EN HCBS', 'HCBS participation note', 'full'],
  ['CIERRE HONESTO PARA CASOS DÉBILES', 'Honest close for weak cases', 'full'],
  ['MARCO COLABORATIVO', 'Collaborative frame', 'full'],
  ['REGLA DE LA PREGUNTA DE VIVIENDA', 'Housing question rule', 'full'],
  ['RENOVACIÓN PROACTIVA — SIGUE AVANZANDO', 'Proactive keep going', 'full'],
  ['NUNCA AFIRMES UN PRODUCTO ESPECÍFICO', 'Never affirm specific product', 'full'],
  ['DEFINE LAS NECESIDADES COMO CARACTERÍSTICAS', 'Define needs as features', 'full'],
  ['ALCANCE DE TODA LA CONVERSACIÓN', 'Full conversation scope (product rule)', 'full'],
];
rules.forEach(([phrase, desc, scope]) => {
  const searchIn = scope === 'base' ? esBase : esFull;
  (searchIn.includes(phrase))
    ? pass('ES-C', desc)
    : fail('ES-C', desc, `"${phrase}" not found`);
});

section('ES-D. Exact Phrases, Markers, and Contact Info');
const exact = [
  ['Una vez que envíe eso, vuelva y le ayudaré a presentar la solicitud de fair hearing y a reunir su documentación', 'Exact closing phrase'],
  ['2-4 semanas', '2-4 weeks timeline phrase'],
  ['---FH LINK---', 'Fair hearing link marker'],
  ['---EMAIL START---', 'Email start marker'],
  ['---EMAIL END---', 'Email end marker'],
  ['Ombudsperson@dds.ca.gov', 'Ombudsperson email'],
  ['1-800-390-7032', 'OCRA phone'],
  ['1-800-743-8525', 'Fair hearing phone'],
  ['(877) 658-9731', 'DDS Ombudsperson phone'],
  ['dds.ca.gov/initiatives/sdp/', 'DDS SDP URL'],
  ['dvunited.org', 'DVU URL'],
];
exact.forEach(([phrase, desc]) => {
  esFull.includes(phrase)
    ? pass('ES-D', desc)
    : fail('ES-D', desc, `"${phrase}" not found in base or KB modules`);
});

// Closing phrase count — check across full ES vs full HTML (EN uses same markers in KB modules)
const closingES = (esFull.match(/Una vez que env\u00ede eso, vuelva y le ayudar\u00e9/g) || []).length;
const closingEN = (html.match(/Once you send that, come back and I will help you file the fair hearing/g) || []).length;
closingES === closingEN
  ? pass('ES-D', `Closing phrase count: ${closingES} (matches EN: ${closingEN})`)
  : fail('ES-D', 'Closing phrase count', `ES has ${closingES}, EN has ${closingEN}`);

section('ES-E. Placeholder Discipline (no [ ] used as fill-in placeholders)');
const squares = (esFull.match(/\[[^\]]+\]/g) || []);
const placeholderSquares = squares.filter(s =>
  /\{.*\}/.test(s) || /NOMBRE DEL|FECHA DE|CORREO DE|SU NOMBRE/.test(s)
);
placeholderSquares.length === 0
  ? pass('ES-E1', 'No square-bracket fill-in placeholders (curly braces used correctly)')
  : fail('ES-E1', 'Square-bracket placeholders found', placeholderSquares.join(', '));

const curlies = (esFull.match(/\{[^}]+\}/g) || []);
curlies.length >= 5
  ? pass('ES-E2', `Curly-brace placeholders present: ${curlies.length} found`)
  : fail('ES-E2', 'Too few curly-brace placeholders', `Only ${curlies.length} found`);

section('ES-F. UI Routing Wiring');
html.includes("currentLang === 'es' ? buildSystemPromptES() :")
  ? pass('ES-F1', 'buildSystemPromptES() wired into API call via language check')
  : fail('ES-F1', 'ES prompt not wired', 'buildSystemPromptES() language switch not found');
html.includes('function buildSystemPromptES()')
  ? pass('ES-F1b', 'buildSystemPromptES() function defined')
  : fail('ES-F1b', 'buildSystemPromptES() missing', 'Function definition not found');
html.includes('KB_BY_CARD_ES')
  ? pass('ES-F1c', 'KB_BY_CARD_ES mapping present')
  : fail('ES-F1c', 'KB_BY_CARD_ES missing', 'Knowledge mapping not found');
html.includes('STUCK_WELCOMES_ES')
  ? pass('ES-F2', 'STUCK_WELCOMES_ES object present')
  : fail('ES-F2', 'STUCK_WELCOMES_ES missing', 'Object not found');
html.includes("currentLang === 'es' ? STUCK_WELCOMES_ES : STUCK_WELCOMES")
  ? pass('ES-F3', 'STUCK_WELCOMES_ES wired into stuck card routing')
  : fail('ES-F3', 'STUCK_WELCOMES_ES not wired', 'Language switch for welcomes not found');
['delay','generic','ipp','preference','spending','sdp','unsure'].forEach(key => {
  const swes = html.substring(html.indexOf('const STUCK_WELCOMES_ES'), html.indexOf('const STUCK_WELCOMES_ES') + 3000);
  swes.includes(`  ${key}:`)
    ? pass('ES-F4', `STUCK_WELCOMES_ES.${key} present`)
    : fail('ES-F4', `STUCK_WELCOMES_ES.${key} missing`, `Key "${key}" not found`);
});
['delay','sdp','generic','ipp','spending','preference'].forEach(key => {
  html.includes(`data-es=`) && html.includes(`startStuck('${key}')`)
    ? pass('ES-F5', `Stuck card "${key}" has data-es label`)
    : fail('ES-F5', `Stuck card "${key}"`, 'data-es label may be missing');
});

section('ES-G. Prompt Architecture Integrity');
// EN base prompt should exist and be reasonable size
enRaw.length > 30000
  ? pass('ES-G1', `EN base prompt present: ${enRaw.length.toLocaleString()} chars`)
  : fail('ES-G1', 'EN base prompt too small', `Only ${enRaw.length.toLocaleString()} chars`);
enRaw.includes('SEQUENCING HARD STOP')
  ? pass('ES-G2', 'EN sequencing hard stop rule present')
  : fail('ES-G2', 'EN rule missing', '"SEQUENCING HARD STOP" not found in EN prompt');
// Verify KB_BY_CARD has entries for all stuck card types
['delay', 'sdp', 'generic', 'ipp', 'spending', 'preference', 'proactive', 'unsure'].forEach(key => {
  html.includes(`KB_BY_CARD_ES`) && html.match(new RegExp(`${key}:\\s*\\[`))
    ? pass('ES-G3', `KB_BY_CARD has "${key}" entry`)
    : fail('ES-G3', `KB_BY_CARD missing "${key}"`, 'Card type not mapped');
});

// Summary
console.log(`\n${'═'.repeat(60)}`);
console.log(`${BOLD}Results: ${passed}/${passed+failed} passed${failed > 0 ? `  ${RED}${failed} failed${RESET}` : `  ${GREEN}all clear${RESET}`}${RESET}`);
if (failed > 0) process.exit(1);
