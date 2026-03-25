#!/usr/bin/env node

/**
 * visualize.js - Generate 3D brain-graph.html from brain.db
 *
 * Usage:
 *   node visualize.js --brain-path .brain
 *   node visualize.js                      (defaults to .brain in cwd)
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Parse arguments
const args = process.argv.slice(2);
let brainPath = '.brain';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--brain-path' && args[i + 1]) {
    brainPath = args[i + 1];
    break;
  }
}

const dbPath = path.join(brainPath, 'brain.db');

console.log(`🧠 Generating 3D brain visualization...`);
console.log(`   Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Error: brain.db not found at ${dbPath}`);
  console.error(`   Run 'python build_brain_db.py' first to generate brain.db`);
  process.exit(1);
}

try {
  const db = new Database(dbPath);

  // Query all sinapses
  const sinapses = db.prepare(`
    SELECT id, title, region, weight, file_path, updated_at
    FROM sinapses
    ORDER BY weight DESC
  `).all();

  // Parse tags from sinapses.tags JSON column (sinapse_tags table does not exist)
  const tagMap = {};
  const tagRows = db.prepare('SELECT id, tags FROM sinapses').all();
  tagRows.forEach(row => {
    try {
      const parsed = JSON.parse(row.tags || '[]');
      if (parsed.length > 0) tagMap[row.id] = parsed;
    } catch (e) { /* skip invalid JSON */ }
  });

  // Query all links
  const links = db.prepare(`
    SELECT source_id, target_id FROM sinapse_links
  `).all();

  // Map links by source for quick lookup
  const linkMap = {};
  links.forEach(link => {
    if (!linkMap[link.source_id]) linkMap[link.source_id] = [];
    linkMap[link.source_id].push(link.target_id);
  });

  db.close();

  // Build nodes array with tags and links
  const nodes = sinapses.map(sinapse => ({
    id: sinapse.id,
    title: sinapse.title,
    region: sinapse.region,
    weight: sinapse.weight,
    tags: tagMap[sinapse.id] || [],
    linkCount: (linkMap[sinapse.id] || []).length,
    linksTo: linkMap[sinapse.id] || [],
    updatedAt: sinapse.updated_at
  }));

  // Build links array (filter to only links between nodes that exist)
  const nodeIds = new Set(nodes.map(n => n.id));
  const validLinks = links.filter(link => nodeIds.has(link.source_id) && nodeIds.has(link.target_id));

  console.log(`✓ Loaded ${nodes.length} sinapses and ${validLinks.length} links`);

  // Generate HTML
  const htmlContent = generateHTML(nodes, validLinks);
  const outputPath = path.join(brainPath, 'brain-graph.html');
  fs.writeFileSync(outputPath, htmlContent, 'utf8');

  console.log(`✅ Generated: ${outputPath}`);
  console.log(`   Open in browser: file://${path.resolve(outputPath)}`);
  console.log();

} catch (error) {
  console.error(`❌ Error: ${error.message}`);
  if (error.message.includes('Cannot find module')) {
    console.error(`\n   Missing dependency: better-sqlite3`);
    console.error(`   Install with: npm install better-sqlite3`);
  }
  process.exit(1);
}

/**
 * HTML escape function for safe text insertion
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generate standalone HTML with embedded Three.js and data
 */
