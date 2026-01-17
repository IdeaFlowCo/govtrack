import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { success, error } from '../format.js';

export function initCommand() {
  const cmd = new Command('init')
    .description('Initialize a new GovTrack instance')
    .option('--force', 'Overwrite existing .govtrack directory')
    .option('--no-cache', 'Disable SQLite caching')
    .action((options, command) => {
      const opts = command.parent?._globalOpts || {};
      const cwd = process.cwd();
      const dataDir = join(cwd, '.govtrack');

      // Check if already initialized
      if (existsSync(dataDir) && !options.force) {
        error('Already initialized. Use --force to reinitialize.');
        process.exit(1);
      }

      try {
        // Create directory
        mkdirSync(dataDir, { recursive: true });

        // Create empty JSONL files
        writeFileSync(join(dataDir, 'governments.jsonl'), '', 'utf8');
        writeFileSync(join(dataDir, 'issues.jsonl'), '', 'utf8');

        // Create config
        const config = {
          version: '1.0.0',
          cache_enabled: options.cache !== false,
          default_priority: 2,
          default_issue_type: 'report',
          web_port: 3000,
          web_host: 'localhost'
        };
        writeFileSync(join(dataDir, 'config.json'), JSON.stringify(config, null, 2), 'utf8');

        // Create gitignore for cache
        writeFileSync(join(dataDir, '.gitignore'), 'cache.db\n', 'utf8');

        if (opts.json) {
          console.log(JSON.stringify({
            success: true,
            path: dataDir,
            files: ['governments.jsonl', 'issues.jsonl', 'config.json']
          }, null, 2));
        } else {
          success('Initialized GovTrack in .govtrack/', opts);
          console.log('  - governments.jsonl (empty)');
          console.log('  - issues.jsonl (empty)');
          console.log('  - config.json (defaults)');
        }
      } catch (err) {
        error(`Failed to initialize: ${err.message}`);
        process.exit(1);
      }
    });

  return cmd;
}
