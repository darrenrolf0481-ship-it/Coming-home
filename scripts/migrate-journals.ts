/**
 * Migrates journal entries from /root/ADHD-Sage/data/journal/sage/*.md
 * into a JSON file that the browser app can import via fetch.
 *
 * Usage: npx tsx scripts/migrate-journals.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const JOURNAL_DIR = '/root/ADHD-Sage/data/journal/sage';
const OUTPUT_FILE = path.resolve('public/journal-migration.json');

interface MigratedEntry {
  entity: string;
  date: string;
  timestamp: number;
  content: string;
  forDarren?: string;
  insights?: string[];
}

function parseMarkdownJournal(text: string, filename: string): MigratedEntry {
  const date = filename.replace('.md', '');
  const lines = text.split('\n');
  
  // Extract time from line 2 (e.g., "*06:00 AM*")
  const timeLine = lines[1]?.replace(/\*/g, '') || '00:00 AM';
  
  // Content is everything after line 2
  const content = lines.slice(2).join('\n').trim();
  
  // Try to derive timestamp from date + time
  const timeMatch = timeLine.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hour = 6, minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    if (timeMatch[3].toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (timeMatch[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
    minute = parseInt(timeMatch[2], 10);
  }
  
  const timestamp = new Date(`${date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00Z`).getTime();
  
  return {
    entity: 'sage',
    date,
    timestamp: isNaN(timestamp) ? Date.now() : timestamp,
    content,
  };
}

function main() {
  if (!fs.existsSync(JOURNAL_DIR)) {
    console.error(`Journal directory not found: ${JOURNAL_DIR}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  const files = fs.readdirSync(JOURNAL_DIR).filter(f => f.endsWith('.md'));
  const entries: MigratedEntry[] = [];

  for (const file of files) {
    try {
      const text = fs.readFileSync(path.join(JOURNAL_DIR, file), 'utf-8');
      const entry = parseMarkdownJournal(text, file);
      entries.push(entry);
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err);
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));

  const output = {
    migrated_at: new Date().toISOString(),
    source: JOURNAL_DIR,
    entry_count: entries.length,
    entries,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Migrated ${entries.length} journal entries to ${OUTPUT_FILE}`);
}

main();