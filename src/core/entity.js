import { join } from 'path';
import * as storage from './storage.js';
import * as government from './government.js';
import { generateId, getPrefixForType, getTypeFromId, isEntityType } from './id.js';

/**
 * Entity types in the 4-column model
 */
export const ENTITY_TYPES = ['goal', 'problem', 'idea', 'action'];

/**
 * Status values for each entity type
 */
export const ENTITY_STATUSES = {
  goal: ['active', 'deprecated'],
  problem: ['unacknowledged', 'acknowledged', 'being_addressed', 'resolved'],
  idea: ['proposed', 'under_review', 'accepted', 'rejected', 'superseded'],
  action: ['open', 'in_progress', 'blocked', 'completed', 'cancelled']
};

/**
 * Valid relationship types between entities
 */
export const RELATION_TYPES = {
  // Problem → Goal
  threatens: { from: 'problem', to: 'goal' },

  // Idea → Problem
  addresses: { from: 'idea', to: 'problem' },

  // Idea → Goal
  pursues: { from: 'idea', to: 'goal' },

  // Idea → Idea
  complements: { from: 'idea', to: 'idea' },
  conflicts: { from: 'idea', to: 'idea' },
  requires: { from: 'idea', to: 'idea' },
  similar: { from: 'idea', to: 'idea' },
  duplicate: { from: 'idea', to: 'idea' },
  supersedes: { from: 'idea', to: 'idea' },
  alternative: { from: 'idea', to: 'idea' },
  extends: { from: 'idea', to: 'idea' },

  // Action → Idea
  implements: { from: 'action', to: 'idea' },

  // Action → Action
  depends_on: { from: 'action', to: 'action' },
  blocks: { from: 'action', to: 'action' }
};

const PRIORITIES = [0, 1, 2, 3, 4];

/**
 * Get the entities file path
 * @param {string} dataDir - Data directory path
 * @returns {string} Path to entities.jsonl
 */
export function getFilePath(dataDir) {
  return join(dataDir, 'entities.jsonl');
}

/**
 * Get the legacy issues file path (for backward compatibility)
 * @param {string} dataDir - Data directory path
 * @returns {string} Path to issues.jsonl
 */
export function getLegacyFilePath(dataDir) {
  return join(dataDir, 'issues.jsonl');
}

/**
 * Validate entity title
 * @param {string} title - Title to validate
 */
function validateTitle(title) {
  if (!title || typeof title !== 'string') {
    throw new Error('Entity title is required');
  }
  if (title.length > 500) {
    throw new Error('Entity title must be 500 characters or less');
  }
}

/**
 * Validate entity body
 * @param {string} body - Body to validate
 */
function validateBody(body) {
  if (body && body.length > 10000) {
    throw new Error('Entity body must be 10000 characters or less');
  }
}

/**
 * Validate entity type
 * @param {string} type - Type to validate
 */
function validateType(type) {
  if (!ENTITY_TYPES.includes(type)) {
    throw new Error(`Invalid entity type. Must be one of: ${ENTITY_TYPES.join(', ')}`);
  }
}

/**
 * Validate status for entity type
 * @param {string} status - Status to validate
 * @param {string} type - Entity type
 */
function validateStatus(status, type) {
  const validStatuses = ENTITY_STATUSES[type];
  if (validStatuses && !validStatuses.includes(status)) {
    throw new Error(`Invalid status for ${type}. Must be one of: ${validStatuses.join(', ')}`);
  }
}

/**
 * Validate priority
 * @param {number|string} priority - Priority to validate
 * @returns {number} Normalized priority
 */
function validatePriority(priority) {
  let normalized = priority;
  if (typeof priority === 'string') {
    const match = priority.match(/^P?(\d)$/i);
    if (match) {
      normalized = parseInt(match[1], 10);
    }
  }
  if (!PRIORITIES.includes(normalized)) {
    throw new Error('Invalid priority. Must be 0-4 or P0-P4');
  }
  return normalized;
}

/**
 * Validate location data
 * @param {Object} location - Location to validate
 * @returns {Object|null} Validated location
 */
