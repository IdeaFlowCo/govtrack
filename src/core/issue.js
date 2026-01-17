import { join, dirname } from 'path';
import { existsSync, renameSync } from 'fs';
import * as storage from './storage.js';
import * as government from './government.js';
import * as entity from './entity.js';
import { generateId, isValidId, getTypeFromId } from './id.js';

// Legacy issue types (kept for backward compatibility)
const ISSUE_TYPES = ['report', 'request', 'complaint', 'other', 'problem', 'action'];
const ISSUE_STATUSES = ['open', 'in_progress', 'resolved', 'closed', 'wont_fix'];
const PROBLEM_STATUSES = ['unacknowledged', 'acknowledged', 'being_addressed', 'resolved'];
const ALL_STATUSES = [...new Set([...ISSUE_STATUSES, ...PROBLEM_STATUSES])];
const PRIORITIES = [0, 1, 2, 3, 4];

// Entity types that should be stored in entities.jsonl
const ENTITY_TYPES = ['goal', 'problem', 'idea', 'action'];

/**
 * Get the issues file path
 * @param {string} dataDir - Data directory path
 * @returns {string} Path to issues.jsonl
 */
export function getFilePath(dataDir) {
  return join(dataDir, 'issues.jsonl');
}

/**
 * Create a new issue
 * @param {string} dataDir - Data directory path
 * @param {Object} data - Issue data
 * @returns {Object} Created issue
 */
export function create(dataDir, data) {
  const filePath = getFilePath(dataDir);

  // Validate required fields
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Issue title is required');
  }

  if (data.title.length > 500) {
    throw new Error('Issue title must be 500 characters or less');
  }

  // Validate body
  if (data.body && data.body.length > 10000) {
    throw new Error('Issue body must be 10000 characters or less');
  }

  // Validate type
  const type = data.type || 'report';
  if (!ISSUE_TYPES.includes(type)) {
    throw new Error(`Invalid issue type. Must be one of: ${ISSUE_TYPES.join(', ')}`);
  }

  // Validate priority
  let priority = data.priority ?? 2;
  if (typeof priority === 'string') {
    // Handle P0-P4 format
    const match = priority.match(/^P?(\d)$/i);
    if (match) {
      priority = parseInt(match[1], 10);
    }
  }
  if (!PRIORITIES.includes(priority)) {
    throw new Error(`Invalid priority. Must be 0-4 or P0-P4`);
  }

  // Validate government reference
  let govId = null;
  if (data.gov_id) {
    const gov = government.find(dataDir, data.gov_id);
    if (!gov) {
      throw new Error(`Government not found: ${data.gov_id}`);
    }
    govId = gov.id;
  }

  // Validate location
  let location = null;
  if (data.location) {
    location = {};
    if (data.location.address) {
      if (data.location.address.length > 500) {
        throw new Error('Location address must be 500 characters or less');
      }
      location.address = data.location.address;
    }
    if (data.location.lat !== undefined) {
      if (data.location.lat < -90 || data.location.lat > 90) {
        throw new Error('Latitude must be between -90 and 90');
      }
      location.lat = data.location.lat;
    }
    if (data.location.lng !== undefined) {
      if (data.location.lng < -180 || data.location.lng > 180) {
        throw new Error('Longitude must be between -180 and 180');
      }
      location.lng = data.location.lng;
    }
  }

  // Validate addresses (only for 'action' type)
  let addresses = null;
  if (data.addresses) {
    if (type !== 'action') {
      throw new Error('addresses field is only valid for type "action"');
    }
    if (!Array.isArray(data.addresses)) {
      throw new Error('addresses must be an array of issue IDs');
    }
    // Validate each referenced issue exists and is a problem
    addresses = [];
    for (const addr of data.addresses) {
      const problem = storage.findById(filePath, addr);
      if (!problem) {
        throw new Error(`Referenced issue not found: ${addr}`);
      }
      if (problem.type !== 'problem') {
        throw new Error(`Issue ${addr} is not a problem (type: ${problem.type})`);
      }
      addresses.push(problem.id);
    }
  }

  // Generate ID
  const id = generateId('gi', { title: data.title, gov_id: govId },
    (id) => storage.findById(filePath, id) !== null);

  const now = new Date().toISOString();

  // Default status depends on type
  const defaultStatus = type === 'problem' ? 'unacknowledged' : 'open';

  const issue = {
    id,
    gov_id: govId,
    addresses,
    title: data.title.trim(),
    body: data.body?.trim() || null,
    type,
    priority,
    status: defaultStatus,
    location,
    created_at: now,
    updated_at: now,
    closed_at: null,
    metadata: data.metadata || {},
    history: [
      { timestamp: now, action: 'created' }
    ]
  };

  storage.appendRecord(filePath, issue);
  return issue;
}