function generateHTML(nodes, links) {
  // Region color mapping
  const regionColors = {
    'hippocampus': '#FFD700',
    'cortex/backend': '#4169E1',
    'cortex/frontend': '#9370DB',
    'cortex/database': '#FF8C00',
    'cortex/infra': '#808080',
    'sinapses': '#20B2AA',
    'lessons': '#DC143C',
    'lessons/cross-domain': '#DC143C',
    'lessons/archived': '#666666'
  };

  // Domain cluster center positions (3D layout like brain lobes)
  const domainCenters = {
    'hippocampus': { x: 0, y: 0, z: 0, scale: 1.4 },
    'cortex/backend': { x: 160, y: 30, z: 0, scale: 1.0 },
    'cortex/frontend': { x: -160, y: 30, z: 0, scale: 1.0 },
    'cortex/database': { x: 0, y: -150, z: 0, scale: 1.0 },
    'cortex/infra': { x: 0, y: 150, z: -60, scale: 1.0 },
    'sinapses': { x: 0, y: 20, z: 160, scale: 1.0 },
    'lessons': { x: 0, y: -80, z: -100, scale: 0.8 },
    'lessons/cross-domain': { x: 30, y: -100, z: -80, scale: 0.8 },
    'lessons/archived': { x: -50, y: -120, z: -120, scale: 0.7 }
  };

  // Assign 3D positions to nodes based on their domain
  const nodePositions = nodes.map(node => {
    const domainKey = node.region;
    const center = domainCenters[domainKey] || { x: 0, y: 0, z: 0, scale: 1.0 };

    // Small random offset from domain center (scatter effect)
    const offsetScale = 40;
    const x = center.x + (Math.random() - 0.5) * offsetScale;
    const y = center.y + (Math.random() - 0.5) * offsetScale;
    const z = center.z + (Math.random() - 0.5) * offsetScale;

    return { ...node, x, y, z, domainCenter: center };
  });

  // Embed data as JSON (with safety escaping)
  const graphDataJSON = JSON.stringify({
    nodes: nodePositions,
    links: links,
    regionColors: regionColors,
    stats: {
      totalSinapses: nodes.length,
      totalLinks: links.length,
      regions: [...new Set(nodes.map(n => n.region))]
    }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🧠 ForgeFlow Mini — Brain Graph 3D</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a1a;
      color: #e0e0e0;
      overflow: hidden;
    }
    #canvas {
      display: block;
      width: 100vw;
      height: 100vh;
    }

    /* Header Bar */
    #header {
      position: absolute; top: 0; left: 0; right: 0;
      background: linear-gradient(to bottom, rgba(10, 10, 26, 0.95), rgba(10, 10, 26, 0));
      padding: 16px 20px;
      z-index: 100;
      border-bottom: 1px solid rgba(255, 215, 0, 0.2);
    }

    #title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #title span { font-size: 24px; }

    /* Info Panel */
    #infoPanel {
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 280px;
      background: linear-gradient(to left, rgba(10, 10, 26, 0.98), rgba(10, 10, 26, 0.95));
      border-left: 1px solid rgba(255, 215, 0, 0.15);
      padding: 20px;
      overflow-y: auto;
      transform: translateX(100%);
      transition: transform 0.3s ease;
      z-index: 50;
    }

    #infoPanel.visible {
      transform: translateX(0);
    }

    .info-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .info-title {
      font-size: 16px;
      font-weight: 600;
      margin: 12px 0;
      word-break: break-word;
    }

    .info-field {
      margin: 10px 0;
      font-size: 12px;
    }

    .info-field-label {
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .weight-bar {
      background: rgba(255, 255, 255, 0.1);
      height: 4px;
      border-radius: 2px;
      overflow: hidden;
      margin: 4px 0;
    }

    .weight-fill {
      height: 100%;
      background: linear-gradient(to right, #4169E1, #FFD700);
      border-radius: 2px;
    }

    .tag {
      display: inline-block;
      padding: 3px 8px;
      background: rgba(255, 215, 0, 0.1);
      border: 1px solid rgba(255, 215, 0, 0.3);
      border-radius: 3px;
      font-size: 10px;
      margin: 2px 2px 2px 0;
      color: #FFD700;
    }

    .link-item {
      padding: 4px 6px;
      margin: 2px 0;
      background: rgba(255, 255, 255, 0.05);
      border-left: 2px solid #4169E1;
      border-radius: 2px;
      font-size: 11px;
    }

    /* Footer Stats */
    #footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(to top, rgba(10, 10, 26, 0.95), rgba(10, 10, 26, 0));
      padding: 12px 20px;
      border-top: 1px solid rgba(255, 215, 0, 0.15);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.6);
      z-index: 100;
    }

    /* Scrollbar */
    #infoPanel::-webkit-scrollbar {
      width: 6px;
    }

    #infoPanel::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }

    #infoPanel::-webkit-scrollbar-thumb {
      background: rgba(255, 215, 0, 0.3);
      border-radius: 3px;
    }

    #infoPanel::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 215, 0, 0.5);
    }
  </style>
