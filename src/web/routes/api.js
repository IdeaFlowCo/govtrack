import { Router } from 'express';
import * as government from '../../core/government.js';
import * as issue from '../../core/issue.js';
import * as entity from '../../core/entity.js';
import * as relation from '../../core/relation.js';
import * as ai from '../../core/ai.js';

/**
 * Create API router
 * @param {string} dataDir - Path to .govtrack directory
 * @returns {Router} Express router
 */
export function createApiRouter(dataDir) {
  const router = Router();

  // Helper to wrap async handlers
  const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  // ============== GOVERNMENTS ==============

  // List governments
  router.get('/governments', asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.state) filters.state = req.query.state;
    if (req.query.status) filters.status = req.query.status;

    const govs = government.list(dataDir, filters);
    const govsWithCounts = govs.map(g => ({
      ...g,
      issue_count: issue.getCountsByGov(dataDir, g.id)
    }));

    res.json({ success: true, data: { governments: govsWithCounts, total: govsWithCounts.length } });
  }));

  // Get government
  router.get('/governments/:id', asyncHandler(async (req, res) => {
    const gov = government.find(dataDir, req.params.id);
    if (!gov) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Government not found: ${req.params.id}` }
      });
    }

    const counts = issue.getCountsByGov(dataDir, gov.id);
    res.json({ success: true, data: { ...gov, issue_count: counts } });
  }));

  // Create government
  router.post('/governments', asyncHandler(async (req, res) => {
    try {
      const gov = government.create(dataDir, req.body);
      res.status(201).json({ success: true, data: gov });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Update government
  router.patch('/governments/:id', asyncHandler(async (req, res) => {
    try {
      const gov = government.update(dataDir, req.params.id, req.body);
      if (!gov) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Government not found: ${req.params.id}` }
        });
      }
      res.json({ success: true, data: gov });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Delete government
  router.delete('/governments/:id', asyncHandler(async (req, res) => {
    const gov = government.find(dataDir, req.params.id);
    if (!gov) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Government not found: ${req.params.id}` }
      });
    }

    // Handle issues
    const issues = issue.list(dataDir, { gov_id: gov.id });
    for (const iss of issues) {
      if (req.query.reassign) {
        issue.assign(dataDir, iss.id, req.query.reassign);
      } else {
        issue.assign(dataDir, iss.id, null);
      }
    }

    government.remove(dataDir, gov.id);
    res.json({ success: true, data: { deleted: gov.id, issues_reassigned: issues.length } });
  }));

  // ============== ISSUES ==============

  // List issues
  router.get('/issues', asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    if (req.query.unfiled === 'true') filters.unfiled = true;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority !== undefined) filters.priority = parseInt(req.query.priority, 10);
    if (req.query.type) filters.type = req.query.type;
    if (req.query.sort) filters.sort = req.query.sort;
    if (req.query.order) filters.order = req.query.order;

    const limit = parseInt(req.query.limit, 10) || 50;
    const offset = parseInt(req.query.offset, 10) || 0;
    filters.limit = Math.min(limit, 200);
    filters.offset = offset;

    const issues = issue.list(dataDir, filters);

    // Enrich with government info
    const govCache = {};
    const enriched = issues.map(iss => {
      let gov = null;
      if (iss.gov_id) {
        if (!govCache[iss.gov_id]) {
          govCache[iss.gov_id] = government.find(dataDir, iss.gov_id);
        }
        gov = govCache[iss.gov_id];
      }
      return {
        ...iss,
        government: gov ? { id: gov.id, slug: gov.slug, name: gov.name } : null
      };
    });

    res.json({
      success: true,
      data: { issues: enriched, total: enriched.length, limit, offset }
    });
  }));

  // Get issue
  router.get('/issues/:id', asyncHandler(async (req, res) => {
    const iss = issue.find(dataDir, req.params.id);
    if (!iss) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Issue not found: ${req.params.id}` }
      });
    }

    let gov = null;
    if (iss.gov_id) {
      gov = government.find(dataDir, iss.gov_id);
    }

    res.json({
      success: true,
      data: { ...iss, government: gov ? { id: gov.id, slug: gov.slug, name: gov.name } : null }
    });
  }));

  // Create issue
  router.post('/issues', asyncHandler(async (req, res) => {
    try {
      const iss = issue.create(dataDir, req.body);
      res.status(201).json({ success: true, data: iss });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Update issue
  router.patch('/issues/:id', asyncHandler(async (req, res) => {
    try {
      const iss = issue.update(dataDir, req.params.id, req.body);
      if (!iss) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Issue not found: ${req.params.id}` }
        });
      }
      res.json({ success: true, data: iss });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Close issue
  router.post('/issues/:id/close', asyncHandler(async (req, res) => {
    try {
      const iss = issue.close(dataDir, req.params.id, {
        reason: req.body.reason,
        wontFix: req.body.status === 'wont_fix'
      });
      if (!iss) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Issue not found: ${req.params.id}` }
        });
      }
      res.json({ success: true, data: iss });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Reopen issue
  router.post('/issues/:id/reopen', asyncHandler(async (req, res) => {
    const iss = issue.reopen(dataDir, req.params.id);
    if (!iss) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Issue not found: ${req.params.id}` }
      });
    }
    res.json({ success: true, data: iss });
  }));

  // Assign issue
  router.post('/issues/:id/assign', asyncHandler(async (req, res) => {
    try {
      const iss = issue.assign(dataDir, req.params.id, req.body.gov_id);
      if (!iss) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Issue not found: ${req.params.id}` }
        });
      }
      res.json({ success: true, data: iss });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Delete issue
  router.delete('/issues/:id', asyncHandler(async (req, res) => {
    const deleted = issue.remove(dataDir, req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Issue not found: ${req.params.id}` }
      });
    }
    res.json({ success: true, data: { deleted: req.params.id } });
  }));

  // ============== STATS ==============

  router.get('/stats', asyncHandler(async (req, res) => {
    const govs = government.list(dataDir);
    const issues = issue.list(dataDir);

    const byStatus = { open: 0, in_progress: 0, resolved: 0, closed: 0, wont_fix: 0 };
    const byPriority = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    let unfiled = 0;

    for (const iss of issues) {
      byStatus[iss.status] = (byStatus[iss.status] || 0) + 1;
      byPriority[iss.priority] = (byPriority[iss.priority] || 0) + 1;
      if (!iss.gov_id) unfiled++;
    }

    res.json({
      success: true,
      data: {
        governments: {
          total: govs.length,
          active: govs.filter(g => g.status === 'active').length,
          inactive: govs.filter(g => g.status === 'inactive').length
        },
        issues: {
          total: issues.length,
          ...byStatus,
          unfiled
        },
        by_priority: byPriority
      }
    });
  }));

  // ============== ENTITIES (4-Column Model) ==============

  // List all entities
  router.get('/entities', asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    if (req.query.unfiled === 'true') filters.unfiled = true;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.priority !== undefined) filters.priority = parseInt(req.query.priority, 10);
    if (req.query.sort) filters.sort = req.query.sort;
    if (req.query.order) filters.order = req.query.order;

    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    filters.limit = Math.min(limit, 500);
    filters.offset = offset;

    const entities = entity.list(dataDir, filters);

    // Enrich with government info
    const govCache = {};
    const enriched = entities.map(ent => {
      let gov = null;
      if (ent.gov_id) {
        if (!govCache[ent.gov_id]) {
          govCache[ent.gov_id] = government.find(dataDir, ent.gov_id);
        }
        gov = govCache[ent.gov_id];
      }
      return {
        ...ent,
        government: gov ? { id: gov.id, slug: gov.slug, name: gov.name } : null
      };
    });

    res.json({
      success: true,
      data: { entities: enriched, total: enriched.length, limit, offset }
    });
  }));

  // Get single entity
  router.get('/entities/:id', asyncHandler(async (req, res) => {
    const ent = entity.find(dataDir, req.params.id);
    if (!ent) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Entity not found: ${req.params.id}` }
      });
    }

    let gov = null;
    if (ent.gov_id) {
      gov = government.find(dataDir, ent.gov_id);
    }

    // Get relations info
    const rels = relation.getRelations(dataDir, req.params.id);

    res.json({
      success: true,
      data: {
        ...ent,
        government: gov ? { id: gov.id, slug: gov.slug, name: gov.name } : null,
        relationsInfo: rels
      }
    });
  }));

  // Create entity
  router.post('/entities', asyncHandler(async (req, res) => {
    try {
      const { type, ...data } = req.body;
      if (!type) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Entity type is required' }
        });
      }
      const ent = entity.create(dataDir, type, data);
      res.status(201).json({ success: true, data: ent });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Update entity
  router.patch('/entities/:id', asyncHandler(async (req, res) => {
    try {
      const ent = entity.update(dataDir, req.params.id, req.body);
      if (!ent) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: `Entity not found: ${req.params.id}` }
        });
      }
      res.json({ success: true, data: ent });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Delete entity
  router.delete('/entities/:id', asyncHandler(async (req, res) => {
    const deleted = entity.remove(dataDir, req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: `Entity not found: ${req.params.id}` }
      });
    }
    res.json({ success: true, data: { deleted: req.params.id } });
  }));

  // ============== ENTITY TYPE SHORTCUTS ==============

  // Goals
  router.get('/goals', asyncHandler(async (req, res) => {
    const filters = { type: 'goal' };
    if (req.query.status) filters.status = req.query.status;
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    const goals = entity.list(dataDir, filters);
    res.json({ success: true, data: { goals, total: goals.length } });
  }));

  router.post('/goals', asyncHandler(async (req, res) => {
    try {
      const goal = entity.create(dataDir, 'goal', req.body);
      res.status(201).json({ success: true, data: goal });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Problems
  router.get('/problems', asyncHandler(async (req, res) => {
    const filters = { type: 'problem' };
    if (req.query.status) filters.status = req.query.status;
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    const problems = entity.list(dataDir, filters);
    res.json({ success: true, data: { problems, total: problems.length } });
  }));

  router.post('/problems', asyncHandler(async (req, res) => {
    try {
      const problem = entity.create(dataDir, 'problem', req.body);
      res.status(201).json({ success: true, data: problem });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Ideas
  router.get('/ideas', asyncHandler(async (req, res) => {
    const filters = { type: 'idea' };
    if (req.query.status) filters.status = req.query.status;
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    const ideas = entity.list(dataDir, filters);
    res.json({ success: true, data: { ideas, total: ideas.length } });
  }));

  router.post('/ideas', asyncHandler(async (req, res) => {
    try {
      const idea = entity.create(dataDir, 'idea', req.body);
      res.status(201).json({ success: true, data: idea });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Support an idea
  router.post('/ideas/:id/support', asyncHandler(async (req, res) => {
    try {
      const supporterId = req.body.user || 'anonymous';
      const updated = entity.addSupport(dataDir, req.params.id, supporterId);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Actions
  router.get('/actions', asyncHandler(async (req, res) => {
    const filters = { type: 'action' };
    if (req.query.status) filters.status = req.query.status;
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    const actions = entity.list(dataDir, filters);
    res.json({ success: true, data: { actions, total: actions.length } });
  }));

  router.post('/actions', asyncHandler(async (req, res) => {
    try {
      const action = entity.create(dataDir, 'action', req.body);
      res.status(201).json({ success: true, data: action });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // ============== RELATIONS ==============

  // Get relations for an entity
  router.get('/entities/:id/relations', asyncHandler(async (req, res) => {
    try {
      const rels = relation.getRelations(dataDir, req.params.id);
      res.json({ success: true, data: rels });
    } catch (err) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }));

  // Add a relation
  router.post('/entities/:id/relations', asyncHandler(async (req, res) => {
    try {
      const { type, target } = req.body;
      if (!type || !target) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Relation type and target are required' }
        });
      }
      const updated = relation.link(dataDir, req.params.id, type, target);
      res.status(201).json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // Remove a relation
  router.delete('/entities/:id/relations', asyncHandler(async (req, res) => {
    try {
      const { type, target } = req.body;
      if (!type || !target) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Relation type and target are required' }
        });
      }
      const updated = relation.unlink(dataDir, req.params.id, type, target);
      res.json({ success: true, data: updated });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message }
      });
    }
  }));

  // ============== GRAPH ==============

  // Get graph data for visualization
  router.get('/graph', asyncHandler(async (req, res) => {
    const filters = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.gov_id) filters.gov_id = req.query.gov_id;
    if (req.query.status) filters.status = req.query.status;

    const graphData = entity.getGraphData(dataDir, filters);

    // Add government info to nodes
    const govCache = {};
    graphData.nodes = graphData.nodes.map(node => {
      let gov = null;
      if (node.gov_id) {
        if (!govCache[node.gov_id]) {
          govCache[node.gov_id] = government.find(dataDir, node.gov_id);
        }
        gov = govCache[node.gov_id];
      }
      return {
        ...node,
        government: gov ? { id: gov.id, slug: gov.slug, name: gov.name } : null
      };
    });

    res.json({ success: true, data: graphData });
  }));

  // Get dependency graph for a specific entity
  router.get('/graph/dependencies/:id', asyncHandler(async (req, res) => {
    try {
      const graphData = relation.getDependencyGraph(dataDir, req.params.id);
      res.json({ success: true, data: graphData });
    } catch (err) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }));

  // ============== ENTITY STATS ==============

  router.get('/entities/stats', asyncHandler(async (req, res) => {
    const govId = req.query.gov_id || null;
    const counts = entity.getCounts(dataDir, govId);
    res.json({ success: true, data: counts });
  }));

  // ============== AI FEATURES ==============

  // Classify text and suggest entity type
  router.post('/classify', asyncHandler(async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Text is required' }
        });
      }
      const suggestion = ai.suggestEntity(text);
      res.json({ success: true, data: suggestion });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'AI_ERROR', message: err.message }
      });
    }
  }));

  // Find similar ideas
  router.get('/ideas/similar', asyncHandler(async (req, res) => {
    try {
      const { text, threshold = 0.3, limit = 5 } = req.query;
      if (!text) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Text query parameter is required' }
        });
      }
      const similar = ai.findSimilarIdeas(dataDir, text, parseFloat(threshold), parseInt(limit, 10));
      res.json({ success: true, data: { similar } });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: { code: 'AI_ERROR', message: err.message }
      });
    }
  }));

  // Find duplicates for an idea
  router.get('/ideas/:id/duplicates', asyncHandler(async (req, res) => {
    try {
      const threshold = parseFloat(req.query.threshold) || 0.5;
      const duplicates = ai.findDuplicates(dataDir, req.params.id, threshold);
      res.json({ success: true, data: { duplicates } });
    } catch (err) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }));

  // Get AI insights for an entity
  router.get('/entities/:id/insights', asyncHandler(async (req, res) => {
    try {
      const insights = ai.getInsights(dataDir, req.params.id);
      res.json({ success: true, data: insights });
    } catch (err) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }));

  // Categorize an idea
  router.get('/ideas/:id/categorize', asyncHandler(async (req, res) => {
    try {
      const categorization = ai.categorizeIdea(dataDir, req.params.id);
      res.json({ success: true, data: categorization });
    } catch (err) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: err.message }
      });
    }
  }));

  return router;
}
