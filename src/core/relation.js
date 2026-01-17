import * as entity from './entity.js';
import { getTypeFromId } from './id.js';

/**
 * Relation types that can form dependency cycles
 */
const DEPENDENCY_RELATIONS = ['depends_on', 'requires', 'blocks'];

/**
 * Add a relation between two entities with validation and cycle detection
 * @param {string} dataDir - Data directory path
 * @param {string} sourceId - Source entity ID
 * @param {string} relationType - Type of relation
 * @param {string} targetId - Target entity ID
 * @returns {Object} Updated source entity
 */
export function link(dataDir, sourceId, relationType, targetId) {
  // Prevent self-references
  if (sourceId === targetId) {
    throw new Error('Cannot create a relation to itself');
  }

  // Check for cycles if this is a dependency relation
  if (DEPENDENCY_RELATIONS.includes(relationType)) {
    if (wouldCreateCycle(dataDir, sourceId, targetId, relationType)) {
      throw new Error(`Adding this relation would create a cycle: ${sourceId} -> ${targetId}`);
    }
  }

  return entity.addRelation(dataDir, sourceId, relationType, targetId);
}

/**
 * Remove a relation between two entities
 * @param {string} dataDir - Data directory path
 * @param {string} sourceId - Source entity ID
 * @param {string} relationType - Type of relation
 * @param {string} targetId - Target entity ID
 * @returns {Object} Updated source entity
 */
export function unlink(dataDir, sourceId, relationType, targetId) {
  return entity.removeRelation(dataDir, sourceId, relationType, targetId);
}

/**
 * Get all relations for an entity (both outgoing and incoming)
 * @param {string} dataDir - Data directory path
 * @param {string} entityId - Entity ID
 * @returns {Object} Object with outgoing and incoming relations
 */
export function getRelations(dataDir, entityId) {
  const ent = entity.find(dataDir, entityId);
  if (!ent) {
    throw new Error(`Entity not found: ${entityId}`);
  }

  // Outgoing relations (from this entity)
  const outgoing = (ent.relations || []).map(rel => ({
    type: rel.type,
    target: rel.target,
    targetEntity: entity.find(dataDir, rel.target)
  }));

  // Incoming relations (to this entity)
  const incoming = [];
  const relatedEntities = entity.findRelatedFrom(dataDir, entityId);
  for (const related of relatedEntities) {
    const matchingRels = related.relations.filter(r => r.target === entityId);
    for (const rel of matchingRels) {
      incoming.push({
        type: rel.type,
        source: related.id,
        sourceEntity: related
      });
    }
  }

  return { outgoing, incoming };
}

/**
 * Check if adding a relation would create a cycle (for dependency relations)
 * @param {string} dataDir - Data directory path
 * @param {string} sourceId - Source entity ID
 * @param {string} targetId - Target entity ID
 * @param {string} relationType - Relation type being added
 * @returns {boolean} True if adding this relation would create a cycle
 */
export function wouldCreateCycle(dataDir, sourceId, targetId, relationType) {
  // Only check for cycle-forming relations
  if (!DEPENDENCY_RELATIONS.includes(relationType)) {
    return false;
  }

  // BFS to find if target can reach source through dependency relations
  const visited = new Set();
  const queue = [targetId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (currentId === sourceId) {
      return true; // Found a path back to source - would create cycle
    }

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const current = entity.find(dataDir, currentId);
    if (!current || !current.relations) {
      continue;
    }

    // Follow dependency edges
    for (const rel of current.relations) {
      if (DEPENDENCY_RELATIONS.includes(rel.type) && !visited.has(rel.target)) {
        queue.push(rel.target);
      }
    }
  }

  return false;
}

/**
 * Find all entities blocked by a given entity
 * @param {string} dataDir - Data directory path
 * @param {string} entityId - Entity ID
 * @returns {Array} Entities that depend on this entity
 */
export function findBlocked(dataDir, entityId) {
  return entity.findRelatedFrom(dataDir, entityId, 'depends_on');
}

/**
 * Find all dependencies of an entity (what it depends on)
 * @param {string} dataDir - Data directory path
 * @param {string} entityId - Entity ID
 * @returns {Array} Entities this entity depends on
 */
