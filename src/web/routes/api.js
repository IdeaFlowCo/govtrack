import { Router } from 'express';
import * as government from '../../core/government.js';
import * as issue from '../../core/issue.js';

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

  return router;
}