function validateLocation(location) {
  if (!location) return null;

  const validated = {};
  if (location.address) {
    if (location.address.length > 500) {
      throw new Error('Location address must be 500 characters or less');
    }
    validated.address = location.address;
  }
  if (location.lat !== undefined) {
    if (location.lat < -90 || location.lat > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    validated.lat = location.lat;
  }
  if (location.lng !== undefined) {
    if (location.lng < -180 || location.lng > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
    validated.lng = location.lng;
  }
  return Object.keys(validated).length > 0 ? validated : null;
}

/**
 * Validate a single relation
 * @param {string} dataDir - Data directory path
 * @param {Object} relation - Relation to validate
 * @param {string} sourceType - Source entity type
 * @returns {Object} Validated relation
 */
function validateRelation(dataDir, relation, sourceType) {
  if (!relation.type || !relation.target) {
    throw new Error('Relation must have type and target');
  }

  const relationDef = RELATION_TYPES[relation.type];
  if (!relationDef) {
    throw new Error(`Invalid relation type: ${relation.type}. Valid types: ${Object.keys(RELATION_TYPES).join(', ')}`);
  }

  // Validate source type matches
  if (relationDef.from !== sourceType) {
    throw new Error(`Relation type '${relation.type}' is not valid from '${sourceType}' entities`);
  }

  // Validate target exists and has correct type
  const filePath = getFilePath(dataDir);
  const target = storage.findById(filePath, relation.target);
  if (!target) {
    throw new Error(`Relation target not found: ${relation.target}`);
  }

  const targetType = target.type;
  if (relationDef.to !== targetType) {
    throw new Error(`Relation type '${relation.type}' expects target type '${relationDef.to}', got '${targetType}'`);
  }

  return { type: relation.type, target: relation.target };
}

/**
 * Create a new entity
 * @param {string} dataDir - Data directory path
 * @param {string} type - Entity type (goal, problem, idea, action)
 * @param {Object} data - Entity data
 * @returns {Object} Created entity
 */
export function create(dataDir, type, data) {
  validateType(type);
  validateTitle(data.title);
  validateBody(data.body);

  const filePath = getFilePath(dataDir);
  const prefix = getPrefixForType(type);

  // Validate government reference
  let govId = null;
  if (data.gov_id) {
    const gov = government.find(dataDir, data.gov_id);
    if (!gov) {
      throw new Error(`Government not found: ${data.gov_id}`);
    }
    govId = gov.id;
  }

  // Validate priority
  const priority = validatePriority(data.priority ?? 2);

  // Validate location (for problems)
  const location = type === 'problem' ? validateLocation(data.location) : null;

  // Validate relations
  const relations = [];
  if (data.relations && Array.isArray(data.relations)) {
    for (const rel of data.relations) {
      relations.push(validateRelation(dataDir, rel, type));
    }
  }

  // Generate ID
  const id = generateId(prefix, { title: data.title, type, gov_id: govId },
    (id) => storage.findById(filePath, id) !== null);

  const now = new Date().toISOString();

  // Default status for each type
  const defaultStatus = ENTITY_STATUSES[type][0];

  const entity = {
    id,
    type,
    title: data.title.trim(),
    body: data.body?.trim() || null,
    priority,
    status: data.status || defaultStatus,
    gov_id: govId,
    relations,
    metadata: data.metadata || {},
    created_at: now,
    updated_at: now,
    closed_at: null,
    history: [
      { timestamp: now, action: 'created' }
    ]
  };

  // Type-specific fields
  if (type === 'problem') {
    entity.location = location;
    entity.report_count = data.report_count || 1;
  }

  if (type === 'idea') {
    entity.supporters = data.supporters || [];
    entity.support_count = data.support_count || 0;
    entity.similar_ideas = data.similar_ideas || [];
    entity.ai_classification = data.ai_classification || null;
  }

  if (type === 'action') {
    entity.assignee = data.assignee || null;
    entity.due_date = data.due_date || null;
  }

  // Validate status
  if (data.status) {
    validateStatus(data.status, type);
    entity.status = data.status;
  }

  storage.appendRecord(filePath, entity);
  return entity;
}

/**
 * Get all entities
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of entities
 */
export function list(dataDir, filters = {}) {
  const filePath = getFilePath(dataDir);
  let entities = storage.readAll(filePath);

  // Filter by type
  if (filters.type) {
    entities = entities.filter(e => e.type === filters.type);
  }

  // Filter by government
  if (filters.gov_id) {
    const gov = government.find(dataDir, filters.gov_id);
    if (gov) {
      entities = entities.filter(e => e.gov_id === gov.id);
    } else {
      entities = entities.filter(e => e.gov_id === filters.gov_id);
    }
  }

  // Filter unfiled (no government)
  if (filters.unfiled) {
    entities = entities.filter(e => e.gov_id === null);
  }

  // Filter by status
  if (filters.status) {
    entities = entities.filter(e => e.status === filters.status);
  }

  // Filter by priority
  if (filters.priority !== undefined) {
    entities = entities.filter(e => e.priority === filters.priority);
  }

  // Filter by relation target
  if (filters.relatedTo) {
    entities = entities.filter(e =>
      e.relations && e.relations.some(r => r.target === filters.relatedTo)
    );
  }

  // Sort
  const sortField = filters.sort || 'created_at';
  const sortOrder = filters.order || 'desc';

  entities.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortOrder === 'desc') {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  // Apply limit/offset
  if (filters.limit) {
    const offset = filters.offset || 0;
    entities = entities.slice(offset, offset + filters.limit);
  }

  return entities;
}

/**
 * Find an entity by ID
 * @param {string} dataDir - Data directory path
 * @param {string} id - Entity ID
 * @returns {Object|null} Entity or null
 */
export function find(dataDir, id) {
  const filePath = getFilePath(dataDir);
  return storage.findById(filePath, id);
}

/**
 * Update an entity
 * @param {string} dataDir - Data directory path
 * @param {string} id - Entity ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated entity or null
 */
export function update(dataDir, id, updates) {
  const filePath = getFilePath(dataDir);
  const entity = find(dataDir, id);

  if (!entity) {
    return null;
  }

  const allowedUpdates = {};
  const historyEntries = [];
  const now = new Date().toISOString();

  // Title update
  if (updates.title !== undefined) {
    validateTitle(updates.title);
    allowedUpdates.title = updates.title.trim();
    historyEntries.push({
      timestamp: now,
      action: 'title_changed',
      field: 'title',
      old_value: entity.title,
      new_value: allowedUpdates.title
    });
  }

  // Body update
  if (updates.body !== undefined) {
    validateBody(updates.body);
    allowedUpdates.body = updates.body?.trim() || null;
  }

  // Status update
  if (updates.status !== undefined) {
    validateStatus(updates.status, entity.type);
    allowedUpdates.status = updates.status;
    historyEntries.push({
      timestamp: now,
      action: 'status_changed',
      field: 'status',
      old_value: entity.status,
      new_value: updates.status
    });

    // Set closed_at for terminal statuses
    const terminalStatuses = ['resolved', 'completed', 'cancelled', 'deprecated', 'rejected', 'superseded'];
    if (terminalStatuses.includes(updates.status)) {
      allowedUpdates.closed_at = now;
    } else if (entity.closed_at) {
      allowedUpdates.closed_at = null;
    }
  }

  // Priority update
  if (updates.priority !== undefined) {
    const priority = validatePriority(updates.priority);
    allowedUpdates.priority = priority;
    historyEntries.push({
      timestamp: now,
      action: 'priority_changed',
      field: 'priority',
      old_value: entity.priority,
      new_value: priority
    });
  }

  // Government assignment
  if (updates.gov_id !== undefined) {
    let govId = null;
    if (updates.gov_id) {
      const gov = government.find(dataDir, updates.gov_id);
      if (!gov) {
        throw new Error(`Government not found: ${updates.gov_id}`);
      }
      govId = gov.id;
    }
    allowedUpdates.gov_id = govId;
    historyEntries.push({
      timestamp: now,
      action: govId ? 'assigned' : 'unassigned',
      field: 'gov_id',
      old_value: entity.gov_id,
      new_value: govId
    });
  }

  // Relations update
  if (updates.relations !== undefined) {
    const relations = [];
    if (Array.isArray(updates.relations)) {
      for (const rel of updates.relations) {
        relations.push(validateRelation(dataDir, rel, entity.type));
      }
    }
    allowedUpdates.relations = relations;
    historyEntries.push({
      timestamp: now,
      action: 'relations_changed',
      field: 'relations',
      old_value: entity.relations,
      new_value: relations
    });
  }

  // Type-specific updates
  if (entity.type === 'problem' && updates.location !== undefined) {
    allowedUpdates.location = validateLocation(updates.location);
  }

  if (entity.type === 'action') {
    if (updates.assignee !== undefined) {
      allowedUpdates.assignee = updates.assignee;
    }
    if (updates.due_date !== undefined) {
      allowedUpdates.due_date = updates.due_date;
    }
  }

  if (entity.type === 'idea') {
    if (updates.support_count !== undefined) {
      allowedUpdates.support_count = updates.support_count;
    }
    if (updates.supporters !== undefined) {
      allowedUpdates.supporters = updates.supporters;
    }
    if (updates.ai_classification !== undefined) {
      allowedUpdates.ai_classification = updates.ai_classification;
    }
  }

  // Metadata update
  if (updates.metadata !== undefined) {
    allowedUpdates.metadata = { ...entity.metadata, ...updates.metadata };
  }

  // Add history entries
  if (historyEntries.length > 0) {
    allowedUpdates.history = [...(entity.history || []), ...historyEntries];
  }

  return storage.updateRecord(filePath, id, allowedUpdates);
}

/**
 * Delete an entity
 * @param {string} dataDir - Data directory path
 * @param {string} id - Entity ID
 * @returns {boolean} True if deleted
 */
export function remove(dataDir, id) {
  const filePath = getFilePath(dataDir);
  return storage.deleteRecord(filePath, id);
}

/**
 * Add a relation to an entity
 * @param {string} dataDir - Data directory path
 * @param {string} sourceId - Source entity ID
 * @param {string} relationType - Relation type
 * @param {string} targetId - Target entity ID
 * @returns {Object|null} Updated entity or null
 */
export function addRelation(dataDir, sourceId, relationType, targetId) {
  const entity = find(dataDir, sourceId);
  if (!entity) {
    throw new Error(`Source entity not found: ${sourceId}`);
  }

  const relation = validateRelation(dataDir, { type: relationType, target: targetId }, entity.type);

  // Check for duplicate
  const existingRelations = entity.relations || [];
  const isDuplicate = existingRelations.some(r => r.type === relation.type && r.target === relation.target);
  if (isDuplicate) {
    throw new Error(`Relation already exists: ${sourceId} --[${relationType}]--> ${targetId}`);
  }

  return update(dataDir, sourceId, {
    relations: [...existingRelations, relation]
  });
}

/**
 * Remove a relation from an entity
 * @param {string} dataDir - Data directory path
 * @param {string} sourceId - Source entity ID
 * @param {string} relationType - Relation type
 * @param {string} targetId - Target entity ID
 * @returns {Object|null} Updated entity or null
 */
export function removeRelation(dataDir, sourceId, relationType, targetId) {
  const entity = find(dataDir, sourceId);
  if (!entity) {
    throw new Error(`Source entity not found: ${sourceId}`);
  }

  const existingRelations = entity.relations || [];
  const newRelations = existingRelations.filter(r =>
    !(r.type === relationType && r.target === targetId)
  );

  if (newRelations.length === existingRelations.length) {
    throw new Error(`Relation not found: ${sourceId} --[${relationType}]--> ${targetId}`);
  }

  return update(dataDir, sourceId, { relations: newRelations });
}

/**
 * Find entities that relate to a given entity
 * @param {string} dataDir - Data directory path
 * @param {string} targetId - Target entity ID
 * @param {string} [relationType] - Optional relation type filter
 * @returns {Array} Entities that have relations pointing to target
 */
export function findRelatedFrom(dataDir, targetId, relationType = null) {
  const filePath = getFilePath(dataDir);
  return storage.findByRelation(filePath, targetId, relationType);
}

/**
 * Get graph data for visualization
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Object} Graph data with nodes and edges
 */
export function getGraphData(dataDir, filters = {}) {
  const entities = list(dataDir, filters);

  const nodes = entities.map(e => ({
    id: e.id,
    type: e.type,
    title: e.title,
    status: e.status,
    priority: e.priority,
    gov_id: e.gov_id
  }));

  const edges = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  for (const entity of entities) {
    if (!entity.relations) continue;
    for (const rel of entity.relations) {
      // Only include edges where both nodes are in the graph
      if (nodeIds.has(rel.target)) {
        edges.push({
          source: entity.id,
          target: rel.target,
          type: rel.type
        });
      }
    }
  }

  return { nodes, edges };
}

/**
 * Get valid entity types
 * @returns {Array} Array of valid types
 */
export function getTypes() {
  return [...ENTITY_TYPES];
}

/**
 * Get valid statuses for an entity type
 * @param {string} type - Entity type
 * @returns {Array} Array of valid statuses
 */
export function getStatuses(type) {
  return ENTITY_STATUSES[type] ? [...ENTITY_STATUSES[type]] : [];
}

/**
 * Get valid relation types
 * @returns {Object} Relation types with their constraints
 */
export function getRelationTypes() {
  return { ...RELATION_TYPES };
}

/**
 * Get valid priorities
 * @returns {Array} Array of valid priorities
 */
export function getPriorities() {
  return [...PRIORITIES];
}

/**
 * Close an entity (set terminal status)
 * @param {string} dataDir - Data directory path
 * @param {string} id - Entity ID
 * @param {Object} [options] - Close options
 * @returns {Object|null} Closed entity or null
 */
export function close(dataDir, id, options = {}) {
  const entity = find(dataDir, id);
  if (!entity) {
    return null;
  }

  // Determine terminal status based on type
  const terminalStatuses = {
    goal: 'deprecated',
    problem: 'resolved',
    idea: options.rejected ? 'rejected' : 'accepted',
    action: options.cancelled ? 'cancelled' : 'completed'
  };

  const status = terminalStatuses[entity.type];
  const updates = { status };

  if (options.reason) {
    updates.metadata = { close_reason: options.reason };
  }

  return update(dataDir, id, updates);
}

/**
 * Add support to an idea
 * @param {string} dataDir - Data directory path
 * @param {string} ideaId - Idea entity ID
 * @param {string} supporterId - Supporter identifier
 * @returns {Object|null} Updated idea or null
 */
export function addSupport(dataDir, ideaId, supporterId) {
  const entity = find(dataDir, ideaId);
  if (!entity) {
    throw new Error(`Idea not found: ${ideaId}`);
  }
  if (entity.type !== 'idea') {
    throw new Error(`Entity ${ideaId} is not an idea`);
  }

  const supporters = entity.supporters || [];
  if (supporters.includes(supporterId)) {
    throw new Error(`Already supported by: ${supporterId}`);
  }

  return update(dataDir, ideaId, {
    supporters: [...supporters, supporterId],
    support_count: (entity.support_count || 0) + 1
  });
}

/**
 * Get counts by entity type
 * @param {string} dataDir - Data directory path
 * @param {string} [govId] - Optional government filter
 * @returns {Object} Counts by type and status
 */
export function getCounts(dataDir, govId = null) {
  const filters = govId ? { gov_id: govId } : {};
  const entities = list(dataDir, filters);

  const counts = {
    total: entities.length,
    by_type: { goal: 0, problem: 0, idea: 0, action: 0 },
    by_status: {}
  };

  for (const entity of entities) {
    counts.by_type[entity.type] = (counts.by_type[entity.type] || 0) + 1;
    counts.by_status[entity.status] = (counts.by_status[entity.status] || 0) + 1;
  }

  return counts;
}
