import { Command } from 'commander';
import * as entity from '../../core/entity.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { success, error, formatPriority } from '../format.js';

export function ideaCommand() {
  const cmd = new Command('idea')
    .description('Create a new idea')
    .argument('<title>', 'Idea title')
    .option('-g, --gov <gov>', 'Government slug or ID (omit for unfiled)')
    .option('-p, --priority <priority>', 'Priority 0-4 or P0-P4', '2')
    .option('-b, --body <body>', 'Detailed description')
    .option('--addresses <problem-id>', 'Problem this idea addresses')
    .option('--pursues <goal-id>', 'Goal this idea pursues')
    .action((title, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        // Resolve government
        let govId = null;
        let govName = null;
        if (options.gov) {
          const gov = government.find(dataDir, options.gov);
          if (!gov) {
            error(`Government not found: ${options.gov}`);
            process.exit(1);
          }
          govId = gov.id;
          govName = gov.name;
        }

        // Build relations
        const relations = [];
        if (options.addresses) {
          const problem = entity.find(dataDir, options.addresses);
          if (!problem) {
            error(`Problem not found: ${options.addresses}`);
            process.exit(1);
          }
          if (problem.type !== 'problem') {
            error(`Entity ${options.addresses} is not a problem (type: ${problem.type})`);
            process.exit(1);
          }
          relations.push({ type: 'addresses', target: options.addresses });
        }
        if (options.pursues) {
          const goal = entity.find(dataDir, options.pursues);
          if (!goal) {
            error(`Goal not found: ${options.pursues}`);
            process.exit(1);
          }
          if (goal.type !== 'goal') {
            error(`Entity ${options.pursues} is not a goal (type: ${goal.type})`);
            process.exit(1);
          }
          relations.push({ type: 'pursues', target: options.pursues });
        }

        const idea = entity.create(dataDir, 'idea', {
          title,
          gov_id: govId,
          priority: options.priority,
          body: options.body,
          relations
        });

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: idea }, null, 2));
        } else {
          success(`Created idea: ${idea.title}`, opts);
          console.log(`  ID:       ${idea.id}`);
          console.log(`  Gov:      ${govName ? `${govName} (${govId})` : '(unfiled)'}`);
          console.log(`  Priority: ${formatPriority(idea.priority)}`);
          console.log(`  Status:   ${idea.status}`);
          if (options.addresses) {
            console.log(`  Addresses: ${options.addresses}`);
          }
          if (options.pursues) {
            console.log(`  Pursues: ${options.pursues}`);
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

export function supportCommand() {
  const cmd = new Command('support')
    .description('Add support to an idea')
    .argument('<idea-id>', 'Idea ID to support')
    .option('--user <user>', 'User identifier', 'anonymous')
    .action((ideaId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const updated = entity.addSupport(dataDir, ideaId, options.user);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: updated }, null, 2));
        } else {
          success(`Added support to idea: ${updated.title}`, opts);
          console.log(`  Support count: ${updated.support_count}`);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
