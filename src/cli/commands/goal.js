import { Command } from 'commander';
import * as entity from '../../core/entity.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { success, error, formatPriority } from '../format.js';

export function goalCommand() {
  const cmd = new Command('goal')
    .description('Create a new goal')
    .argument('<title>', 'Goal title')
    .option('-g, --gov <gov>', 'Government slug or ID (omit for unfiled)')
    .option('-p, --priority <priority>', 'Priority 0-4 or P0-P4', '2')
    .option('-b, --body <body>', 'Detailed description')
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

        const goal = entity.create(dataDir, 'goal', {
          title,
          gov_id: govId,
          priority: options.priority,
          body: options.body
        });

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: goal }, null, 2));
        } else {
          success(`Created goal: ${goal.title}`, opts);
          console.log(`  ID:       ${goal.id}`);
          console.log(`  Gov:      ${govName ? `${govName} (${govId})` : '(unfiled)'}`);
          console.log(`  Priority: ${formatPriority(goal.priority)}`);
          console.log(`  Status:   ${goal.status}`);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
