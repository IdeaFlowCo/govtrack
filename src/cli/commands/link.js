import { Command } from 'commander';
import * as relation from '../../core/relation.js';
import * as entity from '../../core/entity.js';
import { requireDataDir } from '../index.js';
import { success, error, info } from '../format.js';

export function linkCommand() {
  const cmd = new Command('link')
    .description('Create a relationship between two entities')
    .argument('<source>', 'Source entity ID')
    .argument('<type>', 'Relation type (e.g., threatens, addresses, implements, depends_on)')
    .argument('<target>', 'Target entity ID')
    .action((sourceId, relationType, targetId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        // Validate source exists
        const source = entity.find(dataDir, sourceId);
        if (!source) {
          error(`Source entity not found: ${sourceId}`);
          process.exit(1);
        }

        // Validate target exists
        const target = entity.find(dataDir, targetId);
        if (!target) {
          error(`Target entity not found: ${targetId}`);
          process.exit(1);
        }

        // Create the link
        const updated = relation.link(dataDir, sourceId, relationType, targetId);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: updated }, null, 2));
        } else {
          success(`Linked: ${source.title} --[${relationType}]--> ${target.title}`, opts);
          console.log(`  Source: ${sourceId} (${source.type})`);
          console.log(`  Target: ${targetId} (${target.type})`);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

export function unlinkCommand() {
  const cmd = new Command('unlink')
    .description('Remove a relationship between two entities')
    .argument('<source>', 'Source entity ID')
    .argument('<type>', 'Relation type')
    .argument('<target>', 'Target entity ID')
    .action((sourceId, relationType, targetId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const updated = relation.unlink(dataDir, sourceId, relationType, targetId);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: updated }, null, 2));
        } else {
          success(`Unlinked: ${sourceId} --[${relationType}]--> ${targetId}`, opts);
        }
      } catch (err) {
        error(err.message);
        process.exit(1);
      }
    });

  return cmd;
}

export function relationsCommand() {
  const cmd = new Command('relations')
    .description('Show all relations for an entity')
    .argument('<id>', 'Entity ID')
    .action((entityId, options, command) => {
      const opts = command.parent?._globalOpts || {};
      const dataDir = requireDataDir();

      try {
        const ent = entity.find(dataDir, entityId);
        if (!ent) {
          error(`Entity not found: ${entityId}`);
          process.exit(1);
        }

        const rels = relation.getRelations(dataDir, entityId);

        if (opts.json) {
          console.log(JSON.stringify({ success: true, data: { entity: ent, ...rels } }, null, 2));
        } else {
          console.log(`\nRelations for: ${ent.title} (${entityId})`);
          console.log(`Type: ${ent.type} | Status: ${ent.status}\n`);

          if (rels.outgoing.length > 0) {
            console.log('Outgoing relations (from this entity):');
            for (const rel of rels.outgoing) {
              const targetTitle = rel.targetEntity ? rel.targetEntity.title : '(deleted)';
              console.log(`  --[${rel.type}]--> ${rel.target}: ${targetTitle}`);
            }
            console.log();
          }

          if (rels.incoming.length > 0) {
            console.log('Incoming relations (to this entity):');
            for (const rel of rels.incoming) {
              const sourceTitle = rel.sourceEntity ? rel.sourceEntity.title : '(deleted)';
              console.log(`  <--[${rel.type}]-- ${rel.source}: ${sourceTitle}`);
            }
            console.log();
          }

          if (rels.outgoing.length === 0 && rels.incoming.length === 0) {
            info('No relations found');
          }

          // Show blocked status for actions
          if (ent.type === 'action') {
            const blocked = relation.isBlocked(dataDir, entityId);
            if (blocked.blocked) {
              console.log('BLOCKED by:');
              for (const blocker of blocked.blockers) {
                console.log(`  - ${blocker.id}: ${blocker.title} (${blocker.status})`);
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
