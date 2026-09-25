import type { ImportRow } from '../services/vocabularyService';
import type { Vocabulary } from './types';
import { duplicateKey, normalizeInput, validateInput } from './validation';

/**
 * Export contains only the user's own vocabulary and learning statistics.
 * Deliberately excluded: ids, user_id, auth data, tokens.
 */
export const EXPORT_FORMAT = 'vokabel-app';
export const EXPORT_VERSION = 1;

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 10_000;

interface ExportEntry {
  sourceLanguage: string;
  targetLanguage: string;
  question: string;
  answer: string;
  correctCount: number;
  incorrectCount: number;
  lastAskedAt: string | null;
  createdAt: string;
}

function toExportEntry(v: Vocabulary): ExportEntry {
  return {
    sourceLanguage: v.sourceLanguage,
    targetLanguage: v.targetLanguage,
    question: v.question,
    answer: v.answer,
    correctCount: v.correctCount,
    incorrectCount: v.incorrectCount,
    lastAskedAt: v.lastAskedAt,
    createdAt: v.createdAt,
  };
}

export function toJson(vocabularies: Vocabulary[], now = new Date()): string {
  return JSON.stringify(
    {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      vocabulary: vocabularies.map(toExportEntry),
    },
    null,
    2,
  );
}

const CSV_COLUMNS: (keyof ExportEntry)[] = [
  'sourceLanguage',
  'targetLanguage',
  'question',
  'answer',
  'correctCount',
  'incorrectCount',
  'lastAskedAt',
  'createdAt',
];

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // Prevent spreadsheet formula injection (=, +, -, @, tab, CR at the start).
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(vocabularies: Vocabulary[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const v of vocabularies) {
    const entry = toExportEntry(v);
    lines.push(CSV_COLUMNS.map((column) => csvCell(entry[column])).join(','));
  }
  // BOM so that Excel detects UTF-8 (umlauts, accents).
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function downloadFile(content: string, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(extension: 'json' | 'csv', now = new Date()): string {
  return `vokabeln-${now.toISOString().slice(0, 10)}.${extension}`;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export interface ImportProblem {
  row: number; // 1-based position in the file
  message: string;
}

export interface ImportAnalysis {
  rows: ImportRow[];
  duplicates: number;
  problems: ImportProblem[];
}

function readString(entry: Record<string, unknown>, key: string): string {
  const value = entry[key];
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function readCount(entry: Record<string, unknown>, key: string): number | null {
  const value = entry[key];
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 1_000_000 ? n : null;
}

function readDate(entry: Record<string, unknown>, key: string, now: Date): string | null | undefined {
  const value = entry[key];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const time = Date.parse(value);
  if (Number.isNaN(time) || time > now.getTime() + 60_000) return undefined;
  return new Date(time).toISOString();
}

/**
 * Parses and validates an import file. Only known fields are taken over;
 * ids and user ids in the file are ignored. Entries that already exist
 * (same language pair and word, case-insensitive) are skipped, so an import
 * never overwrites or deletes existing data.
 */
export function analyzeImport(text: string, existing: Vocabulary[], now = new Date()): ImportAnalysis {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.');
  }

  const list: unknown = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'vocabulary' in parsed
      ? (parsed as { vocabulary: unknown }).vocabulary
      : undefined;
  if (!Array.isArray(list)) {
    throw new Error('Unbekanntes Format. Erwartet wird ein Export dieser App (Feld "vocabulary") oder eine Liste von Vokabeln.');
  }
  if (list.length > MAX_IMPORT_ROWS) {
    throw new Error(`Die Datei enthält mehr als ${MAX_IMPORT_ROWS.toLocaleString('de-DE')} Einträge.`);
  }

  const seen = new Set(existing.map(duplicateKey));
  const rows: ImportRow[] = [];
  const problems: ImportProblem[] = [];
  let duplicates = 0;

  list.forEach((raw, index) => {
    const row = index + 1;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      problems.push({ row, message: 'Kein gültiger Eintrag.' });
      return;
    }
    const entry = raw as Record<string, unknown>;
    const input = normalizeInput({
      sourceLanguage: readString(entry, 'sourceLanguage'),
      targetLanguage: readString(entry, 'targetLanguage'),
      question: readString(entry, 'question'),
      answer: readString(entry, 'answer'),
    });
    const inputProblems = validateInput(input);
    const correctCount = readCount(entry, 'correctCount');
    const incorrectCount = readCount(entry, 'incorrectCount');
    const lastAskedAt = readDate(entry, 'lastAskedAt', now);
    if (correctCount === null || incorrectCount === null) inputProblems.push('Zähler sind keine gültigen Zahlen.');
    if (lastAskedAt === undefined) inputProblems.push('lastAskedAt ist kein gültiges Datum.');
    if (inputProblems.length) {
      problems.push({ row, message: inputProblems.join(' ') });
      return;
    }

    const key = duplicateKey(input);
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    rows.push({ ...input, correctCount: correctCount!, incorrectCount: incorrectCount!, lastAskedAt: lastAskedAt ?? null });
  });

  return { rows, duplicates, problems };
}