/**
 * Get all issues
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of issues
 */
export function list(dataDir, filters = {}) {
  const filePath = getFilePath(dataDir);
  let issues = storage.readAll(filePath);

  if (filters.gov_id) {
    const gov = government.find(dataDir, filters.gov_id);
    if (gov) {
      issues = issues.filter(i => i.gov_id === gov.id);
    } else {
      issues = issues.filter(i => i.gov_id === filters.gov_id);
    }
  }

  if (filters.unfiled) {
    issues = issues.filter(i => i.gov_id === null);
  }

  if (filters.status) {
    issues = issues.filter(i => i.status === filters.status);
  }

  if (filters.priority !== undefined) {
    issues = issues.filter(i => i.priority === filters.priority);
  }

  if (filters.type) {
    issues = issues.filter(i => i.type === filters.type);
  }

  // Sort by created_at descending by default
  const sortField = filters.sort || 'created_at';
  const sortOrder = filters.order || 'desc';

  issues.sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];

    if (sortOrder === 'desc') {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
  });

  // Apply limit
  if (filters.limit) {
    const offset = filters.offset || 0;
    issues = issues.slice(offset, offset + filters.limit);
  }

  return issues;
}

/**
 * Find an issue by ID
 * @param {string} dataDir - Data directory path
 * @param {string} id - Issue ID
 * @returns {Object|null} Issue or null
 */
export function find(dataDir, id) {
  const filePath = getFilePath(dataDir);
  return storage.findById(filePath, id);
}

/**
 * Update an issue
 * @param {string} dataDir - Data directory path
 * @param {string} id - Issue ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} Updated issue or null
 */
export function update(dataDir, id, updates) {
  const filePath = getFilePath(dataDir);
  const issue = find(dataDir, id);

  if (!issue) {
    return null;
  }

  const allowedUpdates = {};
  const historyEntries = [];
  const now = new Date().toISOString();

  if (updates.title !== undefined) {
    if (typeof updates.title !== 'string' || updates.title.length > 500) {
      throw new Error('Invalid title');
    }
    allowedUpdates.title = updates.title.trim();
    historyEntries.push({
      timestamp: now,
      action: 'title_changed',
      field: 'title',
      old_value: issue.title,
      new_value: allowedUpdates.title
    });
  }

  if (updates.body !== undefined) {
    allowedUpdates.body = updates.body?.trim() || null;
  }

  if (updates.status !== undefined) {
    // Validate status based on issue type
    const validStatuses = issue.type === 'problem' ? PROBLEM_STATUSES : ISSUE_STATUSES;
    if (!validStatuses.includes(updates.status)) {
      throw new Error(`Invalid status for ${issue.type}. Must be one of: ${validStatuses.join(', ')}`);
    }
    allowedUpdates.status = updates.status;
    historyEntries.push({
      timestamp: now,
      action: 'status_changed',
      field: 'status',
      old_value: issue.status,
      new_value: updates.status
    });

    // Set closed_at if closing
    if (['resolved', 'closed', 'wont_fix'].includes(updates.status)) {
      allowedUpdates.closed_at = now;
    } else if (issue.closed_at && ['open', 'unacknowledged'].includes(updates.status)) {
      allowedUpdates.closed_at = null;
    }
  }

  // Handle addresses updates (only for 'action' type)
  if (updates.addresses !== undefined) {
    if (issue.type !== 'action') {
      throw new Error('addresses field is only valid for type "action"');
    }
    if (updates.addresses === null) {
      allowedUpdates.addresses = null;
    } else if (Array.isArray(updates.addresses)) {
      const filePath = getFilePath(dataDir);
      allowedUpdates.addresses = [];
      for (const addr of updates.addresses) {
        const problem = storage.findById(filePath, addr);
        if (!problem) {
          throw new Error(`Referenced issue not found: ${addr}`);
        }
        if (problem.type !== 'problem') {
          throw new Error(`Issue ${addr} is not a problem (type: ${problem.type})`);
        }
        allowedUpdates.addresses.push(problem.id);
      }
      historyEntries.push({
        timestamp: now,
        action: 'addresses_changed',
        field: 'addresses',
        old_value: issue.addresses,
        new_value: allowedUpdates.addresses
      });
    } else {
      throw new Error('addresses must be an array of issue IDs or null');
    }
  }

  if (updates.priority !== undefined) {
    let priority = updates.priority;
    if (typeof priority === 'string') {
      const match = priority.match(/^P?(\d)$/i);
      if (match) {
        priority = parseInt(match[1], 10);
      }
    }
    if (!PRIORITIES.includes(priority)) {
      throw new Error('Invalid priority');
    }
    allowedUpdates.priority = priority;
    historyEntries.push({
      timestamp: now,
      action: 'priority_changed',
      field: 'priority',
      old_value: issue.priority,
      new_value: priority
    });
  }

  // Add history entries
  if (historyEntries.length > 0) {
    allowedUpdates.history = [...(issue.history || []), ...historyEntries];
  }

  return storage.updateRecord(filePath, id, allowedUpdates);
}

