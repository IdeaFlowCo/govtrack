import { Command } from 'commander';
import * as ai from '../../core/ai.js';
import * as entity from '../../core/entity.js';
import { requireDataDir } from '../index.js';
import { success, error, info } from '../format.js';

export function classifyCommand() {
  const cmd = new Command('classify')
    .description('Classify text and suggest entity type')
    .argument('<text>', 'Text to classify')
    .option('--create', 'Create the entity after classification')
    .action((text, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const suggestion = ai.suggestEntity(text);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: suggestion }, null, 2));
        } else {
          console.log('\nClassification Result:');
          console.log('─'.repeat(40));
          console.log(`  Suggested type: ${suggestion.suggestedType.toUpperCase()}`);
          console.log(`  Confidence:     ${Math.round(suggestion.confidence * 100)}%`);
          console.log(`  Reasoning:      ${suggestion.reasoning}`);
          console.log();
          console.log('Prefilled data:');
          console.log(`  Title: "${suggestion.prefilledData.title}"`);
          if (suggestion.prefilledData.body) {
            console.log(`  Body:  "${suggestion.prefilledData.body.substring(0, 100)}..."`);
          }
          console.log();

          if (suggestion.alternatives.length > 0) {
            console.log('Alternatives:');
            for (const alt of suggestion.alternatives) {
              console.log(`  - ${alt.type} (score: ${alt.score})`);
            }
          }

          if (options.create) {
            console.log();
            const ent = entity.create(dataDir, suggestion.suggestedType, {
              title: suggestion.prefilledData.title,
              body: suggestion.prefilledData.body
            });
            success(`Created ${suggestion.suggestedType}: ${ent.id}`);
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

export function similarCommand() {
  const cmd = new Command('similar')
    .description('Find similar ideas to given text')
    .argument('<text>', 'Text to find similar ideas for')
    .option('-t, --threshold <num>', 'Similarity threshold (0-1)', '0.3')
    .option('-l, --limit <num>', 'Maximum results', '5')
    .action((text, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const threshold = parseFloat(options.threshold);
        const limit = parseInt(options.limit, 10);
        const similar = ai.findSimilarIdeas(dataDir, text, threshold, limit);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: { similar } }, null, 2));
        } else {
          if (similar.length === 0) {
            info('No similar ideas found');
          } else {
            console.log('\nSimilar Ideas:');
            console.log('─'.repeat(60));
            for (const item of similar) {
              console.log(`  ${item.idea.id}: ${item.idea.title}`);
              console.log(`    Similarity: ${Math.round(item.similarity * 100)}% (matched on ${item.matchedOn})`);
              console.log(`    Status: ${item.idea.status}`);
              console.log();
            }
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

export function duplicatesCommand() {
  const cmd = new Command('duplicates')
    .description('Find potential duplicate ideas')
    .argument('<idea-id>', 'Idea ID to find duplicates for')
    .option('-t, --threshold <num>', 'Similarity threshold (0-1)', '0.5')
    .action((ideaId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const threshold = parseFloat(options.threshold);
        const duplicates = ai.findDuplicates(dataDir, ideaId, threshold);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: { duplicates } }, null, 2));
        } else {
          const idea = entity.find(dataDir, ideaId);
          console.log(`\nDuplicates for: "${idea.title}"`);
          console.log('─'.repeat(60));

          if (duplicates.length === 0) {
            info('No potential duplicates found');
          } else {
            for (const item of duplicates) {
              const label = item.isDuplicate ? '[DUPLICATE]' : item.isSimilar ? '[SIMILAR]' : '';
              console.log(`  ${label} ${item.idea.id}: ${item.idea.title}`);
              console.log(`    Similarity: ${Math.round(item.similarity * 100)}%`);
              console.log(`    Status: ${item.idea.status}`);
              console.log();
            }
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

export function insightsCommand() {
  const cmd = new Command('insights')
    .description('Get AI-powered insights for an entity')
    .argument('<id>', 'Entity ID')
    .action((entityId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const insights = ai.getInsights(dataDir, entityId);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: insights }, null, 2));
        } else {
          console.log(`\nInsights for: "${insights.entity.title}" (${insights.entity.type})`);
          console.log('─'.repeat(60));

          if (insights.recommendations.length === 0) {
            info('No recommendations at this time');
          } else {
            for (const rec of insights.recommendations) {
              console.log(`\n${rec.message}`);
              if (rec.suggestions) {
                for (const sug of rec.suggestions) {
                  console.log(`  - ${sug.id}: ${sug.title}`);
                  console.log(`    Suggested relation: ${sug.relationType}`);
                }
              }
              if (rec.duplicates) {
                for (const dup of rec.duplicates) {
                  const label = dup.isDuplicate ? '[DUPLICATE]' : '[SIMILAR]';
                  console.log(`  ${label} ${dup.id}: ${dup.title} (${Math.round(dup.similarity * 100)}%)`);
                }
              }
            }
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
