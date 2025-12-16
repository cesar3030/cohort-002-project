#!/usr/bin/env node

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });

import { execSync } from "child_process";
import { createHash } from "crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  rmSync,
} from "fs";
import { join, relative, basename } from "path";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";

const REPO_URL = "https://github.com/busbud/eng-docs";
const TEMP_DIR = join(process.cwd(), ".temp-eng-docs");
const OUTPUT_DIR = join(process.cwd(), "data", "eng-docs");
const OUTPUT_FILE = join(OUTPUT_DIR, "eng-docs.json");

interface DocEntry {
  id: string;
  hash: string;
  importedAt: string;
  content: string;
  team: string;
  keywords: string[];
  filename: string;
  embedding: number[];
}

const EMBEDDING_MODEL = "text-embedding-004";

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
 * Extracts keywords from a path string
 * Splits by various separators and converts to lowercase words
 * Removes duplicates and excludes the team name
 */
function extractKeywords(path: string, teamName: string): string[] {
  if (!path) {
    return [];
  }

  // Split by common separators: /, \, -, _, spaces
  const words = path
    .split(/[/\\\-_\s]+/)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length > 0);

  // Remove team name from keywords
  const teamNameLower = teamName.toLowerCase();
  const filteredWords = words.filter((word) => word !== teamNameLower);

  // Remove duplicates
  const uniqueWords = Array.from(new Set(filteredWords));

  return uniqueWords;
}

/**
 * Loads existing entries from JSON file
 */
function loadExistingEntries(): DocEntry[] {
  if (!existsSync(OUTPUT_FILE)) {
    return [];
  }

  try {
    const content = readFileSync(OUTPUT_FILE, "utf-8");
    const entries = JSON.parse(content) as DocEntry[];
    // Ensure all entries have embedding property (for backwards compatibility)
    return entries.map((entry) => ({
      ...entry,
      embedding: entry.embedding || [],
    }));
  } catch (error) {
    console.warn("⚠️  Could not parse existing JSON file, starting fresh");
    return [];
  }
}

/**
 * Finds existing entry by id
 */
function findExistingEntry(
  entries: DocEntry[],
  id: string
): DocEntry | undefined {
  return entries.find((entry) => entry.id === id);
}

/**
 * Main function
 */
