import { Command } from 'commander';
import * as entity from '../../core/entity.js';
import * as government from '../../core/government.js';
import { requireDataDir } from '../index.js';
import { success, error, formatPriority } from '../format.js';

export function actionCommand() {
  const cmd = new Command('action')
    .description('Create a new action')
    .argument('<title>', 'Action title')
    .option('-g, --gov <gov>', 'Government slug or ID (omit for unfiled)')
    .option('-p, --priority <priority>', 'Priority 0-4 or P0-P4', '2')
    .option('-b, --body <body>', 'Detailed description')
    .option('--implements <idea-id>', 'Idea this action implements')
    .option('--depends-on <action-id>', 'Action this depends on')
    .option('--assignee <assignee>', 'Person assigned to this action')
    .option('--due <date>', 'Due date (ISO format)')
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
        if (options.implements) {
          const idea = entity.find(dataDir, options.implements);
          if (!idea) {
            error(`Idea not found: ${options.implements}`);
            process.exit(1);
          }
          if (idea.type !== 'idea') {
            error(`Entity ${options.implements} is not an idea (type: ${idea.type})`);
            process.exit(1);
          }
          relations.push({ type: 'implements', target: options.implements });
        }
        if (options.dependsOn) {
          const dep = entity.find(dataDir, options.dependsOn);
          if (!dep) {
            error(`Action not found: ${options.dependsOn}`);
            process.exit(1);
          }
          if (dep.type !== 'action') {
            error(`Entity ${options.dependsOn} is not an action (type: ${dep.type})`);
            process.exit(1);
          }
          relations.push({ type: 'depends_on', target: options.dependsOn });
        }

        const action = entity.create(dataDir, 'action', {
          title,
          gov_id: govId,
          priority: options.priority,
          body: options.body,
          relations,
          assignee: options.assignee || null,
          due_date: options.due || null
        });

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: action }, null, 2));
        } else {
          success(`Created action: ${action.title}`, opts);
          console.log(`  ID:       ${action.id}`);
          console.log(`  Gov:      ${govName ? `${govName} (${govId})` : '(unfiled)'}`);
          console.log(`  Priority: ${formatPriority(action.priority)}`);
          console.log(`  Status:   ${action.status}`);
          if (options.assignee) {
            console.log(`  Assignee: ${options.assignee}`);
          }
          if (options.due) {
            console.log(`  Due:      ${options.due}`);
          }
          if (options.implements) {
            console.log(`  Implements: ${options.implements}`);
          }
          if (options.dependsOn) {
            console.log(`  Depends on: ${options.dependsOn}`);
          }
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}