</head>
<body>
  <div id="canvas"></div>

  <div id="header">
    <div id="title"><span>🧠</span> ForgeFlow Mini — Brain Graph 3D</div>
  </div>

  <div id="infoPanel"></div>
  <div id="footer"></div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r155/three.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/three@0.155.0/examples/js/controls/OrbitControls.js"></script>

  <script>
    // Embedded graph data
    const GRAPH_DATA = ${graphDataJSON};

    // HTML escape utility
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Initialize Three.js scene
    const canvas = document.getElementById('canvas');
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080818);

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(0, 80, 380);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    canvas.appendChild(renderer.domElement);

    // Controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.enableZoom = true;
    controls.enablePan = true;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const hippocampusLight = new THREE.PointLight(0xFFD700, 2.0, 400);
    hippocampusLight.position.set(0, 0, 0);
    scene.add(hippocampusLight);

    const directionalLight = new THREE.DirectionalLight(0x4466ff, 0.4);
    directionalLight.position.set(100, 100, 100);
    scene.add(directionalLight);

    // Brain shell (semi-transparent ellipsoid)
    const shellGeometry = new THREE.SphereGeometry(260, 32, 32);
    shellGeometry.scale(1.2, 1.0, 1.0);
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0x334455,
      transparent: true,
      opacity: 0.06,
      wireframe: false
    });
    const brainShell = new THREE.Mesh(shellGeometry, shellMaterial);
    scene.add(brainShell);

    // Wireframe shell
    const wireframeGeometry = new THREE.SphereGeometry(260, 32, 32);
    wireframeGeometry.scale(1.2, 1.0, 1.0);
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x334455,
      transparent: true,
      opacity: 0.03
    });
    const wireframeEdges = new THREE.EdgesGeometry(wireframeGeometry);
    const wireframe = new THREE.LineSegments(wireframeEdges, wireframeMaterial);
    scene.add(wireframe);

    // Nodes group
    const nodesGroup = new THREE.Group();
    scene.add(nodesGroup);

    // Lines group (links)
    const linesGroup = new THREE.Group();
    scene.add(linesGroup);

    // Create nodes
    const nodeMeshes = {};
    GRAPH_DATA.nodes.forEach(node => {
      const color = GRAPH_DATA.regionColors[node.region] || '#666666';
      const size = node.region === 'hippocampus'
        ? 14 + node.weight * 10
        : node.region.includes('lesson')
          ? 4 + node.weight * 4
          : 8 + node.weight * 6;

      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(color),
        emissive: node.region === 'sinapses' ? new THREE.Color(color).multiplyScalar(0.5) : 0x000000,
        shininess: 100
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(node.x, node.y, node.z);
      mesh.userData = { ...node, originalScale: mesh.scale.x };

      nodesGroup.add(mesh);
      nodeMeshes[node.id] = mesh;
    });

    // Create lines for links
    GRAPH_DATA.links.forEach(link => {
      const sourceNode = GRAPH_DATA.nodes.find(n => n.id === link.source_id);
      const targetNode = GRAPH_DATA.nodes.find(n => n.id === link.target_id);

      if (!sourceNode || !targetNode) return;

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(
        new Float32Array([sourceNode.x, sourceNode.y, sourceNode.z, targetNode.x, targetNode.y, targetNode.z]),
        3
      ));

      // Blend colors
      const sourceColor = new THREE.Color(GRAPH_DATA.regionColors[sourceNode.region]);
      const targetColor = new THREE.Color(GRAPH_DATA.regionColors[targetNode.region]);
      const blendColor = new THREE.Color().lerpColors(sourceColor, targetColor, 0.5);

      const isSinapse = sourceNode.region === 'sinapses' || targetNode.region === 'sinapses';
      const material = new THREE.LineBasicMaterial({
        color: blendColor,
        transparent: true,
        opacity: isSinapse ? 0.6 : 0.3,
        linewidth: 1
      });

      const line = new THREE.Line(geometry, material);
      linesGroup.add(line);
    });

    // Update stats footer
    document.getElementById('footer').textContent =
      'Stats: ' + GRAPH_DATA.nodes.length + ' sinapses · ' +
      GRAPH_DATA.links.length + ' links · ' +
      GRAPH_DATA.stats.regions.length + ' regions';

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let selectedNode = null;

    window.addEventListener('click', (event) => {
      mouse.x = (event.clientX / width) * 2 - 1;
      mouse.y = -(event.clientY / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodesGroup.children);

      if (intersects.length > 0) {
        const node = intersects[0].object.userData;
        showNodeInfo(node);
        selectedNode = intersects[0].object;
      } else {
        document.getElementById('infoPanel').classList.remove('visible');
        if (selectedNode) selectedNode.scale.set(selectedNode.userData.originalScale, selectedNode.userData.originalScale, selectedNode.userData.originalScale);
        selectedNode = null;
      }
    });

    function showNodeInfo(node) {
      const panel = document.getElementById('infoPanel');
      const color = GRAPH_DATA.regionColors[node.region] || '#666666';

      const tagsHTML = node.tags.map(tag => '<span class="tag">' + escapeHtml(tag) + '</span>').join('');
      const linksHTML = node.linksTo.map(linkId => {
        const linkedNode = GRAPH_DATA.nodes.find(n => n.id === linkId);
        return linkedNode ? '<div class="link-item">→ ' + escapeHtml(linkedNode.title.substring(0, 25)) + '</div>' : '';
      }).join('');

      const weightPercent = Math.round(node.weight * 100);
      const regionLabel = node.region.replace('cortex/', '').replace('lessons/', '').toUpperCase();
      const dateStr = new Date(node.updatedAt).toLocaleDateString();

      // Build info HTML safely
      let infoHtml = '<div class="info-badge" style="background: ' + color + '; color: #000;">' +
                     escapeHtml(regionLabel) + '</div>' +
                     '<div class="info-title">' + escapeHtml(node.title) + '</div>' +
                     '<div class="info-field"><div class="info-field-label">Weight</div>' +
                     '<div class="weight-bar"><div class="weight-fill" style="width: ' + weightPercent + '%;"></div></div>' +
                     '<div style="font-size: 11px; color: rgba(255,255,255,0.5);">' + node.weight.toFixed(2) + '</div></div>';

      if (node.tags.length > 0) {
        infoHtml += '<div class="info-field"><div class="info-field-label">Tags</div><div>' + tagsHTML + '</div></div>';
      }

      if (node.linksTo.length > 0) {
        infoHtml += '<div class="info-field"><div class="info-field-label">Links To (' + node.linksTo.length + ')</div>' +
                   '<div class="links-list">' + linksHTML + '</div></div>';
      }

      infoHtml += '<div class="info-field" style="margin-top: 16px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 10px; color: rgba(255,255,255,0.4);">' +
                 'ID: ' + escapeHtml(node.id) + '<br>' +
                 'Updated: ' + dateStr + '</div>';

      panel.innerHTML = infoHtml;
      panel.classList.add('visible');
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();
  </script>
</body>
</html>`;
}
