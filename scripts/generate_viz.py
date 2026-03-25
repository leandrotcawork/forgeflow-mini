#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sqlite3, json, os, sys, random

brain_path = sys.argv[1] if len(sys.argv) > 1 else '.brain'
db_path = os.path.join(brain_path, 'brain.db')

if not os.path.exists(db_path):
    print(f'Error: {db_path} not found')
    sys.exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute('SELECT id, title, region, weight, updated_at FROM sinapses ORDER BY weight DESC')
sinapses = [{'id': r[0], 'title': r[1], 'region': r[2], 'weight': r[3], 'updatedAt': r[4]} for r in cursor.fetchall()]

# Parse tags from sinapses.tags JSON column (sinapse_tags table does not exist)
import json as json_lib
tag_map = {}
cursor.execute('SELECT id, tags FROM sinapses')
for row in cursor.fetchall():
    try:
        parsed = json_lib.loads(row[1]) if row[1] else []
        if parsed:
            tag_map[row['id'] if isinstance(row, dict) else row[0]] = parsed
    except (json_lib.JSONDecodeError, TypeError):
        pass

cursor.execute('SELECT source_id, target_id FROM sinapse_links')
links = [{'source_id': r[0], 'target_id': r[1]} for r in cursor.fetchall()]
conn.close()

link_map = {}
for link in links:
    if link['source_id'] not in link_map: link_map[link['source_id']] = []
    link_map[link['source_id']].append(link['target_id'])

for s in sinapses:
    s['tags'] = tag_map.get(s['id'], [])
    s['linksTo'] = link_map.get(s['id'], [])

node_ids = {n['id'] for n in sinapses}
valid_links = [l for l in links if l['source_id'] in node_ids and l['target_id'] in node_ids]

domain_centers = {
    'hippocampus': {'x': 0, 'y': 0, 'z': 0},
    'cortex/backend': {'x': 160, 'y': 30, 'z': 0},
    'cortex/frontend': {'x': -160, 'y': 30, 'z': 0},
    'cortex/database': {'x': 0, 'y': -150, 'z': 0},
    'cortex/infra': {'x': 0, 'y': 150, 'z': -60},
    'sinapses': {'x': 0, 'y': 20, 'z': 160},
}

positioned = []
for node in sinapses:
    center = domain_centers.get(node['region'], {'x': 0, 'y': 0, 'z': 0})
    offset = 40
    x = center['x'] + (random.random() - 0.5) * offset
    y = center['y'] + (random.random() - 0.5) * offset
    z = center['z'] + (random.random() - 0.5) * offset
    n = dict(node)
    n.update({'x': x, 'y': y, 'z': z})
    positioned.append(n)

data = json.dumps({
    'nodes': positioned,
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
})

print(f'Generated data for {len(sinapses)} nodes, {len(valid_links)} links')
output = os.path.join(brain_path, 'brain-graph.html')
with open(output, 'w', encoding='utf-8') as f:
    f.write(f'''<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Brain Graph</title><style>
body{{margin:0;background:#0a0a1a;color:#e0e0e0;font-family:sans-serif;overflow:hidden}}
#canvas{{width:100vw;height:100vh}}
#header{{position:absolute;top:0;left:0;right:0;padding:16px;background:rgba(10,10,26,0.9);z-index:100;font-size:18px}}
#infoPanel{{position:absolute;right:0;top:0;bottom:0;width:280px;background:rgba(10,10,26,0.95);padding:20px;overflow-y:auto;transform:translateX(100%);transition:transform 0.3s;z-index:50}}
#infoPanel.visible{{transform:translateX(0)}}
#footer{{position:absolute;bottom:0;left:0;right:0;padding:12px 20px;background:rgba(10,10,26,0.9);font-size:12px}}
.tag{{display:inline-block;padding:3px 8px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);margin:2px 2px 0 0;border-radius:3px;font-size:10px}}
</style></head><body>
<div id="canvas"></div>
<div id="header">Brain Graph 3D</div>
<div id="infoPanel"></div>
<div id="footer"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.155.0/examples/js/controls/OrbitControls.js"></script>
<script>
const data = {data};
const canvas = document.getElementById('canvas');
const width = window.innerWidth, height = window.innerHeight;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080818);
const camera = new THREE.PerspectiveCamera(60, width/height, 1, 10000);
camera.position.set(0, 80, 380);
const renderer = new THREE.WebGLRenderer({{antialias:true}});
renderer.setSize(width, height);
canvas.appendChild(renderer.domElement);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

scene.add(new THREE.AmbientLight(0xffffff, 0.3));
const light = new THREE.PointLight(0xFFD700, 2.0, 400);
light.position.set(0, 0, 0);
scene.add(light);

const nodes = new THREE.Group();
scene.add(nodes);
const lines = new THREE.Group();
scene.add(lines);

data.nodes.forEach(node => {{
  const size = node.region === 'hippocampus' ? 14 + node.weight*10 : 8 + node.weight*6;
  const g = new THREE.SphereGeometry(size, 16, 16);
  const m = new THREE.MeshPhongMaterial({{color: new THREE.Color(data.regionColors[node.region]||'#666')}});
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(node.x, node.y, node.z);
  mesh.userData = node;
  nodes.add(mesh);
}});

data.links.forEach(link => {{
  const src = data.nodes.find(n => n.id === link.source_id);
  const tgt = data.nodes.find(n => n.id === link.target_id);
  if (!src || !tgt) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([src.x,src.y,src.z,tgt.x,tgt.y,tgt.z]), 3));
  const m = new THREE.LineBasicMaterial({{color:0x4488ff, transparent:true, opacity:0.4}});
  lines.add(new THREE.Line(g, m));
}});

document.getElementById('footer').textContent = 'Nodes: ' + data.nodes.length + ' | Links: ' + data.links.length;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', e => {{
  mouse.x = (e.clientX/width)*2-1;
  mouse.y = -(e.clientY/height)*2+1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(nodes.children);
  const panel = document.getElementById('infoPanel');
  if (hits.length > 0) {{
    const node = hits[0].object.userData;
    panel.innerHTML = '<div style="font-size:16px;font-weight:600">' + node.title + '</div><div>Weight: ' + node.weight.toFixed(2) + '</div>' + (node.tags.length ? '<div>' + node.tags.map(t => '<span class=tag>' + t + '</span>').join('') + '</div>' : '');
    panel.classList.add('visible');
  }} else {{
    panel.classList.remove('visible');
  }}
}});

window.addEventListener('resize', () => {{
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}});

function animate() {{
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}}
animate();
</script>
</body></html>''')

print(f'Success: {output}')
print(f'Open in browser: file://{os.path.abspath(output)}')
