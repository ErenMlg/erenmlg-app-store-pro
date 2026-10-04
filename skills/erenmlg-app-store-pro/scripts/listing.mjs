#!/usr/bin/env node
/*
Validate a store listing and write it as Markdown and plain text.

Usage:
    node listing.mjs store/listing.json

Writes listing.md and listing.txt next to the JSON; listing-en.json becomes
listing-en.md and listing-en.txt, so keep one JSON per language. If any field
is over its store limit, nothing is written and the script exits 1, so
over-long copy never reaches App Store Connect or the Play Console.

listing.json (either store section may be left out):
    {
      "locale": "tr",
      "apple": {
        "name": "...", "subtitle": "...", "promotional_text": "...",
        "description": "...", "keywords": "comma,separated,no,spaces",
        "category": { "primary": "Finance", "secondary": "Productivity" },
        "age_rating": { "result": "4+", "answers": { "Advertising": "No" } },
        "app_id": {                       Certificates, Identifiers & Profiles → Register an App ID
          "description": "Monysa",        no @ & * "
          "bundle_id": "com.example.app", explicit, reverse-domain, no *
          "capabilities": [ { "name": "Sign In with Apple", "why": "sign_in_with_apple in pubspec" } ],
          "app_services": [],             e.g. WeatherKit, MusicKit, ShazamKit
          "capability_requests": []       capabilities Apple must approve first
        }
      },
      "google": { "name": "...", "short_description": "...", "full_description": "...",
                  "package": "com.example.app" }    applicationId; fixed forever once uploaded
    }

Lengths are counted in characters (Unicode code points), as both consoles do.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// [key, label, limit, required]
const FIELDS = {
  apple: [
    ['name', 'Name', 30, true],
    ['subtitle', 'Subtitle', 30, false],
    ['promotional_text', 'Promotional Text', 170, false],
    ['description', 'Description', 4000, true],
    ['keywords', 'Keywords', 100, true],
  ],
  google: [
    ['name', 'App name', 30, true],
    ['short_description', 'Short description', 80, true],
    ['full_description', 'Full description', 4000, true],
  ],
};
const STORE = { apple: 'App Store', google: 'Google Play' };
// Multi-line or long fields go in fenced blocks in the Markdown so line breaks survive.
const BLOCK = new Set(['promotional_text', 'description', 'keywords', 'full_description']);
// Apple's tiers since the 2025 update; the old 12+ and 17+ no longer exist.
const AGE_RATINGS = new Set(['4+', '9+', '13+', '16+', '18+']);
const CATEGORIES = new Set(['Books', 'Business', 'Developer Tools', 'Education', 'Entertainment', 'Finance',
  'Food & Drink', 'Games', 'Graphics & Design', 'Health & Fitness', 'Kids', 'Lifestyle', 'Magazines & Newspapers',
  'Medical', 'Music', 'Navigation', 'News', 'Photo & Video', 'Productivity', 'Reference', 'Shopping',
  'Social Networking', 'Sports', 'Travel', 'Utilities', 'Weather']);

const len = text => [...text].length;
// Reverse-domain identifiers. Android segments start with a letter and may use underscores;
// Apple bundle IDs allow letters, digits, hyphens and dots, and an explicit one has no *.
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const APP_ID_LISTS = [['capabilities', 'Capabilities'], ['app_services', 'App Services'], ['capability_requests', 'Capability Requests']];

function check(listing) {
  const errors = [], warnings = [], lengths = [];
  if (!listing.apple && !listing.google) errors.push('the listing has neither an "apple" nor a "google" section');
  for (const [store, fields] of Object.entries(FIELDS)) {
    const section = listing[store];
    if (!section) continue;
    for (const [key, label, limit, required] of fields) {
      const value = section[key];
      const name = `${STORE[store]} ${label}`;
      if (value === undefined || value === '') {
        if (required) errors.push(`${name} is missing`);
        continue;
      }
      if (typeof value !== 'string') {
        errors.push(`${name} must be a string`);
        continue;
      }
      lengths.push(`${name}: ${len(value)}/${limit}`);
      if (len(value) > limit) errors.push(`${name} is ${len(value)} characters, the limit is ${limit}`);
    }
  }
  const apple = listing.apple || {};
  if (typeof apple.keywords === 'string' && /,\s/.test(apple.keywords)) {
    warnings.push('Keywords have spaces after commas; every space uses one of the 100 characters');
  }
  for (const which of ['primary', 'secondary']) {
    const category = apple.category?.[which];
    if (category && !CATEGORIES.has(category)) warnings.push(`${which} category "${category}" is not an App Store category name; check the spelling`);
  }
  if (apple.age_rating && !AGE_RATINGS.has(apple.age_rating.result)) {
    errors.push(`age rating "${apple.age_rating.result}" is not one of ${[...AGE_RATINGS].join(', ')}`);
  }
  if (listing.google) {
    const pkg = listing.google.package;
    if (!pkg) errors.push('Google Play package name is missing (the applicationId in build.gradle)');
    else if (!PACKAGE.test(pkg)) errors.push(`Google Play package name "${pkg}" is not a valid applicationId`);
  }
  if (listing.apple) {
    const id = apple.app_id;
    if (!id) errors.push('App Store app_id is missing (description, bundle_id, capabilities)');
    else {
      if (!id.bundle_id) errors.push('App Store bundle_id is missing (PRODUCT_BUNDLE_IDENTIFIER)');
      else if (!BUNDLE_ID.test(id.bundle_id)) errors.push(`App Store bundle_id "${id.bundle_id}" must be an explicit reverse-domain ID: letters, digits, hyphens, dots, no *`);
      if (!id.description) errors.push('App Store app_id description is missing');
      else if (/[@&*"]/.test(id.description)) errors.push(`App Store app_id description "${id.description}" may not contain @ & * "`);
      for (const [key, label] of APP_ID_LISTS) {
        for (const item of id[key] || []) {
          if (!item?.name || !item?.why) errors.push(`every ${label} entry needs a "name" and the "why" that justifies it`);
        }
      }
    }
  }
  return { errors, warnings, lengths };
}

function toMarkdown(listing) {
  const title = listing.apple?.name || listing.google?.name;
  const out = [`# ${title} — store listing${listing.locale ? ` (${listing.locale})` : ''}`, ''];
  const id = listing.apple?.app_id;
  if (listing.google?.package || id) {
    out.push('## Identifiers', '');
    if (listing.google?.package) out.push(`- **Google Play package name:** \`${listing.google.package}\``);
    if (id) {
      out.push(`- **App Store bundle ID (explicit):** \`${id.bundle_id}\``, `- **App ID description:** ${id.description}`, '');
      for (const [key, label] of APP_ID_LISTS) {
        const items = id[key] || [];
        out.push(`### App ID — ${label}`, '');
        if (!items.length) out.push('None.', '');
        else out.push('| Enable | Why |', '|---|---|', ...items.map(item => `| ${item.name} | ${item.why} |`), '');
      }
    }
  }
  for (const [store, fields] of Object.entries(FIELDS)) {
    const section = listing[store];
    if (!section) continue;
    out.push(`## ${STORE[store]}`, '', '| Field | Length | Limit |', '|---|---|---|');
    for (const [key, label, limit] of fields) if (section[key]) out.push(`| ${label} | ${len(section[key])} | ${limit} |`);
    out.push('');
    for (const [key, label] of fields) {
      if (!section[key]) continue;
      out.push(`### ${label}`, '', BLOCK.has(key) ? `\`\`\`text\n${section[key]}\n\`\`\`` : section[key], '');
    }
    if (section.category) {
      out.push('### Category', '', `- Primary: ${section.category.primary}`);
      if (section.category.secondary) out.push(`- Secondary: ${section.category.secondary}`);
      out.push('');
    }
    if (section.age_rating) {
      out.push(`### Age rating — ${section.age_rating.result}`, '', '| Question | Answer |', '|---|---|');
      for (const [question, answer] of Object.entries(section.age_rating.answers || {})) out.push(`| ${question} | ${answer} |`);
      out.push('');
    }
  }
  return out.join('\n');
}

function toText(listing) {
  const out = [];
  const id = listing.apple?.app_id;
  if (listing.google?.package || id) {
    out.push('===== IDENTIFIERS =====', '');
    if (listing.google?.package) out.push(`[Google Play package name] ${listing.google.package}`);
    if (id) {
      out.push(`[App Store bundle ID] ${id.bundle_id}`, `[App ID description] ${id.description}`);
      for (const [key, label] of APP_ID_LISTS) {
        const items = id[key] || [];
        out.push(`[${label}] ${items.length ? items.map(item => item.name).join(', ') : 'none'}`);
      }
    }
    out.push('');
  }
  for (const [store, fields] of Object.entries(FIELDS)) {
    const section = listing[store];
    if (!section) continue;
    out.push(`===== ${STORE[store].toUpperCase()} =====`, '');
    for (const [key, label, limit] of fields) if (section[key]) out.push(`[${label}] (${len(section[key])}/${limit})`, section[key], '');
    if (section.category) {
      out.push('[Category]', `Primary: ${section.category.primary}`);
      if (section.category.secondary) out.push(`Secondary: ${section.category.secondary}`);
      out.push('');
    }
    if (section.age_rating) {
      out.push(`[Age Rating] ${section.age_rating.result}`);
      for (const [question, answer] of Object.entries(section.age_rating.answers || {})) out.push(`${question}: ${answer}`);
      out.push('');
    }
  }
  return out.join('\n');
}

function main() {
  const arg = process.argv[2];
  if (!arg || arg === '-h' || arg === '--help') {
    const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8');
    console.log(source.slice(source.indexOf('/*') + 3, source.indexOf('*/')).trim());
    process.exit(arg ? 0 : 1);
  }
  const file = path.resolve(arg);
  const listing = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { errors, warnings, lengths } = check(listing);
  for (const line of lengths) console.log(line);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`error: ${error}`);
    process.exit(1);
  }
  const base = file.replace(/\.json$/i, '');
  fs.writeFileSync(`${base}.md`, toMarkdown(listing));
  fs.writeFileSync(`${base}.txt`, toText(listing));
  console.log(`wrote ${path.basename(base)}.md and ${path.basename(base)}.txt`);
}

main();
