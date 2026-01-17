import { Command } from 'commander';
import * as entity from '../../core/entity.js';
import * as relation from '../../core/relation.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { success, error, formatPriority } from '../format.js';

export function problemCommand() {
  const cmd = new Command('problem')
    .description('Create a new problem')
    .argument('<title>', 'Problem title')
    .option('-g, --gov <gov>', 'Government slug or ID (omit for unfiled)')
    .option('-p, --priority <priority>', 'Priority 0-4 or P0-P4', '2')
    .option('-b, --body <body>', 'Detailed description')
    .option('-l, --location <address>', 'Location/address')
    .option('--threatens <goal-id>', 'Goal this problem threatens')
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
        if (options.threatens) {
          // Validate goal exists
          const goal = entity.find(dataDir, options.threatens);
          if (!goal) {
            error(`Goal not found: ${options.threatens}`);
            process.exit(1);
          }
          if (goal.type !== 'goal') {
            error(`Entity ${options.threatens} is not a goal (type: ${goal.type})`);
            process.exit(1);
          }
          relations.push({ type: 'threatens', target: options.threatens });
        }

        const problem = entity.create(dataDir, 'problem', {
          title,
          gov_id: govId,
          priority: options.priority,
          body: options.body,
          location: options.location ? { address: options.location } : null,
          relations
        });

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: problem }, null, 2));
        } else {
          success(`Created problem: ${problem.title}`, opts);
          console.log(`  ID:       ${problem.id}`);
          console.log(`  Gov:      ${govName ? `${govName} (${govId})` : '(unfiled)'}`);
          console.log(`  Priority: ${formatPriority(problem.priority)}`);
          console.log(`  Status:   ${problem.status}`);
          if (options.location) {
            console.log(`  Location: ${options.location}`);
          }
          if (options.threatens) {
            console.log(`  Threatens: ${options.threatens}`);
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