export function findDependencies(dataDir, entityId) {
  const ent = entity.find(dataDir, entityId);
  if (!ent || !ent.relations) {
    return [];
  }

  return ent.relations
    .filter(rel => rel.type === 'depends_on')
    .map(rel => entity.find(dataDir, rel.target))
    .filter(Boolean);
}

/**
 * Check if an entity is blocked (has unresolved dependencies)
 * @param {string} dataDir - Data directory path
 * @param {string} entityId - Entity ID
 * @returns {Object} Blocked status and blockers
 */
export function isBlocked(dataDir, entityId) {
  const dependencies = findDependencies(dataDir, entityId);
  const terminalStatuses = ['completed', 'resolved', 'accepted', 'cancelled', 'deprecated', 'rejected'];

  const blockers = dependencies.filter(dep => !terminalStatuses.includes(dep.status));

  return {
    blocked: blockers.length > 0,
    blockers: blockers.map(b => ({ id: b.id, title: b.title, status: b.status }))
  };
}

/**
 * Get the dependency graph for visualization
 * @param {string} dataDir - Data directory path
 * @param {string} [rootId] - Optional root entity to start from
 * @returns {Object} Graph with nodes and edges for dependencies
 */
export function getDependencyGraph(dataDir, rootId = null) {
  let entities;

  if (rootId) {
    // Get transitive closure of dependencies starting from root
    entities = getTransitiveDependencies(dataDir, rootId);
  } else {
    // Get all entities
    entities = entity.list(dataDir);
  }

  const nodeIds = new Set(entities.map(e => e.id));

  const nodes = entities.map(e => ({
    id: e.id,
    type: e.type,
    title: e.title,
    status: e.status
  }));

  const edges = [];
  for (const ent of entities) {
    if (!ent.relations) continue;
    for (const rel of ent.relations) {
      if (DEPENDENCY_RELATIONS.includes(rel.type) && nodeIds.has(rel.target)) {
        edges.push({
          source: ent.id,
          target: rel.target,
          type: rel.type
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Get all transitive dependencies of an entity
 * @param {string} dataDir - Data directory path
 * @param {string} entityId - Entity ID
 * @returns {Array} All entities in the dependency chain
 */
export function getTransitiveDependencies(dataDir, entityId) {
  const result = [];
  const visited = new Set();
  const queue = [entityId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const current = entity.find(dataDir, currentId);
    if (!current) continue;

    result.push(current);

    if (current.relations) {
      for (const rel of current.relations) {
        if (DEPENDENCY_RELATIONS.includes(rel.type) && !visited.has(rel.target)) {
          queue.push(rel.target);
        }
      }
    }
  }

  return result;
}

/**
 * Validate that a relation type is valid for the given entity types
 * @param {string} relationType - Relation type
 * @param {string} sourceType - Source entity type
 * @param {string} targetType - Target entity type
 * @returns {Object} Validation result with isValid and error
 */
export function validateRelationType(relationType, sourceType, targetType) {
  const relationDef = entity.RELATION_TYPES[relationType];

  if (!relationDef) {
    return {
      isValid: false,
      error: `Unknown relation type: ${relationType}`
    };
  }

  if (relationDef.from !== sourceType) {
    return {
      isValid: false,
      error: `Relation '${relationType}' cannot originate from '${sourceType}' (expected '${relationDef.from}')`
    };
  }

  if (relationDef.to !== targetType) {
    return {
      isValid: false,
      error: `Relation '${relationType}' cannot target '${targetType}' (expected '${relationDef.to}')`
    };
  }

  return { isValid: true };
}

/**
 * Get suggested relation types for a pair of entities
 * @param {string} sourceType - Source entity type
 * @param {string} targetType - Target entity type
 * @returns {Array} Valid relation types for this pair
 */
export function getSuggestedRelations(sourceType, targetType) {
  const relationTypes = entity.getRelationTypes();
  return Object.entries(relationTypes)
    .filter(([_, def]) => def.from === sourceType && def.to === targetType)
    .map(([type, _]) => type);
}

/**
 * Get relation types grouped by source entity type
 * @returns {Object} Relations grouped by source type
 */
export function getRelationsBySourceType() {
  const relationTypes = entity.getRelationTypes();
  const grouped = {};

  for (const [type, def] of Object.entries(relationTypes)) {
    if (!grouped[def.from]) {
      grouped[def.from] = [];
    }
    grouped[def.from].push({ type, to: def.to });
  }

  return grouped;
}
