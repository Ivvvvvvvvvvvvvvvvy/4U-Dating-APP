import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privateModules = new Set([
  path.join(root, 'src/profileSchema.ts'),
  path.join(root, 'src/syntheticProfiles.ts'),
]);
const extensions = ['', '.ts', '.tsx', '.js', '.jsx'];
const imports = /(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
const resolveLocal = (owner, specifier) => {
  if (!specifier.startsWith('.')) return undefined;
  const base = path.resolve(path.dirname(owner), specifier);
  return extensions
    .flatMap((extension) => [base + extension, path.join(base, 'index' + extension)])
    .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
};

const entry = path.join(root, 'src/main.tsx');
const visited = new Set();
const pending = [entry];
while (pending.length > 0) {
  const file = pending.pop();
  if (!file || visited.has(file)) continue;
  visited.add(file);
  assert.equal(privateModules.has(file), false, `Client import graph reaches private module ${path.relative(root, file)}`);
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(imports)) {
    const resolved = resolveLocal(file, match[1]);
    if (resolved) pending.push(resolved);
  }
}

const privateKeys = [
  'birthDate',
  'candidatePreferences',
  'desiredGenders',
  'acceptedRelationshipGoals',
];
const javascript = fs.readdirSync(path.join(root, 'dist/assets'))
  .filter((name) => name.endsWith('.js'))
  .map((name) => fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8'))
  .join('\n');
const leakedKeys = privateKeys.filter((key) => javascript.includes(key));
assert.deepEqual(leakedKeys, [], `Production JavaScript contains private profile keys: ${leakedKeys.join(', ')}`);

console.log(JSON.stringify({ ok: true, clientModules: visited.size, privateKeys: 'absent' }));
