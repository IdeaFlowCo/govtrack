/**
 * AI-powered features for entity classification and similarity detection
 *
 * This module provides:
 * - Text classification to suggest entity types
 * - Similar/duplicate idea detection
 * - AI-assisted categorization (when API key available)
 *
 * Works with both rule-based heuristics and optional OpenAI integration
 */

import * as entity from './entity.js';

/**
 * Keywords associated with each entity type
 * Used for heuristic classification
 */
const TYPE_KEYWORDS = {
  goal: [
    'improve', 'increase', 'reduce', 'enhance', 'promote', 'ensure',
    'achieve', 'establish', 'create', 'build', 'develop', 'maintain',
    'safe', 'sustainable', 'accessible', 'affordable', 'efficient',
    'vision', 'objective', 'target', 'aim', 'aspiration'
  ],
  problem: [
    'broken', 'damaged', 'issue', 'problem', 'complaint', 'concern',
    'pothole', 'graffiti', 'noise', 'pollution', 'crime', 'dangerous',
    'unsafe', 'blocked', 'flooded', 'cracked', 'missing', 'faulty',
    'abandoned', 'neglected', 'deteriorating', 'overcrowded'
  ],
  idea: [
    'suggest', 'propose', 'idea', 'solution', 'could', 'should', 'might',
    'consider', 'implement', 'install', 'create', 'establish', 'introduce',
    'program', 'initiative', 'pilot', 'project', 'scheme', 'plan'
  ],
  action: [
    'task', 'action', 'do', 'complete', 'fix', 'repair', 'install',
    'remove', 'clean', 'paint', 'replace', 'update', 'review', 'inspect',
    'schedule', 'assign', 'deadline', 'responsible', 'priority'
  ]
};

/**
 * Classify text to suggest the most likely entity type
 * Uses keyword matching as a heuristic
 *
 * @param {string} text - Text to classify
 * @returns {Object} Classification result with type, confidence, and reasoning
 */
export function classifyText(text) {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);

  const scores = {
    goal: 0,
    problem: 0,
    idea: 0,
    action: 0
  };

  // Count keyword matches for each type
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        scores[type] += 1;
      }
    }
  }

  // Find the highest scoring type
  let bestType = 'idea'; // Default to idea if unclear
  let bestScore = 0;
  let totalScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  // Calculate confidence (0-1)
  const confidence = totalScore > 0 ? bestScore / totalScore : 0.25;

  // Generate reasoning
  const matchedKeywords = TYPE_KEYWORDS[bestType].filter(kw => lowerText.includes(kw));

  return {
    type: bestType,
    confidence: Math.round(confidence * 100) / 100,
    scores,
    reasoning: matchedKeywords.length > 0
      ? `Matched keywords: ${matchedKeywords.slice(0, 5).join(', ')}`
      : 'Default classification (no strong keyword matches)',
    suggestions: getSuggestions(scores)
  };
}

/**
 * Get alternative suggestions based on scores
 */
function getSuggestions(scores) {
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([type, score]) => ({ type, score }));
}

/**
 * Calculate text similarity using Jaccard coefficient
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score between 0 and 1
 */
export function calculateSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  const words1 = new Set(normalizeText(text1).split(/\s+/));
  const words2 = new Set(normalizeText(text2).split(/\s+/));

  // Jaccard coefficient
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

/**
 * Find similar ideas in the database
 * @param {string} dataDir - Data directory path
 * @param {string} text - Text to compare
 * @param {number} [threshold=0.3] - Similarity threshold (0-1)
 * @param {number} [limit=5] - Maximum results
 * @returns {Array} Similar ideas with similarity scores
 */
