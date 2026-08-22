import fs from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'src/syntheticPublicData.ts');
const server = await createServer({
  root,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

const serialize = (value) => JSON.stringify(value);

try {
  const profiles = await server.ssrLoadModule('/src/syntheticProfiles.ts');
  const people = profiles.syntheticPeople;
  const cards = profiles.syntheticPersonFeedCards;
  if (!Array.isArray(people) || !Array.isArray(cards)) {
    throw new TypeError('Synthetic public people and cards must be arrays.');
  }

  const source = `/**
 * Generated public-only synthetic fixture.
 *
 * Do not import the private generator from client code. Regenerate this file
 * with npm run generate:profiles-public after changing profile fixtures.
 */
import type { Person, PersonFeedCard } from './domain';

export const syntheticPeople = ${serialize(people)} as unknown as readonly Person[];

export const syntheticPersonFeedCards = ${serialize(cards)} as unknown as readonly PersonFeedCard[];
`;
  await fs.writeFile(outputPath, source);
  process.stdout.write(`Wrote ${path.relative(root, outputPath)} with ${people.length} people and ${cards.length} cards.\n`);
} finally {
  await server.close();
}