async function main() {
  console.log("🚀 Starting eng-docs import process...");

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

    // Load existing entries
    const existingEntries = loadExistingEntries();
    const entriesMap = new Map<string, DocEntry>();
    existingEntries.forEach((entry) => {
      entriesMap.set(entry.id, entry);
    });

    // Find all markdown files
    console.log("🔍 Finding markdown files...");
    const markdownFiles = findMarkdownFiles(TEMP_DIR, TEMP_DIR);
    console.log(`📄 Found ${markdownFiles.length} markdown files`);

    // Process each file
    let processedCount = 0;
    let skippedCount = 0;
    let replacedCount = 0;
    let addedCount = 0;
    const importedAt = new Date().toISOString();

    for (const filePath of markdownFiles) {
      const contentBuffer = readFileSync(filePath);
      const content = contentBuffer.toString("utf-8");
      const hash = calculateHash(contentBuffer);
      const { teamName, pathPrefix } = extractTeamNameAndPathPrefix(
        filePath,
        TEMP_DIR
      );
      const originalName = basename(filePath, ".md");
      const rawFilename = basename(filePath);

      // Convert team name to kebab-case
      const kebabTeamName = toKebabCase(teamName);

      // Build filename parts array (for id, without hash)
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

      // Build id (file path without .md and without hash)
      const id = uniqueParts.join("_");

      // Check if entry with same id already exists
      const existingEntry = entriesMap.get(id);

      // Build keywords from the path (pathPrefix + originalName, excluding team)
      const fullPath = [pathPrefix, originalName].filter(Boolean).join("/");
      const keywords = extractKeywords(fullPath, teamName);

      if (existingEntry) {
        if (existingEntry.hash === hash) {
          // Entry exists with same hash, preserve existing embedding and skip processing
          skippedCount++;
          console.log(
            `⏭️  Skipped (same hash): ${relative(TEMP_DIR, filePath)}`
          );
          continue;
        } else {
          // Entry exists with different hash, replace it (will need new embedding)
          replacedCount++;
        }
      } else {
        addedCount++;
      }

      // Create new entry (embedding will be added later if needed)
      const entry: DocEntry = {
        id,
        hash,
        importedAt,
        content,
        team: teamName || "",
        keywords,
        filename: rawFilename,
        embedding: [], // Will be populated after embedding generation
      };

      // Update or add entry
      entriesMap.set(id, entry);
      processedCount++;

      const action = existingEntry ? "Replaced" : "Added";
      console.log(`✅ ${action}: ${relative(TEMP_DIR, filePath)} -> ${id}`);
    }

    // Generate embeddings only for entries that changed (different hash) or are new
    console.log("\n🧮 Generating embeddings...");
    const allEntriesArray = Array.from(entriesMap.values());

    // Filter entries that need embeddings (empty array means hash changed or new entry)
    // Entries with same hash preserve their existing embeddings and are skipped here
    const entriesNeedingEmbeddings = allEntriesArray.filter(
      (entry) => !entry.embedding || entry.embedding.length === 0
    );

    if (entriesNeedingEmbeddings.length > 0) {
      const embeddingModel = google.textEmbeddingModel(EMBEDDING_MODEL);
      const BATCH_SIZE = 100;
      const totalBatches = Math.ceil(
        entriesNeedingEmbeddings.length / BATCH_SIZE
      );

      try {
        console.log(
          `📝 Generating embeddings for ${entriesNeedingEmbeddings.length} entries in ${totalBatches} batch(es)...`
        );

        // Process embeddings in batches
        for (let i = 0; i < entriesNeedingEmbeddings.length; i += BATCH_SIZE) {
          const batch = entriesNeedingEmbeddings.slice(i, i + BATCH_SIZE);
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const textsToEmbed = batch.map((entry) => entry.content);

          console.log(
            `  Processing batch ${batchNumber}/${totalBatches} (${batch.length} entries)...`
          );

          const { embeddings, usage } = await embedMany({
            model: embeddingModel,
            values: textsToEmbed,
            maxRetries: 0,
          });

          // eslint-disable-next-line no-console
          console.log(`  💸 Usage => `, JSON.stringify(usage, null, 2), "\n");
          // Don't make the call for testing
          // const embeddings = batch.map(() => [1, 2, 3, 4, 5]);

          // Assign embeddings to entries in this batch
          batch.forEach((entry, index) => {
            entry.embedding = embeddings[index] || [];
          });

          console.log(
            `  ✅ Batch ${batchNumber}/${totalBatches} complete (${embeddings.length} embeddings)`
          );
        }

        console.log(
          `✅ Generated ${entriesNeedingEmbeddings.length} embeddings total`
        );
      } catch (error) {
        console.error("❌ Error generating embeddings:", error);
        console.warn("⚠️  Continuing without embeddings...");
        // Set empty arrays for entries that failed to get embeddings
        entriesNeedingEmbeddings.forEach((entry) => {
          entry.embedding = [];
        });
      }
    } else {
      console.log("✅ All entries already have embeddings");
    }

    // Write JSON file (allEntriesArray already contains updated entries with embeddings)
    writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(allEntriesArray, null, 2),
      "utf-8"
    );

    console.log(`\n✨ Successfully processed ${processedCount} files`);
    console.log(`   📥 Added: ${addedCount}`);
    console.log(`   🔄 Replaced: ${replacedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`📁 Output file: ${OUTPUT_FILE}`);
    console.log(`📊 Total entries: ${allEntriesArray.length}`);

    // Clean up temp directory
    console.log("🧹 Cleaning up temp directory...");
    rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log("🎉 Done!");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
