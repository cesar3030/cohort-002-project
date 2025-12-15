# Scripts

## copy-eng-docs.ts

This script synchronizes markdown documentation files from the [busbud/eng-docs](https://github.com/busbud/eng-docs) repository into the local project.

### What it does

The script clones the eng-docs repository and processes all markdown files (excluding the root README.md) to create uniquely named copies in the `data/eng-docs/` directory.

**File naming convention:**
- Files are renamed using a structured format: `{team}_{path}_{filename}_{hash}.md`
- The team name is extracted from the parent folder of the `/docs` directory
- The path represents the directory structure after the `/docs` level
- The original filename is preserved (converted to lowercase kebab-case)
- A content-based hash is appended at the end to ensure uniqueness

**Smart file management:**
- **New files**: Files that don't exist locally are added
- **Updated files**: Files that exist but have different content (different hash) are replaced with the new version
- **Unchanged files**: Files that already exist with the same hash are skipped to avoid unnecessary work

**Output:**
- All processed files are saved to `data/eng-docs/`
- The script provides a summary showing how many files were added, replaced, and skipped

### Usage

Run the script using npm:

```bash
pnpm run copy-eng-docs
```

### Requirements

- Node.js installed
- Git installed (for cloning the repository)
- Network access to GitHub

