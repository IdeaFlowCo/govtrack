# GovTrack CLI Command Specification

## Overview

The `govtrack` CLI provides all functionality for managing governments and issues. Commands follow a noun-verb pattern where applicable.

## Global Options

```
--help, -h        Show help for command
--version, -v     Show version number
--json            Output in JSON format (for scripting)
--quiet, -q       Suppress non-essential output
--verbose         Show detailed operation info
```

## Initialization

### `govtrack init`

Initialize a new GovTrack instance in the current directory.

```bash
govtrack init [options]

Options:
  --force         Overwrite existing .govtrack directory
  --no-cache      Disable SQLite caching

Examples:
  govtrack init
  govtrack init --force
```

**Output:**
```
✓ Initialized GovTrack in .govtrack/
  - governments.jsonl (empty)
  - issues.jsonl (empty)
  - config.json (defaults)
```

**Exit Codes:**
- 0: Success
- 1: Already initialized (use --force)
- 1: Permission denied

---

## Government Commands

### `govtrack gov add`

Create a new government entity.

```bash
govtrack gov add <name> [options]

Arguments:
  name            Government name (required)

Options:
  --type, -t      Type: city, county, state, federal, district, other (default: city)
  --state, -s     State abbreviation (e.g., TX, CA)
  --slug          Custom slug (auto-generated from name if omitted)

Examples:
  govtrack gov add "City of Austin" --type city --state TX
  govtrack gov add "Travis County" --type county --state TX
  govtrack gov add "Austin ISD" --type district --state TX --slug aisd
```

**Output:**
```
✓ Created government: City of Austin
  ID:    gt-a1b2
  Slug:  city-of-austin
  Type:  city
  State: TX
```

**Validation:**
- Name must be 1-200 characters
- Type must be valid enum value
- State must be 2-letter code (if provided)
- Slug must be unique

---

### `govtrack gov list`

List all governments.

```bash
govtrack gov list [options]

Options:
  --type, -t      Filter by type
  --state, -s     Filter by state
  --status        Filter by status (active, inactive)

Examples:
  govtrack gov list
  govtrack gov list --type city
  govtrack gov list --state TX
  govtrack gov list --json
```

**Output:**
```
ID        SLUG              NAME                  TYPE      STATE   ISSUES
gt-a1b2   city-of-austin    City of Austin        city      TX      12
gt-c3d4   travis-county     Travis County         county    TX      5
gt-e5f6   austin-isd        Austin ISD            district  TX      3
```

---

### `govtrack gov show`

Show details for a specific government.

```bash
govtrack gov show <id-or-slug>

Arguments:
  id-or-slug      Government ID (gt-xxx) or slug

Examples:
  govtrack gov show gt-a1b2
  govtrack gov show city-of-austin
```

**Output:**
```
Government: City of Austin
━━━━━━━━━━━━━━━━━━━━━━━━━━
ID:       gt-a1b2
Slug:     city-of-austin
Type:     city
State:    TX
Status:   active
Created:  2026-01-16T10:30:00Z

Issues:
  Open:        8
  In Progress: 3
  Resolved:    1
  Total:       12
```

---

### `govtrack gov update`

Update a government's properties.

```bash
govtrack gov update <id-or-slug> [options]

Options:
  --name          New name
  --status        New status (active, inactive)

Examples:
  govtrack gov update gt-a1b2 --status inactive
  govtrack gov update city-of-austin --name "City of Austin, Texas"
```

---

### `govtrack gov delete`

Delete a government (requires confirmation or --force).

```bash
govtrack gov delete <id-or-slug> [options]

Options:
  --force         Skip confirmation
  --reassign      Reassign issues to another government
  --unfile        Move issues to unfiled (default)

Examples:
  govtrack gov delete gt-a1b2
  govtrack gov delete gt-a1b2 --reassign gt-c3d4
```

---

## Issue Commands

### `govtrack issue`

Create a new issue (shorthand for `govtrack issue create`).

```bash
govtrack issue <title> [options]

Arguments:
  title           Issue title (required)

Options:
  --gov, -g       Government slug or ID (omit for unfiled)
  --priority, -p  Priority 0-4 or P0-P4 (default: 2)
  --type, -t      Type: report, request, complaint, other (default: report)
  --body, -b      Detailed description
  --location, -l  Location/address

Examples:
  govtrack issue "Pothole on Main St" --gov austin --priority 1
  govtrack issue "General complaint about services"
  govtrack issue "Broken streetlight" --gov austin -p P1 -l "123 Oak Ave"
  govtrack issue "Need new stop sign" --gov austin --type request
```

**Output:**
```
✓ Created issue: Pothole on Main St
  ID:       gi-x1y2
  Gov:      City of Austin (gt-a1b2)
  Priority: P1
  Status:   open
```

---

### `govtrack issue list` / `govtrack list`

List issues with filtering.