/**
 * Assign an issue to a government
 * @param {string} dataDir - Data directory path
 * @param {string} issueId - Issue ID
 * @param {string|null} govIdOrSlug - Government ID/slug or null to unfile
 * @returns {Object|null} Updated issue or null
 */
export function assign(dataDir, issueId, govIdOrSlug) {
  const filePath = getFilePath(dataDir);
  const issue = find(dataDir, issueId);

  if (!issue) {
    return null;
  }

  let govId = null;
  if (govIdOrSlug) {
    const gov = government.find(dataDir, govIdOrSlug);
    if (!gov) {
      throw new Error(`Government not found: ${govIdOrSlug}`);
    }
    govId = gov.id;
  }

  const now = new Date().toISOString();
  const historyEntry = {
    timestamp: now,
    action: govId ? 'assigned' : 'unassigned',
    field: 'gov_id',
    old_value: issue.gov_id,
    new_value: govId
  };

  return storage.updateRecord(filePath, issueId, {
    gov_id: govId,
    history: [...(issue.history || []), historyEntry]
  });
}

/**
 * Close an issue
 * @param {string} dataDir - Data directory path
 * @param {string} id - Issue ID
 * @param {Object} [options] - Close options
 * @returns {Object|null} Closed issue or null
 */
export function close(dataDir, id, options = {}) {
  const status = options.wontFix ? 'wont_fix' : 'resolved';
  const issue = find(dataDir, id);

  if (!issue) {
    return null;
  }

  const now = new Date().toISOString();
  const filePath = getFilePath(dataDir);

  const historyEntry = {
    timestamp: now,
    action: 'closed',
    field: 'status',
    old_value: issue.status,
    new_value: status
  };

  if (options.reason) {
    historyEntry.reason = options.reason;
  }

  const updates = {
    status,
    closed_at: now,
    history: [...(issue.history || []), historyEntry]
  };

  if (options.reason) {
    updates.metadata = { ...issue.metadata, close_reason: options.reason };
  }

  return storage.updateRecord(filePath, id, updates);
}

/**
 * Reopen an issue
 * @param {string} dataDir - Data directory path
 * @param {string} id - Issue ID
 * @returns {Object|null} Reopened issue or null
 */
export function reopen(dataDir, id) {
  const issue = find(dataDir, id);

  if (!issue) {
    return null;
  }

  const now = new Date().toISOString();
  const filePath = getFilePath(dataDir);

  const historyEntry = {
    timestamp: now,
    action: 'reopened',
    field: 'status',
    old_value: issue.status,
    new_value: 'open'
  };

  return storage.updateRecord(filePath, id, {
    status: 'open',
    closed_at: null,
    history: [...(issue.history || []), historyEntry]
  });
}

/**
 * Delete an issue
 * @param {string} dataDir - Data directory path
 * @param {string} id - Issue ID
 * @returns {boolean} True if deleted
 */
export function remove(dataDir, id) {
  const filePath = getFilePath(dataDir);
  return storage.deleteRecord(filePath, id);
}

/**
 * Get valid issue types
 * @returns {Array} Array of valid types
 */
export function getTypes() {
  return [...ISSUE_TYPES];
}

/**
 * Get valid issue statuses
 * @param {string} [type] - Optional issue type to get type-specific statuses
 * @returns {Array} Array of valid statuses
 */
export function getStatuses(type) {
  if (type === 'problem') {
    return [...PROBLEM_STATUSES];
  }
  if (type === 'action' || !type) {
    return [...ISSUE_STATUSES];
  }
  return [...ALL_STATUSES];
}

/**
 * Get valid problem statuses
 * @returns {Array} Array of valid problem statuses
 */
