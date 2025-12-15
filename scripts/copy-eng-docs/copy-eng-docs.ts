#!/usr/bin/env node

import { execSync } from "child_process";
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  copyFileSync,
  rmSync,
} from "fs";
import { join, relative, basename } from "path";

const REPO_URL = "https://github.com/busbud/eng-docs";
const TEMP_DIR = join(process.cwd(), ".temp-eng-docs");
const OUTPUT_DIR = join(process.cwd(), "data", "eng-docs");

/**
 * Converts a string to kebab-case lowercase
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen between lowercase and uppercase
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/[^\w-]/g, "") // Remove non-word characters except hyphens
    .toLowerCase()
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Calculates SHA-256 hash of file content
 */
function calculateHash(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 12);
}

/**
 * Recursively finds all markdown files in a directory
 */
function findMarkdownFiles(dir: string, baseDir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath, baseDir));
    } else if (stat.isFile() && entry.endsWith(".md")) {
      // Skip root README.md
      const relativePath = relative(baseDir, fullPath);
      if (relativePath !== "README.md") {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Extracts the team name (parent folder of /docs) and path prefix after /docs level
 */
function extractTeamNameAndPathPrefix(
  filePath: string,
  repoRoot: string
): { teamName: string; pathPrefix: string } {
  const relativePath = relative(repoRoot, filePath);
  const parts = relativePath.split(/[/\\]/);

  // Find the index of "docs" directory
  const docsIndex = parts.findIndex((part) => part.toLowerCase() === "docs");

  if (docsIndex === -1) {
    // If no docs directory found, use the directory structure from root
    // Remove the filename and use the directory path
    const dirParts = parts.slice(0, -1);
    return {
      teamName: "",
      pathPrefix: dirParts.length > 0 ? dirParts.join("/") : "",
    };
  }

  // Get team name (parent folder of docs)
  const teamName = docsIndex > 0 ? parts[docsIndex - 1] : "";

  // Get all parts after docs directory (excluding the filename)
  const pathAfterDocs = parts.slice(docsIndex + 1, -1);
  return {
    teamName,
    pathPrefix: pathAfterDocs.join("/"),
  };
}

/**
 * Removes duplicate parts from an array of filename parts
 * Keeps only the first occurrence of each part
 */
function removeDuplicateParts(parts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of parts) {
    if (part && !seen.has(part)) {
      seen.add(part);
      result.push(part);
    }
  }

  return result;
}

/**
 * Finds existing file with the same name pattern (excluding hash)
 * Returns the hash from the existing file if found, null otherwise
 */
function findExistingFileHash(
  namePartsWithoutHash: string[],
  outputDir: string
): string | null {
  if (!existsSync(outputDir)) {
    return null;
  }

  const files = readdirSync(outputDir);
  const namePattern = namePartsWithoutHash.join("_");

  // Look for files matching the pattern: {nameParts}_{hash}.md
  // where hash is exactly 12 hex characters
  const expectedPartsCount = namePartsWithoutHash.length + 1; // name parts + hash

  for (const file of files) {
    if (!file.endsWith(".md")) {
      continue;
    }

    // Remove .md extension
    const nameWithoutExt = file.slice(0, -3);

    // Split by underscore
    const parts = nameWithoutExt.split("_");

    // Must have exactly: nameParts + hash (1 more part than nameParts)
    if (parts.length !== expectedPartsCount) {
      continue;
    }

    // Check if all parts except the last match our pattern
    const filePartsWithoutHash = parts.slice(0, -1);
    const filePattern = filePartsWithoutHash.join("_");

    if (filePattern === namePattern) {
      // The last part should be the hash
      const hash = parts[parts.length - 1];
      // Validate hash format (12 hex characters)
      if (/^[a-f0-9]{12}$/i.test(hash)) {
        return hash;
      }
    }
  }

  return null;
}

/**
 * Main function
 */
function main() {
  console.log("🚀 Starting eng-docs copy process...");

  try {
    // Clean up temp directory if it exists
    if (existsSync(TEMP_DIR)) {
      console.log("🧹 Cleaning up existing temp directory...");
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    // Clone the repository
    console.log(`📥 Cloning repository from ${REPO_URL}...`);
    execSync(`git clone --depth 1 ${REPO_URL} "${TEMP_DIR}"`, {
      stdio: "inherit",
    });

    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Find all markdown files
    console.log("🔍 Finding markdown files...");
    const markdownFiles = findMarkdownFiles(TEMP_DIR, TEMP_DIR);
    console.log(`📄 Found ${markdownFiles.length} markdown files`);

    // Process each file
    let processedCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    let addedCount = 0;

    for (const filePath of markdownFiles) {
      const content = readFileSync(filePath);
      const hash = calculateHash(content);
      const { teamName, pathPrefix } = extractTeamNameAndPathPrefix(
        filePath,
        TEMP_DIR
      );
      const originalName = basename(filePath, ".md");

      // Convert team name to kebab-case
      const kebabTeamName = toKebabCase(teamName);

      // Build filename parts array (hash will be added at the end)
      const filenameParts: string[] = [];
      if (kebabTeamName) {
        filenameParts.push(kebabTeamName);
      }

      // Process path prefix: split by directory separator, convert each part to kebab-case
      if (pathPrefix) {
        const pathDirParts = pathPrefix.split("/");
        for (const dirPart of pathDirParts) {
          const kebabDirPart = toKebabCase(dirPart);
          if (kebabDirPart) {
            filenameParts.push(kebabDirPart);
          }
        }
      }

      // Process original filename: convert to kebab-case
      const kebabOriginalName = toKebabCase(originalName);
      if (kebabOriginalName) {
        filenameParts.push(kebabOriginalName);
      }

      // Remove duplicate parts (keeping first occurrence)
      const uniqueParts = removeDuplicateParts(filenameParts);

      // Check if file with same name pattern already exists
      const existingHash = findExistingFileHash(uniqueParts, OUTPUT_DIR);

      if (existingHash !== null) {
        if (existingHash === hash) {
          // File exists with same hash, skip it
          skippedCount++;
          console.log(
            `⏭️  Skipped (same hash): ${relative(TEMP_DIR, filePath)}`
          );
          continue;
        } else {
          // File exists with different hash, replace it
          const oldFileName = `${uniqueParts.join("_")}_${existingHash}.md`;
          const oldFilePath = join(OUTPUT_DIR, oldFileName);
          if (existsSync(oldFilePath)) {
            rmSync(oldFilePath);
          }
          replacedCount++;
        }
      } else {
        addedCount++;
      }

      // Add hash as the last part
      uniqueParts.push(hash);

      // Build new filename
      const newFileName = `${uniqueParts.join("_")}.md`;

      const outputPath = join(OUTPUT_DIR, newFileName);

      // Copy file with new name
      copyFileSync(filePath, outputPath);
      processedCount++;

      const action = existingHash !== null ? "Replaced" : "Added";
      console.log(
        `✅ ${action}: ${relative(TEMP_DIR, filePath)} -> ${newFileName}`
      );
    }

    console.log(`\n✨ Successfully processed ${processedCount} files`);
    console.log(`   📥 Added: ${addedCount}`);
    console.log(`   🔄 Replaced: ${replacedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

    // Clean up temp directory
    console.log("🧹 Cleaning up temp directory...");
    rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log("🎉 Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();

