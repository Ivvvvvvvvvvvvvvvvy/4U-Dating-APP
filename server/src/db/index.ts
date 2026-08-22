import { BlockRepository } from './blocks.js';
import { ConsentRepository } from './consents.js';
import { EventStore } from './events.js';
import { HealthRepository } from './health.js';
import type { Database } from './pool.js';
import { ProfileRepository } from './profiles.js';
import { RecommendationRepository } from './recommendations.js';
import { RelationshipRepository } from './relationships.js';

export * from './blocks.js';
export * from './consents.js';
export * from './errors.js';
export * from './events.js';
export * from './health.js';
export * from './migrate.js';
export * from './pool.js';
export * from './profiles.js';
export * from './recommendations.js';
export * from './relationships.js';

export function createRepositories(database: Database) {
  return {
    events: new EventStore(database),
    blocks: new BlockRepository(database),
    profiles: new ProfileRepository(database),
    consents: new ConsentRepository(database),
    recommendations: new RecommendationRepository(database),
    relationships: new RelationshipRepository(database),
    health: new HealthRepository(database),
  } as const;
}

export type Repositories = ReturnType<typeof createRepositories>;