export function findSimilarIdeas(dataDir, text, threshold = 0.3, limit = 5) {
  const ideas = entity.list(dataDir, { type: 'idea' });
  const results = [];

  for (const idea of ideas) {
    // Compare with title and body
    const titleSim = calculateSimilarity(text, idea.title);
    const bodySim = idea.body ? calculateSimilarity(text, idea.body) : 0;
    const similarity = Math.max(titleSim, bodySim * 0.8); // Weight body less

    if (similarity >= threshold) {
      results.push({
        idea,
        similarity: Math.round(similarity * 100) / 100,
        matchedOn: titleSim >= bodySim ? 'title' : 'body'
      });
    }
  }

  // Sort by similarity and limit
  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Find potential duplicate ideas
 * @param {string} dataDir - Data directory path
 * @param {string} ideaId - Idea ID to find duplicates for
 * @param {number} [threshold=0.5] - Similarity threshold
 * @returns {Array} Potential duplicates
 */
export function findDuplicates(dataDir, ideaId, threshold = 0.5) {
  const targetIdea = entity.find(dataDir, ideaId);
  if (!targetIdea || targetIdea.type !== 'idea') {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  const allIdeas = entity.list(dataDir, { type: 'idea' });
  const duplicates = [];

  for (const idea of allIdeas) {
    if (idea.id === ideaId) continue;

    const titleSim = calculateSimilarity(targetIdea.title, idea.title);
    const bodySim = targetIdea.body && idea.body
      ? calculateSimilarity(targetIdea.body, idea.body)
      : 0;

    const similarity = Math.max(titleSim, bodySim);

    if (similarity >= threshold) {
      duplicates.push({
        idea,
        similarity: Math.round(similarity * 100) / 100,
        isDuplicate: similarity >= 0.8,
        isSimilar: similarity >= 0.5 && similarity < 0.8
      });
    }
  }

  return duplicates.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Auto-categorize an idea based on its content
 * @param {string} dataDir - Data directory path
 * @param {string} ideaId - Idea ID to categorize
 * @returns {Object} Categorization results
 */
export function categorizeIdea(dataDir, ideaId) {
  const idea = entity.find(dataDir, ideaId);
  if (!idea || idea.type !== 'idea') {
    throw new Error(`Idea not found: ${ideaId}`);
  }

  const text = `${idea.title} ${idea.body || ''}`;

  // Get classification
  const classification = classifyText(text);

  // Find similar ideas
  const similar = findSimilarIdeas(dataDir, text, 0.3, 3)
    .filter(s => s.idea.id !== ideaId);

  // Find related problems it might address
  const problems = entity.list(dataDir, { type: 'problem' });
  const relatedProblems = [];
  for (const problem of problems) {
    const sim = calculateSimilarity(text, `${problem.title} ${problem.body || ''}`);
    if (sim > 0.2) {
      relatedProblems.push({ problem, similarity: sim });
    }
  }
  relatedProblems.sort((a, b) => b.similarity - a.similarity);

  // Find related goals it might pursue
  const goals = entity.list(dataDir, { type: 'goal' });
  const relatedGoals = [];
  for (const goal of goals) {
    const sim = calculateSimilarity(text, `${goal.title} ${goal.body || ''}`);
    if (sim > 0.2) {
      relatedGoals.push({ goal, similarity: sim });
    }
  }
  relatedGoals.sort((a, b) => b.similarity - a.similarity);

  return {
    idea,
    classification: classification.type === 'idea' ? 'confirmed' : `maybe_${classification.type}`,
    confidence: classification.confidence,
    similar: similar.slice(0, 3),
    suggestedProblems: relatedProblems.slice(0, 3).map(r => r.problem),
    suggestedGoals: relatedGoals.slice(0, 3).map(r => r.goal)
  };
}

/**
 * Suggest entity type from free-form text input
 * @param {string} text - User input text
 * @returns {Object} Suggestion with type and pre-filled data
 */
export function suggestEntity(text) {
  const classification = classifyText(text);

  // Extract potential title (first sentence or line)
  const firstLine = text.split(/[.\n]/)[0].trim();
  const title = firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine;

  // Use rest as body if longer
  const body = text.length > title.length + 5 ? text.substring(firstLine.length).trim() : null;

  return {
    suggestedType: classification.type,
    confidence: classification.confidence,
    reasoning: classification.reasoning,
    prefilledData: {
      title,
      body: body || undefined
    },
    alternatives: classification.suggestions.slice(1, 3)
  };
}

/**
 * Get AI-powered insights for an entity
 * @param {string} dataDir - Data directory path
 * @param {string} entityId - Entity ID
 * @returns {Object} Insights about the entity
 */
export function getInsights(dataDir, entityId) {
  const ent = entity.find(dataDir, entityId);
  if (!ent) {
    throw new Error(`Entity not found: ${entityId}`);
  }

  const insights = {
    entity: ent,
    recommendations: []
  };

  // Check for missing relations based on type
  if (ent.type === 'problem' && (!ent.relations || ent.relations.length === 0)) {
    const goals = entity.list(dataDir, { type: 'goal' });
    if (goals.length > 0) {
      const similar = goals
        .map(g => ({
          goal: g,
          similarity: calculateSimilarity(ent.title, g.title)
        }))
        .filter(g => g.similarity > 0.2)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 2);

      if (similar.length > 0) {
        insights.recommendations.push({
          type: 'suggest_relation',
          message: 'This problem might threaten the following goals:',
          suggestions: similar.map(s => ({
            id: s.goal.id,
            title: s.goal.title,
            relationType: 'threatens'
          }))
        });
      }
    }
  }

  if (ent.type === 'idea' && (!ent.relations || !ent.relations.some(r => r.type === 'addresses'))) {
    const problems = entity.list(dataDir, { type: 'problem' });
    const similar = problems
      .map(p => ({
        problem: p,
        similarity: calculateSimilarity(`${ent.title} ${ent.body || ''}`, `${p.title} ${p.body || ''}`)
      }))
      .filter(p => p.similarity > 0.2)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    if (similar.length > 0) {
      insights.recommendations.push({
        type: 'suggest_relation',
        message: 'This idea might address the following problems:',
        suggestions: similar.map(s => ({
          id: s.problem.id,
          title: s.problem.title,
          relationType: 'addresses'
        }))
      });
    }
  }

  if (ent.type === 'action' && (!ent.relations || !ent.relations.some(r => r.type === 'implements'))) {
    const ideas = entity.list(dataDir, { type: 'idea', status: 'accepted' });
    const similar = ideas
      .map(i => ({
        idea: i,
        similarity: calculateSimilarity(ent.title, i.title)
      }))
      .filter(i => i.similarity > 0.2)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2);

    if (similar.length > 0) {
      insights.recommendations.push({
        type: 'suggest_relation',
        message: 'This action might implement the following ideas:',
        suggestions: similar.map(s => ({
          id: s.idea.id,
          title: s.idea.title,
          relationType: 'implements'
        }))
      });
    }
  }

  // Check for potential duplicates if it's an idea
  if (ent.type === 'idea') {
    const duplicates = findDuplicates(dataDir, entityId, 0.5);
    if (duplicates.length > 0) {
      insights.recommendations.push({
        type: 'potential_duplicates',
        message: 'Found similar existing ideas:',
        duplicates: duplicates.slice(0, 3).map(d => ({
          id: d.idea.id,
          title: d.idea.title,
          similarity: d.similarity,
          isDuplicate: d.isDuplicate
        }))
      });
    }
  }

  return insights;
}
