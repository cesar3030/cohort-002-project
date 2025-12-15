# Scripts

## import-eng-docs.ts

This script synchronizes markdown documentation files from the [busbud/eng-docs](https://github.com/busbud/eng-docs) repository into the local project.

### What it does

The script clones the eng-docs repository and processes all markdown files (excluding the root README.md) to create a single JSON file containing all documentation entries in the `data/eng-docs/` directory.

**Output format:**
The script creates a `eng-docs.json` file containing an array of objects, where each object represents a markdown file with the following properties:
- **id**: The file path identifier (team_path_filename format, without hash)
- **hash**: Content-based hash of the file (12-character SHA-256)
- **importedAt**: ISO timestamp of when the file was imported
- **content**: The full markdown content of the file
- **team**: The team name extracted from the parent folder of the `/docs` directory
- **keywords**: Array of words extracted from the file path for searchability

**Smart file management:**
- **New files**: Files that don't exist in the JSON (by id) are added
- **Updated files**: Files that exist but have different content (different hash) are updated with the new version
- **Unchanged files**: Files that already exist with the same hash are skipped to avoid unnecessary work

**Output:**
- All processed files are consolidated into `data/eng-docs/eng-docs.json`
- The script provides a summary showing how many files were added, replaced, and skipped

### Usage

Run the script using npm:

```bash
pnpm run import-eng-docs
```

### Requirements

- Node.js installed
- Git installed (for cloning the repository)
- Network access to GitHub

