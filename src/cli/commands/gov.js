import { Command } from 'commander';
import * as government from '../../core/government.js';
import * as issue from '../../core/issue.js';
import { requireDataDir } from '../index.js';
import { success, error, info, table, header, details, formatGovType, formatDate } from '../format.js';

export function govCommand() {
  const cmd = new Command('gov')
    .description('Manage government entities');

  // gov add
  cmd
    .command('add <name>')
    .description('Create a new government')
    .option('-t, --type <type>', 'Type: city, county, state, federal, district, other', 'city')
    .option('-s, --state <state>', 'State abbreviation (e.g., TX, CA)')
    .option('--slug <slug>', 'Custom URL slug')
    .action((name, options, command) => {
      const opts = command.parent?.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const gov = government.create(dataDir, {
          name,
          type: options.type,
          state: options.state?.toUpperCase(),
          slug: options.slug
        });

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: gov }, null, 2));
        } else {
          success(`Created government: ${gov.name}`, opts);
          console.log(`  ID:    ${gov.id}`);
          console.log(`  Slug:  ${gov.slug}`);
          console.log(`  Type:  ${gov.type}`);
          if (gov.state) console.log(`  State: ${gov.state}`);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  // gov list
  cmd
    .command('list')
    .description('List all governments')
    .option('-t, --type <type>', 'Filter by type')
    .option('-s, --state <state>', 'Filter by state')
    .option('--status <status>', 'Filter by status (active, inactive)')
    .action((options, command) => {
      const opts = command.parent?.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const filters = {};
      if (options.type) filters.type = options.type;
      if (options.state) filters.state = options.state.toUpperCase();
      if (options.status) filters.status = options.status;

      const govs = government.list(dataDir, filters);

      // Get issue counts for each government
      const govsWithCounts = govs.map(g => {
        const counts = issue.getCountsByGov(dataDir, g.id);
        return { ...g, issues: counts.total };
      });

      if (opts.json) {
        console.log(JSON.stringify({ success: true, data: { governments: govsWithCounts, total: govsWithCounts.length } }, null, 2));
        return;
      }

      if (govsWithCounts.length === 0) {
        info('No governments found. Use "govtrack gov add" to create one.', opts);
        return;
      }

      const output = table(govsWithCounts, [
        { key: 'id', label: 'ID', width: 8 },
        { key: 'slug', label: 'SLUG', width: 20 },
        { key: 'name', label: 'NAME', width: 30 },
        { key: 'type', label: 'TYPE', width: 10 },
        { key: 'state', label: 'STATE', width: 6 },
        { key: 'issues', label: 'ISSUES', width: 7 }
      ]);
      console.log(output);
    });

  // gov show
  cmd
    .command('show <id>')
    .description('Show government details')
    .action((id, options, command) => {
      const opts = command.parent?.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const gov = government.find(dataDir, id);
      if (!gov) {
        error(`Government not found: ${id}`);
        process.exit(1);
      }

      const counts = issue.getCountsByGov(dataDir, gov.id);

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          data: { ...gov, issue_count: counts }
        }, null, 2));
        return;
      }

      header(`Government: ${gov.name}`);
      console.log(details({
        'ID': gov.id,
        'Slug': gov.slug,
        'Type': formatGovType(gov.type),
        'State': gov.state || '-',
        'Status': gov.status,
        'Created': formatDate(gov.created_at)
      }));

      console.log('\nIssues:');
      console.log(details({
        'Open': counts.open,
        'In Progress': counts.in_progress,
        'Resolved': counts.resolved,
        'Total': counts.total
      }));
    });

  // gov update
  cmd
    .command('update <id>')
    .description('Update a government')
    .option('--name <name>', 'New name')
    .option('--status <status>', 'New status (active, inactive)')
    .action((id, options, command) => {
      const opts = command.parent?.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const updates = {};
      if (options.name) updates.name = options.name;
      if (options.status) updates.status = options.status;

      if (Object.keys(updates).length === 0) {
        error('No updates specified. Use --name or --status.');
        process.exit(1);
      }

      try {
        const gov = government.update(dataDir, id, updates);
        if (!gov) {
          error(`Government not found: ${id}`);
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: gov }, null, 2));
        } else {
          success(`Updated government: ${gov.name}`, opts);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  // gov delete
  cmd
    .command('delete <id>')
    .description('Delete a government')
    .option('--force', 'Skip confirmation')
    .option('--reassign <gov-id>', 'Reassign issues to another government')
    .option('--unfile', 'Move issues to unfiled (default)')
    .action(async (id, options, command) => {
      const opts = command.parent?.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      const gov = government.find(dataDir, id);
      if (!gov) {
        error(`Government not found: ${id}`);
        process.exit(1);
      }

      const counts = issue.getCountsByGov(dataDir, gov.id);

      // Handle issues
      if (counts.total > 0) {
        const issues = issue.list(dataDir, { gov_id: gov.id });

        if (options.reassign) {
          const targetGov = government.find(dataDir, options.reassign);
          if (!targetGov) {
            error(`Target government not found: ${options.reassign}`);
            process.exit(1);
          }
          // Reassign all issues
          for (const iss of issues) {
            issue.assign(dataDir, iss.id, targetGov.id);
          }
        } else {
          // Unfile all issues
          for (const iss of issues) {
            issue.assign(dataDir, iss.id, null);
          }
        }
      }

      // Delete government
      government.remove(dataDir, gov.id);

      if (opts.json) {
        console.log(JSON.stringify({
          success: true,
          data: { deleted: gov.id, issues_handled: counts.total }
        }, null, 2));
      } else {
        success(`Deleted government: ${gov.name}`, opts);
        if (counts.total > 0) {
          if (options.reassign) {
            console.log(`  ${counts.total} issue(s) reassigned to ${options.reassign}`);
          } else {
            console.log(`  ${counts.total} issue(s) moved to unfiled`);
          }
        }
      }
    });

  return cmd;
}
