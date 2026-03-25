#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ForgeFlow Mini — build_brain_db.py

Builds/rebuilds brain.db from markdown files in .brain/ directory.

Usage:
  python build_brain_db.py --brain-path .brain
  python build_brain_db.py                    (defaults to .brain)
"""

import os
import sys
import sqlite3
import re
from pathlib import Path
from datetime import datetime

def extract_domain_from_path(file_path):
    """Extract domain from file path."""
    parts = file_path.replace('\\', '/').split('/')

    if 'lessons' in parts:
        idx = parts.index('lessons')
        if idx > 0 and parts[idx - 1] in ('backend', 'frontend', 'database', 'infra'):
            return parts[idx - 1]  # cortex/backend/lessons → 'backend'
        elif idx + 1 < len(parts):
            return parts[idx + 1]  # lessons/cross-domain → 'cross-domain'
    return 'unknown'

def is_lesson(file_path):
    """Check if file is in a lessons directory."""
    parts = file_path.replace('\\', '/').split('/')
    return 'lessons' in parts

def parse_yaml_dict(yaml_str):
    """Simple YAML parser for frontmatter (no external deps)."""
    result = {}
    for line in yaml_str.split('\n'):
        line = line.strip()
        if not line or line.startswith('#'):
            continue

        if ':' not in line:
            continue

        key, value = line.split(':', 1)
        key = key.strip()
        value = value.strip()

        # Handle lists [item1, item2, ...]
        if value.startswith('[') and value.endswith(']'):
            value = value[1:-1]
            value = [v.strip().strip('"\'') for v in value.split(',')]
        # Handle booleans
        elif value.lower() == 'true':
            value = True
        elif value.lower() == 'false':
            value = False
        # Handle numbers
        elif value.replace('.', '').replace('-', '').isdigit():
            if '.' in value:
                value = float(value)
            else:
                value = int(value)
        # Handle strings
        else:
            value = value.strip('"\'')

        result[key] = value

    return result

def parse_frontmatter(content):
    """Parse YAML frontmatter from markdown file."""
    if not content.startswith('---'):
        return None, content

    try:
        match = re.match(r'^---\n(.*?)\n---\n(.*)', content, re.DOTALL)
        if match:
            yaml_str = match.group(1)
            body = match.group(2)
            frontmatter = parse_yaml_dict(yaml_str) or {}
            return frontmatter, body
    except:
        pass

    return None, content

def scan_brain_files(brain_path):
    """Scan all .md files in brain directory (except hippocampus)."""
    files = []
    brain_root = Path(brain_path)

    if not brain_root.exists():
        print(f'❌ Error: {brain_path} not found')
        return files

    for md_file in brain_root.rglob('*.md'):
        # Skip hippocampus files
        if 'hippocampus' in md_file.parts:
            continue

        rel_path = md_file.relative_to(brain_root)
        files.append(str(rel_path).replace('\\', '/'))

    return sorted(files)

def load_file_content(brain_path, file_path):
    """Load content of a markdown file."""
    full_path = Path(brain_path) / file_path
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return None

def create_tables(conn):
    """Create all database tables."""
    cursor = conn.cursor()

    # Drop existing tables
    cursor.execute('DROP TABLE IF EXISTS sinapse_links')
    cursor.execute('DROP TABLE IF EXISTS sinapse_tags')
    cursor.execute('DROP TABLE IF EXISTS lessons')
    cursor.execute('DROP TABLE IF EXISTS tasks')
    cursor.execute('DROP TABLE IF EXISTS sinapses')

    # Create sinapses table
    cursor.execute('''
        CREATE TABLE sinapses (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            region TEXT NOT NULL,
            file_path TEXT NOT NULL,
            weight REAL DEFAULT 0.5,
            updated_at TEXT NOT NULL,
            last_accessed TEXT,
            severity TEXT,
            occurrence_count INTEGER DEFAULT 1
        )
    ''')

    # Create sinapse_tags table
    cursor.execute('''
        CREATE TABLE sinapse_tags (
            sinapse_id TEXT,
            tag TEXT
        )
    ''')

    # Create sinapse_links table
    cursor.execute('''
        CREATE TABLE sinapse_links (
            source_id TEXT,
            target_id TEXT
        )
    ''')

    # Create lessons table
    cursor.execute('''
        CREATE TABLE lessons (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            domain TEXT NOT NULL,
            title TEXT,
            severity TEXT,
            occurrence_count INTEGER DEFAULT 1,
            escalated INTEGER DEFAULT 0,
            status TEXT DEFAULT 'inbox',
            created_at TEXT
        )
    ''')

    # Create tasks table
    cursor.execute('''
        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            description TEXT,
            status TEXT,
            created_at TEXT,
            completed_at TEXT,
            sinapses_loaded TEXT,
            token_usage INTEGER,
            outcome TEXT
        )
    ''')

    conn.commit()

def main():
    # Parse arguments
    brain_path = '.brain'
    for i, arg in enumerate(sys.argv[1:]):
        if arg == '--brain-path' and i + 1 < len(sys.argv) - 1:
            brain_path = sys.argv[i + 2]
            break

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

    # Process files
    sinapses_count = 0
    lessons_count = 0
    tags_count = 0
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
        title = frontmatter.get('title', '')
        region = frontmatter.get('region', '')
        tags = frontmatter.get('tags', [])
        links = frontmatter.get('links', [])
        weight = frontmatter.get('weight', 0.5)
        updated_at = frontmatter.get('updated_at', datetime.now().isoformat())
        severity = frontmatter.get('severity', '')
        occurrence_count = frontmatter.get('occurrence_count', 1)

        # Route to correct table
        if is_lesson(file_path):
            domain = extract_domain_from_path(file_path)
            status = frontmatter.get('status', 'inbox')
            escalated = frontmatter.get('escalated', 0)
            created_at = frontmatter.get('created_at', datetime.now().isoformat())

            try:
                cursor.execute('''
                    INSERT INTO lessons (id, file_path, domain, title, severity, occurrence_count, escalated, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (record_id, file_path, domain, title, severity, occurrence_count, escalated, status, created_at))
                lessons_count += 1
            except Exception as e:
                print(f'[Warn] Error inserting lesson {record_id}: {e}')
        else:
            # Sinapse
            try:
                cursor.execute('''
                    INSERT INTO sinapses (id, title, region, file_path, weight, updated_at, severity, occurrence_count)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (record_id, title, region, file_path, weight, updated_at, severity, occurrence_count))
                sinapses_count += 1
            except Exception as e:
                print(f'[Warn] Error inserting sinapse {record_id}: {e}')

        # Insert tags
        if tags:
            for tag in tags:
                try:
                    cursor.execute('INSERT INTO sinapse_tags (sinapse_id, tag) VALUES (?, ?)', (record_id, tag))
                    tags_count += 1
                except:
                    pass

        # Insert links
        if links:
            for target_id in links:
                try:
                    cursor.execute('INSERT INTO sinapse_links (source_id, target_id) VALUES (?, ?)', (record_id, target_id))
                    links_count += 1
                except:
                    pass

    conn.commit()
    conn.close()

    print(f'\n[OK] Tables created: sinapses, sinapse_tags, sinapse_links, lessons, tasks')
    print(f'[Files] Scanned {len(files)} .md files')
    print(f'   -> {sinapses_count} sinapses indexed')
    print(f'   -> {lessons_count} lessons indexed')
    print(f'   -> {tags_count} tags')
    print(f'   -> {links_count} links')
    print(f'[OK] brain.db built successfully')
    print(f'\nDatabase: {os.path.abspath(db_path)}')

if __name__ == '__main__':
    main()
