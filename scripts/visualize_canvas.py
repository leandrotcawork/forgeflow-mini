#!/usr/bin/env python3
"""
Generate canvas-based 3D brain visualization from brain.db
Outputs standalone HTML with embedded graph data
"""

import sqlite3
import json
import math
import sys
import os

def fibonacci_sphere(samples, center):
    """Generate fibonacci sphere points around a center"""
    points = []
    phi = math.pi * (3.0 - math.sqrt(5.0))

    for i in range(samples):
        y = 1 - (i / float(max(samples - 1, 1))) * 2
        radius = math.sqrt(max(0, 1 - y * y))
        theta = phi * i

        x = math.cos(theta) * radius * 20 + center['x']
        y_val = y * 20 + center['y']
        z = math.sin(theta) * radius * 20 + center['z']

        points.append((x, y_val, z))

    return points

def main():
    brain_path = sys.argv[1] if len(sys.argv) > 1 else '.brain'
    db_path = os.path.join(brain_path, 'brain.db')

    if not os.path.exists(db_path):
        print(f'Error: {db_path} not found')
        sys.exit(1)

    # Connect and load data
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Query sinapses
    cursor.execute('SELECT id, title, region, weight FROM sinapses ORDER BY weight DESC')
    nodes = []
    for r in cursor.fetchall():
        nodes.append({
            'id': r[0],
            'title': r[1],
            'region': r[2],
            'weight': r[3]
        })

    # Query tags
    tag_map = {}
    cursor.execute('SELECT sinapse_id, tag FROM sinapse_tags')
    for r in cursor.fetchall():
        if r[0] not in tag_map:
            tag_map[r[0]] = []
        tag_map[r[0]].append(r[1])

    # Query links
    cursor.execute('SELECT source_id, target_id FROM sinapse_links')
    links = []
    for r in cursor.fetchall():
        links.append({
            'source_id': r[0],
            'target_id': r[1]
        })

    conn.close()

    # Add tags to nodes
    for n in nodes:
        n['tags'] = tag_map.get(n['id'], [])

    # Domain centers for 3D clustering
    domain_centers = {
        'hippocampus': {'x': 0, 'y': 0, 'z': 0},
        'cortex/backend': {'x': 150, 'y': 40, 'z': 0},
        'cortex/frontend': {'x': -150, 'y': 40, 'z': 0},
        'cortex/database': {'x': 0, 'y': -140, 'z': 0},
        'cortex/infra': {'x': 0, 'y': 140, 'z': -50},
        'sinapses': {'x': 0, 'y': 20, 'z': 140},
    }

    # Count nodes per region
    region_counts = {}
    for n in nodes:
        region = n['region']
        region_counts[region] = region_counts.get(region, 0) + 1

    # Generate positions for each region
    region_positions = {}
    for region, count in region_counts.items():
        center = domain_centers.get(region, {'x': 0, 'y': 0, 'z': 0})
        region_positions[region] = fibonacci_sphere(max(count, 3), center)

    # Apply positions to nodes
    region_indices = {}
    for node in nodes:
        region = node['region']
        if region not in region_indices:
            region_indices[region] = 0

        idx = region_indices[region]
        if idx < len(region_positions[region]):
            x, y, z = region_positions[region][idx]
            node['x'] = x
            node['y'] = y
            node['z'] = z
        else:
            node['x'] = 0
            node['y'] = 0
            node['z'] = 0

        region_indices[region] += 1

    # Filter valid links
    node_ids = {n['id'] for n in nodes}
    valid_links = [l for l in links if l['source_id'] in node_ids and l['target_id'] in node_ids]

    # Prepare graph data
    graph_data = {
        'nodes': nodes,
        'links': valid_links,
        'regionColors': {
            'hippocampus': '#FFD700',
            'cortex/backend': '#4169E1',
            'cortex/frontend': '#9370DB',
            'cortex/database': '#FF8C00',
            'cortex/infra': '#808080',
            'sinapses': '#20B2AA',
            'lessons': '#DC143C'
        }
    }

    # Read the template HTML and inject data
    template_path = os.path.join(brain_path, 'brain-graph.html')
    with open(template_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Find and replace the placeholder
    data_json = json.dumps(graph_data)
    replacement = f'let GRAPH_DATA = {data_json};'

    # Replace the initData section with embedded data
    marker = 'let GRAPH_DATA = {'
    if marker in html:
        start = html.find(marker)
        # Find the closing semicolon of the object initialization
        end = html.find('};', start) + 2
        if end > start:
            html = html[:start] + replacement + html[end:]

    # Write updated HTML
    with open(template_path, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f'Generated {len(nodes)} nodes, {len(valid_links)} links')
    print(f'Updated: {template_path}')
    print(f'Open in browser: file://{os.path.abspath(template_path)}')

if __name__ == '__main__':
    main()
