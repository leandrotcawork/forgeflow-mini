#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ForgeFlow Mini — build_brain_db.py

Builds/rebuilds brain.db from markdown files in .brain/ directory.

Usage:
  python build_brain_db.py --brain-path .brain
  python build_brain_db.py                    (defaults to .brain)
"""

import argparse
import os
import sys
import sqlite3
import re
import json as json_lib
from pathlib import Path
from datetime import datetime

def parse_yaml_dict(yaml_str):
    """Simple YAML parser for frontmatter (no external deps)."""
    result = {}
    lines = yaml_str.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            i += 1
            continue

        if ':' not in stripped:
            i += 1
            continue

        key, value = stripped.split(':', 1)
        key = key.strip()
        value = value.strip()

        # Handle lists [item1, item2, ...]
        if value.startswith('[') and value.endswith(']'):
            inner = value[1:-1].strip()
            value = [v.strip().strip('"\'') for v in inner.split(',') if v.strip()]
        # Handle YAML block lists (key with empty value followed by - items)
        elif value == '':
            # Check if next lines are block list items
            block_items = []
            j = i + 1
            while j < len(lines):
                next_line = lines[j]
                next_stripped = next_line.strip()
                if next_stripped.startswith('- '):
                    block_items.append(next_stripped[2:].strip().strip('"\''))
                    j += 1
                elif not next_stripped:
                    j += 1
                else:
                    break
            if block_items:
                value = block_items
                i = j
                result[key] = value
                continue
            else:
                value = ''
        # Handle booleans
        elif value.lower() == 'true':
            value = True
        elif value.lower() == 'false':
            value = False
        # Handle numbers, fall back to string
        else:
            try:
                value = int(value)
            except ValueError:
                try:
                    value = float(value)
                except ValueError:
                    value = value.strip('"\'')  # plain string

        result[key] = value
        i += 1

    return result

def parse_frontmatter(content):
    """Parse YAML frontmatter from markdown file."""
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    if not content.startswith('---'):
        return None, content

    try:
        match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
        if match:
            yaml_str = match.group(1)
            body = match.group(2)
            frontmatter = parse_yaml_dict(yaml_str) or {}
            return frontmatter, body
    except Exception:
        pass

    return None, content

def scan_brain_files(brain_path):
    """Scan all .md files in brain directory."""
    files = []
    brain_root = Path(brain_path)

    if not brain_root.exists():
        print(f'❌ Error: {brain_path} not found')
        return files

    for md_file in brain_root.rglob('*.md'):
        rel_path = md_file.relative_to(brain_root)
        files.append(str(rel_path).replace('\\', '/'))

    return sorted(files)

def load_file_content(brain_path, file_path):
    """Load content of a markdown file."""
    full_path = Path(brain_path) / file_path
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception:
        return None

def create_tables(conn):
    """Create all database tables."""
    cursor = conn.cursor()

    # Drop existing tables — FTS5 virtual tables MUST be dropped before
    # their backing content tables to avoid content-sync corruption.
    cursor.execute('DROP TABLE IF EXISTS sinapses_fts')
    cursor.execute('DROP TABLE IF EXISTS sinapse_links')
    cursor.execute('DROP TABLE IF EXISTS consolidation_log')
    cursor.execute('DROP TABLE IF EXISTS sinapses')
    cursor.execute('DROP TABLE IF EXISTS brain_state')

    # Create sinapses table — canonical schema
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sinapses (
            id            TEXT PRIMARY KEY,
            file_path     TEXT NOT NULL,
            title         TEXT NOT NULL,
            region        TEXT NOT NULL,
            tags          TEXT DEFAULT '[]',
            links         TEXT DEFAULT '[]',
            content       TEXT,
            weight        REAL NOT NULL DEFAULT 0.50,
            last_accessed TEXT,
            usage_count   INTEGER NOT NULL DEFAULT 0,
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sinapses_region ON sinapses(region)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sinapses_weight ON sinapses(weight DESC)')

    # Create sinapse_links table with PK and FK
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sinapse_links (
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            PRIMARY KEY (source_id, target_id),
            FOREIGN KEY (source_id) REFERENCES sinapses(id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES sinapses(id) ON DELETE CASCADE
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sinapse_links_source ON sinapse_links(source_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_sinapse_links_target ON sinapse_links(target_id)')

    # Create consolidation_log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS consolidation_log (
            cycle_number         INTEGER PRIMARY KEY AUTOINCREMENT,
            tasks_reviewed       INTEGER NOT NULL DEFAULT 0,
            proposals_approved   INTEGER NOT NULL DEFAULT 0,
            proposals_rejected   INTEGER NOT NULL DEFAULT 0,
            escalations_surfaced INTEGER NOT NULL DEFAULT 0,
            sinapses_reweighted  INTEGER NOT NULL DEFAULT 0,
            created_at           TEXT NOT NULL
        )
    ''')

    # Create brain_state table — v0.3.0
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS brain_state (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')

    # Create FTS5 virtual tables — v0.7.0
    # Content-sync table mirroring sinapses for semantic search.
    # Wrapped in try/except: FTS5 requires SQLite compiled with it enabled.
    try:
        cursor.execute('''
            CREATE VIRTUAL TABLE IF NOT EXISTS sinapses_fts USING fts5(
                id UNINDEXED,
                title,
                content,
                tags,
                content=sinapses,
                content_rowid=rowid
            )
        ''')
        print('   [FTS5] Virtual table created')
    except Exception as e:
        print(f'   [FTS5] Skipped — not available ({e})')

    conn.commit()

def migrate_tables(conn):
    """Apply backward-compatible migrations to an existing brain.db.

    Each migration is wrapped in try/except so running twice is safe
    (idempotent). Migrations cover schema additions introduced in v0.3.0.
    """
    cursor = conn.cursor()
    migrations_applied = 0

    # Migration 1: Create brain_state table if it doesn't exist
    try:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS brain_state (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ''')
        # Check if we actually created it (vs. it already existing)
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='brain_state'")
        if cursor.fetchone():
            migrations_applied += 1
            print('   [migrate] brain_state table: OK')
    except Exception as e:
        print(f'   [migrate] brain_state table: skipped ({e})')

    # Migration 2: Create FTS5 virtual table if missing (v0.7.0)
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sinapses_fts'")
        sinapses_fts_exists = cursor.fetchone() is not None

        if not sinapses_fts_exists:
            cursor.execute('''
                CREATE VIRTUAL TABLE IF NOT EXISTS sinapses_fts USING fts5(
                    id UNINDEXED, title, content, tags,
                    content=sinapses, content_rowid=rowid
                )
            ''')
            print('   [migrate] sinapses_fts: created')
            # Note: FTS5 rebuild is NOT called here because create_tables()
            # drops and recreates base tables before migrate_tables() runs,
            # so sinapses are empty at this point. The authoritative
            # rebuild fires after data insertion in main().
            migrations_applied += 1
        else:
            print('   [migrate] FTS5 virtual table: already exists')
    except Exception as e:
        print(f'   [migrate] FTS5 virtual table: skipped ({e})')

    conn.commit()
    return migrations_applied


def main():
    # Parse arguments
    parser = argparse.ArgumentParser(description='Build brain.db from .brain/ markdown files')
    parser.add_argument('--brain-path', default='.brain', help='Path to .brain directory')
    args = parser.parse_args()
    brain_path = args.brain_path

    print('[Brain] Building brain.db...')
    print(f'   Source: {brain_path}')

    db_path = os.path.join(brain_path, 'brain.db')
    print(f'   Database: {db_path}')

    # Scan files
    files = scan_brain_files(brain_path)
    if not files:
        print(f'[Error] No .md files found in {brain_path}')
        sys.exit(1)

    # Connect to database
    try:
        conn = sqlite3.connect(db_path)
        create_tables(conn)
    except Exception as e:
        print(f'[Error] Error creating database: {e}')
        sys.exit(1)

    # Apply backward-compatible migrations (safe on fresh or existing DBs)
    print('   Running migrations...')
    migrate_tables(conn)

    # Process files
    sinapses_count = 0
    links_count = 0
    cursor = conn.cursor()

    for file_path in files:
        content = load_file_content(brain_path, file_path)
        if not content:
            continue

        frontmatter, body = parse_frontmatter(content)
        if not frontmatter:
            continue

        record_id = frontmatter.get('id', '')
        if not record_id:
            print(f'  [Warn] Skipping {file_path}: missing "id" in frontmatter')
            continue
        title = frontmatter.get('title', '')
        if not title:
            print(f'  [Warn] Skipping {file_path}: missing "title" in frontmatter')
            continue
        region = frontmatter.get('region', '')
        if not region:
            print(f'  [Warn] Skipping {file_path}: missing "region" in frontmatter')
            continue
        tags = frontmatter.get('tags', [])
        links = frontmatter.get('links', [])
        weight = frontmatter.get('weight', 0.5)
        updated_at = frontmatter.get('updated_at', datetime.now().isoformat())

        # Insert as sinapse
        if isinstance(tags, list):
            tags = sorted(tags)
        tags_json = json_lib.dumps(tags) if isinstance(tags, list) else (tags if tags else '[]')
        links_json = json_lib.dumps(links) if isinstance(links, list) else (links if links else '[]')
        created_at_val = frontmatter.get('created_at', datetime.now().isoformat())

        try:
            cursor.execute('''
                INSERT INTO sinapses (id, file_path, title, region, tags, links, content, weight, last_accessed, usage_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (record_id, file_path, title, region, tags_json, links_json, body, weight, None, 0, created_at_val, updated_at))
            sinapses_count += 1
        except Exception as e:
            print(f'[Warn] Error inserting sinapse {record_id}: {e}')

        # Insert links into sinapse_links
        if links:
            for target_id in links:
                try:
                    cursor.execute('INSERT INTO sinapse_links (source_id, target_id) VALUES (?, ?)', (record_id, target_id))
                    links_count += 1
                except Exception:
                    pass

    conn.commit()

    # Rebuild FTS5 index after all data is inserted
    try:
        cursor.execute("INSERT INTO sinapses_fts(sinapses_fts) VALUES('rebuild')")
        conn.commit()
        print(f'   [FTS5] Index rebuilt ({sinapses_count} sinapses)')
    except Exception:
        print('   [FTS5] Rebuild skipped — table not available')

    conn.close()

    print(f'\n[OK] Tables created: sinapses, sinapse_links, consolidation_log, brain_state, sinapses_fts')
    print(f'[Files] Scanned {len(files)} .md files')
    print(f'   -> {sinapses_count} sinapses indexed')
    print(f'   -> {links_count} links')
    print(f'[OK] brain.db built successfully')
    print(f'\nDatabase: {os.path.abspath(db_path)}')

if __name__ == '__main__':
    main()
