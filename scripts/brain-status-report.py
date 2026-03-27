#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ForgeFlow Mini — brain-status-report.py

Dashboard script that queries brain.db + state files and outputs a formatted
health report. Replaces 3-6 AI tool calls with one script invocation.

Usage:
  python brain-status-report.py [--brain-path .brain] [--format text|json|both]
"""

import argparse
import json
import os
import re
import sqlite3
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


def staleness_label(date_str):
    """Classify a date string as healthy, stale, or very stale."""
    if not date_str:
        return "unknown"
    try:
        # Normalize to a form datetime.fromisoformat() accepts (Python 3.7+)
        # Handles: 2026-03-27, 2026-03-27T12:34:56, 2026-03-27T12:34:56Z,
        #          2026-03-27T12:34:56+00:00, 2026-03-27T12:34:56.123Z
        raw = date_str.strip().replace("Z", "+00:00").split(".")[0]
        if "+" not in raw[10:] and len(raw) > 10:
            # naive datetime string — parse as-is
            dt = datetime.fromisoformat(raw)
        else:
            dt = datetime.fromisoformat(raw)
            # Strip timezone for naive comparison
            if dt.tzinfo is not None:
                dt = dt.replace(tzinfo=None)
        delta = (datetime.now() - dt).days
        if delta <= 7:
            return "healthy"
        elif delta <= 30:
            return f"stale ({delta}d)"
        else:
            return f"very stale ({delta}d)"
    except (ValueError, TypeError):
        return "unknown"


def query_sinapses(conn):
    """Sinapses per region from brain.db."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT region, COUNT(*), ROUND(AVG(weight),2), MAX(updated_at) "
        "FROM sinapses GROUP BY region"
    )
    rows = cursor.fetchall()
    return [
        {
            "region": r[0],
            "count": r[1],
            "avg_weight": r[2],
            "last_updated": r[3],
            "status": staleness_label(r[3]),
        }
        for r in rows
    ]


def query_lessons(conn):
    """Active lessons per domain from brain.db."""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT domain, COUNT(*) FROM lessons "
        "WHERE status NOT IN ('archived','superseded') GROUP BY domain"
    )
    return {r[0]: r[1] for r in cursor.fetchall()}


def read_project_state(brain_path):
    """Read circuit breaker and subagent usage from brain-project-state.json."""
    state_file = Path(brain_path) / "progress" / "brain-project-state.json"
    result = {"circuit_breaker": "unknown", "subagent_usage": None}
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        cb = data.get("circuit_breaker", data.get("circuitBreaker", {}))
        if isinstance(cb, dict):
            result["circuit_breaker"] = cb.get("state", cb.get("status", "unknown"))
        elif isinstance(cb, str):
            result["circuit_breaker"] = cb
        sa = data.get("subagent_usage", data.get("subagentUsage", None))
        if isinstance(sa, dict):
            result["subagent_usage"] = {
                "dispatched": sa.get("dispatched", 0),
                "succeeded": sa.get("succeeded", 0),
            }
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        pass
    return result


def count_consult_log(brain_path):
    """Parse consult-log.md for consultation counts by mode.

    Format: | timestamp | mode | domain | summary | confidence | thread |
    One row per consultation. Skips header and separator rows.
    """
    log_file = Path(brain_path) / "progress" / "consult-log.md"
    stats = {"total": 0, "quick": 0, "research": 0, "consensus": 0}
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        for line in lines:
            stripped = line.strip()
            if not stripped.startswith("|") or not stripped.endswith("|"):
                continue
            cols = [c.strip() for c in stripped.split("|")]
            # cols[0] is '' (before first |), cols[-1] is '' (after last |)
            # data cols are cols[1:-1]
            data = cols[1:-1]
            if len(data) < 2:
                continue
            # Skip header/separator rows
            mode_col = data[1].lower()
            if "---" in mode_col or mode_col in ("mode", ""):
                continue
            if mode_col == "quick":
                stats["quick"] += 1
                stats["total"] += 1
            elif mode_col == "research":
                stats["research"] += 1
                stats["total"] += 1
            elif mode_col == "consensus":
                stats["consensus"] += 1
                stats["total"] += 1
    except FileNotFoundError:
        pass
    return stats


def count_active_threads(brain_path):
    """Count active consult threads (< 10 min old) and audit file count."""
    wm_dir = Path(brain_path) / "working-memory"
    active = 0
    total_files = 0
    cutoff = time.time() - 600  # 10 minutes ago
    try:
        if wm_dir.exists():
            for f in wm_dir.glob("consult-*.json"):
                total_files += 1
                try:
                    if f.stat().st_mtime > cutoff:
                        active += 1
                except OSError:
                    pass
    except OSError:
        pass
    return {"active_threads": active, "audit_files": total_files}