export function getProblemStatuses() {
  return [...PROBLEM_STATUSES];
}

/**
 * Get valid priorities
 * @returns {Array} Array of valid priorities
 */
export function getPriorities() {
  return [...PRIORITIES];
}

/**
 * Find actions that address a given problem
 * @param {string} dataDir - Data directory path
 * @param {string} problemId - Problem ID
 * @returns {Array} Array of action issues
 */
export function findActionsForProblem(dataDir, problemId) {
  const allIssues = list(dataDir, { type: 'action' });
  return allIssues.filter(issue =>
    issue.addresses && issue.addresses.includes(problemId)
  );
}

/**
 * Find problems that an action addresses
 * @param {string} dataDir - Data directory path
 * @param {string} actionId - Action ID
 * @returns {Array} Array of problem issues
 */
export function findProblemsForAction(dataDir, actionId) {
  const action = find(dataDir, actionId);
  if (!action || !action.addresses) {
    return [];
  }
  return action.addresses
    .map(id => find(dataDir, id))
    .filter(Boolean);
}

/**
 * Get issue counts by government
 * @param {string} dataDir - Data directory path
 * @param {string} govId - Government ID
 * @returns {Object} Count object
 */
export function getCountsByGov(dataDir, govId) {
  const issues = list(dataDir, { gov_id: govId });

  const counts = {
    total: issues.length,
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    wont_fix: 0
  };

  for (const issue of issues) {
    if (counts[issue.status] !== undefined) {
      counts[issue.status]++;
    }
  }

  return counts;
}

// =============================================================================
// NEW ENTITY TYPE HELPERS (4-Column Model)
// These delegate to entity.js for the new entity types
// =============================================================================

/**
 * Create a new Goal
 * @param {string} dataDir - Data directory path
 * @param {Object} data - Goal data
 * @returns {Object} Created goal
 */
export function createGoal(dataDir, data) {
  return entity.create(dataDir, 'goal', data);
}

/**
 * Create a new Problem (entity version)
 * @param {string} dataDir - Data directory path
 * @param {Object} data - Problem data
 * @returns {Object} Created problem
 */
export function createProblem(dataDir, data) {
  return entity.create(dataDir, 'problem', data);
}

/**
 * Create a new Idea
 * @param {string} dataDir - Data directory path
 * @param {Object} data - Idea data
 * @returns {Object} Created idea
 */
export function createIdea(dataDir, data) {
  return entity.create(dataDir, 'idea', data);
}

/**
 * Create a new Action (entity version)
 * @param {string} dataDir - Data directory path
 * @param {Object} data - Action data
 * @returns {Object} Created action
 */
export function createAction(dataDir, data) {
  return entity.create(dataDir, 'action', data);
}

/**
 * List entities by type
 * @param {string} dataDir - Data directory path
 * @param {string} entityType - Entity type (goal, problem, idea, action)
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of entities
 */
export function listEntities(dataDir, entityType, filters = {}) {
  return entity.list(dataDir, { ...filters, type: entityType });
}

/**
 * List all goals
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of goals
 */
export function listGoals(dataDir, filters = {}) {
  return entity.list(dataDir, { ...filters, type: 'goal' });
}

/**
 * List all problems (entity version)
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of problems
 */
export function listProblems(dataDir, filters = {}) {
  return entity.list(dataDir, { ...filters, type: 'problem' });
}

/**
 * List all ideas
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of ideas
 */
export function listIdeas(dataDir, filters = {}) {
  return entity.list(dataDir, { ...filters, type: 'idea' });
}

/**
 * List all actions (entity version)
 * @param {string} dataDir - Data directory path
 * @param {Object} [filters] - Optional filters
 * @returns {Array} Array of actions
 */
export function listActions(dataDir, filters = {}) {
  return entity.list(dataDir, { ...filters, type: 'action' });
}

/**
 * Find an entity by ID (works with both legacy issues and new entities)
 * @param {string} dataDir - Data directory path
 * @param {string} id - Entity or issue ID
 * @returns {Object|null} Entity/issue or null
 */
export function findAny(dataDir, id) {
  // Check entity type from ID prefix
  const entityType = getTypeFromId(id);

  // If it's a new entity type, look in entities.jsonl
  if (entityType && ENTITY_TYPES.includes(entityType)) {
    return entity.find(dataDir, id);
  }

  // Otherwise check legacy issues
  return find(dataDir, id);
}

/**
 * Get the entity module (for direct access to entity functions)
 * @returns {Object} Entity module
 */
export function getEntityModule() {
  return entity;
}