```bash
govtrack list [options]

Options:
  --gov, -g       Filter by government (slug or ID)
  --unfiled       Show only unfiled issues
  --status, -s    Filter by status (open, in_progress, resolved, closed)
  --priority, -p  Filter by priority
  --type, -t      Filter by type
  --limit, -n     Limit results (default: 50)
  --all           Show all (no limit)

Examples:
  govtrack list
  govtrack list --gov austin
  govtrack list --unfiled
  govtrack list --status open --priority 1
  govtrack list --all --json
```

**Output:**
```
ID        PRIORITY  STATUS       GOVERNMENT         TITLE
gi-x1y2   P1        open         city-of-austin     Pothole on Main St
gi-z3w4   P2        in_progress  city-of-austin     Broken streetlight
gi-a5b6   P2        open         (unfiled)          General complaint
```

---

### `govtrack show`

Show detailed information about an issue.

```bash
govtrack show <id>

Arguments:
  id              Issue ID (gi-xxx)

Examples:
  govtrack show gi-x1y2
```

**Output:**
```
Issue: Pothole on Main St
━━━━━━━━━━━━━━━━━━━━━━━━━━
ID:        gi-x1y2
Status:    open
Priority:  P1
Type:      report
Government: City of Austin (gt-a1b2)
Location:  123 Main St
Created:   2026-01-16T10:30:00Z
Updated:   2026-01-16T10:30:00Z

Description:
Large pothole approximately 2 feet wide near the intersection
with Oak Street. Hazardous to vehicles.

History:
  2026-01-16 10:30  Created (open)
```

---

### `govtrack update`

Update an issue's properties.

```bash
govtrack update <id> [options]

Options:
  --status, -s    New status
  --priority, -p  New priority
  --title         New title
  --body          New description

Examples:
  govtrack update gi-x1y2 --status in_progress
  govtrack update gi-x1y2 --priority P0 --status in_progress
```

---

### `govtrack assign`

Assign an issue to a government (or unfile it).

```bash
govtrack assign <issue-id> <gov-id-or-slug>
govtrack assign <issue-id> --unfile

Arguments:
  issue-id        Issue ID (gi-xxx)
  gov-id-or-slug  Government to assign to

Options:
  --unfile        Remove government assignment

Examples:
  govtrack assign gi-a5b6 city-of-austin
  govtrack assign gi-x1y2 --unfile
```

---

### `govtrack close`

Close an issue.

```bash
govtrack close <id> [options]

Options:
  --reason, -r    Reason for closing
  --wont-fix      Mark as won't fix instead of resolved

Examples:
  govtrack close gi-x1y2
  govtrack close gi-x1y2 --reason "Repaired on 2026-01-15"
  govtrack close gi-z3w4 --wont-fix --reason "Duplicate of gi-x1y2"
```

---

### `govtrack reopen`

Reopen a closed issue.

```bash
govtrack reopen <id>

Examples:
  govtrack reopen gi-x1y2
```

---

## Web Server Command

### `govtrack serve`

Start the web interface server.

```bash
govtrack serve [options]

Options:
  --port, -p      Port number (default: 3000)
  --host, -H      Host to bind (default: localhost)
  --open, -o      Open browser automatically

Examples:
  govtrack serve
  govtrack serve --port 8080
  govtrack serve --host 0.0.0.0 --port 3000
```

**Output:**
```
✓ GovTrack web interface running
  Local:   http://localhost:3000

Press Ctrl+C to stop
```

---

## Utility Commands

### `govtrack stats`

Show statistics about the tracker.

```bash
govtrack stats

Examples:
  govtrack stats
  govtrack stats --json
```

**Output:**
```
GovTrack Statistics
━━━━━━━━━━━━━━━━━━━
Governments:     5
Total Issues:    47

By Status:
  Open:          23
  In Progress:   12
  Resolved:      8
  Closed:        4

By Priority:
  P0 (Critical): 2
  P1 (High):     8
  P2 (Medium):   25
  P3 (Low):      10
  P4 (Backlog):  2

Unfiled Issues:  3
```

---

### `govtrack search`

Search issues by text.

```bash
govtrack search <query> [options]

Options:
  --gov, -g       Limit to specific government

Examples:
  govtrack search "pothole"
  govtrack search "streetlight" --gov austin
```

---

### `govtrack export`

Export data to various formats.

```bash
govtrack export [options]

Options:
  --format, -f    Format: json, csv (default: json)
  --output, -o    Output file (default: stdout)
  --issues        Export issues only
  --governments   Export governments only

Examples:
  govtrack export --format csv -o issues.csv
  govtrack export --governments --format json
```

---

### `govtrack import`

Import data from external sources.

```bash
govtrack import <file> [options]

Options:
  --format, -f    Format: json, csv (auto-detected from extension)
  --merge         Merge with existing (default: fail on conflict)

Examples:
  govtrack import issues.csv
  govtrack import data.json --merge
```