def count_pending_escalations(brain_path):
    """Count pending escalation proposals."""
    inbox_dir = Path(brain_path) / "lessons" / "inbox"
    count = 0
    try:
        if inbox_dir.exists():
            for f in inbox_dir.glob("escalation-PROPOSAL-*.md"):
                count += 1
    except OSError:
        pass
    return count


def get_project_name(brain_path):
    """Derive project name from brain path or cwd."""
    bp = Path(brain_path).resolve()
    # If brain_path is inside a project, go up one level
    if bp.name == ".brain":
        return bp.parent.name
    return bp.parent.name if bp.parent else "unknown"


def build_report(brain_path):
    """Build the full report data dict."""
    db_path = os.path.join(brain_path, "brain.db")

    if not os.path.isfile(db_path):
        print(f"Error: brain.db not found at {db_path}", file=sys.stderr)
        sys.exit(3)

    try:
        conn = sqlite3.connect(db_path)
        # Quick sanity check
        conn.execute("SELECT 1 FROM sinapses LIMIT 1")
    except (sqlite3.DatabaseError, sqlite3.OperationalError) as e:
        print(f"Error: corrupt or invalid brain.db — {e}", file=sys.stderr)
        sys.exit(3)

    sinapses = query_sinapses(conn)
    lessons_by_domain = query_lessons(conn)
    conn.close()

    state = read_project_state(brain_path)
    consult_stats = count_consult_log(brain_path)
    threads = count_active_threads(brain_path)
    escalations = count_pending_escalations(brain_path)
    project_name = get_project_name(brain_path)

    return {
        "project_name": project_name,
        "regions": sinapses,
        "lessons": lessons_by_domain,
        "circuit_breaker": state["circuit_breaker"],
        "subagent_usage": state["subagent_usage"],
        "consult_stats": consult_stats,
        "active_threads": threads["active_threads"],
        "audit_files": threads["audit_files"],
        "escalations": escalations,
        "generated_at": datetime.now().isoformat(),
    }


def format_text(report):
    """Render report as aligned text table."""
    lines = []
    lines.append(f"Brain Status -- {report['project_name']}")
    lines.append("")

    # Header
    header = (
        f"{'Region':<20}| {'Sinapses':>8} | {'Lessons':>7} | "
        f"{'Avg Weight':>10} | {'Last Updated':>12} | Status"
    )
    lines.append(header)
    lines.append("-" * len(header))

    lessons = report["lessons"]
    for r in sorted(report["regions"], key=lambda x: x["region"]):
        region = r["region"]
        lesson_count = lessons.get(region, 0)
        updated = (r["last_updated"] or "")[:10]
        row = (
            f"{region:<20}| {r['count']:>8} | {lesson_count:>7} | "
            f"{r['avg_weight']:>10} | {updated:>12} | {r['status']}"
        )
        lines.append(row)

    lines.append("")
    lines.append(f"Circuit Breaker: {report['circuit_breaker']}")

    sa = report["subagent_usage"]
    if sa:
        lines.append(
            f"Subagent Usage: dispatched={sa['dispatched']}, "
            f"succeeded={sa['succeeded']}"
        )
    else:
        lines.append("Subagent Usage: n/a")

    cs = report["consult_stats"]
    lines.append(
        f"Consultations: {cs['total']} "
        f"(Quick: {cs['quick']}, Research: {cs['research']}, "
        f"Consensus: {cs['consensus']})"
    )

    lines.append(f"Pending escalations: {report['escalations']}")

    if report["active_threads"] > 0:
        lines.append(f"Active threads: {report['active_threads']}")
    if report["audit_files"] > 0:
        lines.append(f"Audit files (working-memory): {report['audit_files']}")

    return "\n".join(lines)


def format_json(report):
    """Render report as JSON string."""
    return json.dumps(report, indent=2, ensure_ascii=False)


def main():
    parser = argparse.ArgumentParser(
        description="Brain health dashboard — query brain.db + state files"
    )
    parser.add_argument(
        "--brain-path",
        default=".brain",
        help="Path to .brain directory (default: .brain)",
    )
    parser.add_argument(
        "--format",
        choices=["text", "json", "both"],
        default="both",
        dest="output_format",
        help="Output format (default: both)",
    )
    args = parser.parse_args()

    brain_path = args.brain_path
    if not os.path.isdir(brain_path):
        print(f"Error: brain directory not found at {brain_path}", file=sys.stderr)
        sys.exit(3)

    report = build_report(brain_path)

    if args.output_format == "text":
        print(format_text(report))
    elif args.output_format == "json":
        print(format_json(report))
    else:  # both
        print(format_text(report))
        print("\n--- JSON ---\n")
        print(format_json(report))


if __name__ == "__main__":
    main()
