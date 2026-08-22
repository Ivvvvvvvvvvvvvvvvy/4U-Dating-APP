import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({
  root,
  appType: 'custom',
  logLevel: 'silent',
  server: { middlewareMode: true },
});

try {
  const [profilesModule, schemaModule, publicDataModule] = await Promise.all([
    server.ssrLoadModule('/src/syntheticProfiles.ts'),
    server.ssrLoadModule('/src/profileSchema.ts'),
    server.ssrLoadModule('/src/syntheticPublicData.ts'),
  ]);

  const exportedSchemaConstants = Object.fromEntries(
    Object.entries(schemaModule).filter(([, value]) =>
      Array.isArray(value) || (value !== null && typeof value === 'object'),
    ),
  );
  const records = profilesModule.syntheticUserRecords;
  if (!Array.isArray(records)) {
    throw new TypeError('syntheticUserRecords must be an array');
  }

  const sensitiveFieldNames = [
    'ethnicity', 'race', 'religion', 'politicalViews',
    'sexualOrientation', 'medicalHistory', 'healthStatus', 'disability',
  ];
  const sensitiveKeyProbes = sensitiveFieldNames.flatMap((canonical) => {
    const words = canonical.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ');
    const snakeCase = words.length > 1
      ? words.join('_').toLowerCase()
      : [...canonical].join('_');
    const kebabCase = words.length > 1
      ? words.join('-').toLowerCase()
      : [...canonical].join('-');
    return [...new Set([
      canonical,
      canonical.toUpperCase(),
      words.map((word) => word[0].toUpperCase() + word.slice(1)).join(''),
      snakeCase,
      kebabCase,
    ])].map((variant) => ({ canonical, variant }));
  });
  const schemaSensitiveKeyProbeResults = sensitiveKeyProbes.map(({ canonical, variant }) => {
    const fixture = { ...records[0], [variant]: 'must be rejected' };
    return {
      canonical,
      variant,
      scannerPaths: schemaModule.findProhibitedSyntheticFieldPaths({ probe: {
        [variant]: true,
      } }),
      validationPaths: schemaModule.validateSyntheticUserRecord(fixture).issues
        .filter((issue) => issue.code === 'PROHIBITED_FIELD')
        .map((issue) => issue.path),
    };
  });
  const schemaSensitiveKeyAllowedProbePaths = schemaModule.findProhibitedSyntheticFieldPaths({
    healthcareIndustry: 'HEALTHCARE',
    candidateLocation: 'Shanghai',
    contactPreference: 'in-app only',
  });

  const publicProfileProjections = records.map((record) =>
    schemaModule.projectPublicProfile(record),
  );
  const schemaValidationResults = records.map((record) =>
    schemaModule.validateSyntheticUserRecord(record),
  );
  const schemaMutualCandidateIds = Object.fromEntries(
    records.map((left) => [
      left.person.id,
      records
        .filter(
          (right) =>
            right.person.id !== left.person.id &&
            schemaModule.evaluateCandidateFeasibility(left, right).eligible,
        )
        .map((right) => right.person.id),
    ]),
  );
  const generatorMutualCandidateIds =
    typeof profilesModule.getMutualCandidateIds === 'function'
      ? Object.fromEntries(
          records.map((record) => [
            record.person.id,
            [...profilesModule.getMutualCandidateIds(record.person.id)],
          ]),
        )
      : null;

  process.stdout.write(JSON.stringify({
    syntheticUserRecords: records,
    syntheticProfiles: profilesModule.syntheticProfiles,
    syntheticPeople: profilesModule.syntheticPeople,
    syntheticPersonFeedCards: profilesModule.syntheticPersonFeedCards,
    publicFixturePeople: publicDataModule.syntheticPeople,
    publicFixtureCards: publicDataModule.syntheticPersonFeedCards,
    syntheticCoverageReport: profilesModule.syntheticCoverageReport,
    publicProfileProjections,
    schemaValidationResults,
    schemaMutualCandidateIds,
    generatorMutualCandidateIds,
    schemaSensitiveKeyProbeResults,
    schemaSensitiveKeyAllowedProbePaths,
    schemaConstants: exportedSchemaConstants,
  }));
} finally {
  await server.close();
}
