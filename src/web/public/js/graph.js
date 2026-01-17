/**
 * GovTrack Graph Explorer - Force-Directed Visualization
 * Uses D3.js force simulation with horizontal bands per entity type
 */

let svg, simulation, container;
let nodes = [];
let links = [];
let nodeElements, linkElements, labelElements;
let selectedNodeId = null;

// Type to band Y position mapping (as fraction of height)
const typeBands = {
  goal: 0.15,
  problem: 0.38,
  idea: 0.62,
  action: 0.85
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupSVG();
  await loadGovernments();
  await loadData();
  setupEventListeners();
}

function setupSVG() {
  const container = document.querySelector('.graph-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select('#graph')
    .attr('width', width)
    .attr('height', height);

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      svg.select('.graph-content').attr('transform', event.transform);
    });

  svg.call(zoom);

  // Add defs for arrow markers
  const defs = svg.append('defs');

  // Arrow marker for each relation type
  const relationColors = {
    threatens: '#f44336',
    addresses: '#2196F3',
    pursues: '#4CAF50',
    implements: '#FF9800',
    depends_on: '#9C27B0',
    complements: '#00BCD4',
    conflicts: '#E91E63',
    requires: '#795548'
  };

  Object.entries(relationColors).forEach(([type, color]) => {
    defs.append('marker')
      .attr('id', `arrow-${type}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color);
  });

  // Content group for zoom/pan
  svg.append('g').attr('class', 'graph-content');
}

async function loadGovernments() {
  try {
    const res = await fetch('/api/governments');
    const data = await res.json();
    if (data.success) {
      const select = document.getElementById('gov-filter');
      data.data.governments.forEach(gov => {
        const option = document.createElement('option');
        option.value = gov.id;
        option.textContent = gov.name;
        select.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Failed to load governments:', err);
  }
}

async function loadData() {
  const govFilter = document.getElementById('gov-filter').value;
  let url = '/api/graph?';
  if (govFilter) url += `gov_id=${govFilter}&`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      nodes = data.data.nodes.map(n => ({ ...n }));
      links = data.data.edges.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type
      }));
      renderGraph();
    }
  } catch (err) {
    console.error('Failed to load graph data:', err);
  }
}

function renderGraph() {
  const content = svg.select('.graph-content');
  content.selectAll('*').remove();

  if (nodes.length === 0) {
    content.append('text')
      .attr('x', svg.attr('width') / 2)
      .attr('y', svg.attr('height') / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#666')
      .text('No entities to display');
    return;
  }

  const width = +svg.attr('width');
  const height = +svg.attr('height');
  const nodeSize = +document.getElementById('node-size').value;
  const linkDistance = +document.getElementById('link-distance').value;
  const useBands = document.getElementById('use-bands').checked;

  // Draw band labels if using bands
  if (useBands) {
    Object.entries(typeBands).forEach(([type, yFrac]) => {
      content.append('text')
        .attr('class', 'band-label')
        .attr('x', 40)
        .attr('y', height * yFrac)
        .text(type.toUpperCase() + 'S');
    });
  }

  // Create force simulation
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(linkDistance))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(nodeSize + 50)); // Larger radius for multi-line labels

  // Add band force if enabled
  if (useBands) {
    simulation.force('y', d3.forceY(d => height * typeBands[d.type]).strength(0.3));
  }

  // Draw links
  linkElements = content.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', d => `link ${d.type}`)
    .attr('marker-end', d => `url(#arrow-${d.type})`);

  // Draw nodes
  nodeElements = content.append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', d => `node ${d.type}`)
    .call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded));

  nodeElements.append('circle')
    .attr('r', d => {
      // Size by priority (higher priority = larger)
      const basePriority = 4 - d.priority;
      return nodeSize + basePriority * 3;
    });

  // Add multi-line labels
  labelElements = nodeElements.append('text')
    .attr('class', 'node-label')
    .attr('dy', d => (nodeSize + (4 - d.priority) * 3) + 15)
    .each(function(d) {
      const text = d3.select(this);
      const words = wrapText(d.title, 25); // Max chars per line
      const lineHeight = 14;

      words.forEach((line, i) => {
        text.append('tspan')
          .attr('x', 0)
          .attr('dy', i === 0 ? 0 : lineHeight)
          .text(line);
      });
    });

  updateLabelVisibility();

  // Add click handlers
  nodeElements.on('click', (event, d) => {
    event.stopPropagation();
    selectNode(d.id);
  });

  nodeElements.on('mouseenter', (event, d) => {
    highlightConnections(d.id);
  });

  nodeElements.on('mouseleave', () => {
    clearHighlights();
  });

  // Click on background to deselect
  svg.on('click', () => {
    closeInfoPanel();
    clearHighlights();
  });

  // Update positions on tick
  simulation.on('tick', () => {
    linkElements
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

function highlightConnections(nodeId) {
  const connectedIds = new Set([nodeId]);
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    if (sourceId === nodeId) connectedIds.add(targetId);
    if (targetId === nodeId) connectedIds.add(sourceId);
  });

  nodeElements.classed('dimmed', d => !connectedIds.has(d.id));
  nodeElements.classed('highlighted', d => d.id === nodeId);

  linkElements.classed('dimmed', d => {
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
    return sourceId !== nodeId && targetId !== nodeId;
  });
  linkElements.classed('highlighted', d => {
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
    return sourceId === nodeId || targetId === nodeId;
  });
}

function clearHighlights() {
  if (selectedNodeId) return; // Keep highlights if a node is selected
  nodeElements.classed('dimmed', false);
  nodeElements.classed('highlighted', false);
  linkElements.classed('dimmed', false);
  linkElements.classed('highlighted', false);
}

async function selectNode(nodeId) {
  selectedNodeId = nodeId;
  highlightConnections(nodeId);
  await loadNodeDetails(nodeId);
  document.getElementById('info-panel').classList.add('open');
}

async function loadNodeDetails(nodeId) {
  try {
    const res = await fetch(`/api/entities/${nodeId}`);
    const data = await res.json();
    if (data.success) {
      renderInfoPanel(data.data);
    }
  } catch (err) {
    console.error('Failed to load node details:', err);
  }
}

function renderInfoPanel(entity) {
  document.getElementById('info-title').textContent = entity.title;

  const content = document.getElementById('info-content');
  content.innerHTML = `
    <div class="info-section">
      <h3>Info</h3>
      <p><strong>ID:</strong> ${entity.id}</p>
      <p><strong>Type:</strong> ${entity.type}</p>
      <p><strong>Status:</strong> ${entity.status}</p>
      <p><strong>Priority:</strong> P${entity.priority}</p>
      ${entity.government ? `<p><strong>Gov:</strong> ${entity.government.name}</p>` : ''}
    </div>

    ${entity.body ? `
    <div class="info-section">
      <h3>Description</h3>
      <p style="font-size: 0.8rem;">${escapeHtml(entity.body)}</p>
    </div>
    ` : ''}

    ${entity.relationsInfo && entity.relationsInfo.outgoing.length > 0 ? `
    <div class="info-section">
      <h3>Outgoing</h3>
      ${entity.relationsInfo.outgoing.map(rel => `
        <div class="relation-item" onclick="focusNode('${rel.target}')">
          ${rel.type} &rarr; ${rel.targetEntity ? truncate(rel.targetEntity.title, 25) : rel.target}
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${entity.relationsInfo && entity.relationsInfo.incoming.length > 0 ? `
    <div class="info-section">
      <h3>Incoming</h3>
      ${entity.relationsInfo.incoming.map(rel => `
        <div class="relation-item" onclick="focusNode('${rel.source}')">
          ${rel.sourceEntity ? truncate(rel.sourceEntity.title, 25) : rel.source} &rarr; ${rel.type}
        </div>
      `).join('')}
    </div>
    ` : ''}
  `;
}

function focusNode(nodeId) {
  selectNode(nodeId);

  // Find the node and center the view on it
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    const width = +svg.attr('width');
    const height = +svg.attr('height');
    const scale = 1.5;
    const x = width / 2 - node.x * scale;
    const y = height / 2 - node.y * scale;

    svg.transition()
      .duration(500)
      .call(
        d3.zoom().transform,
        d3.zoomIdentity.translate(x, y).scale(scale)
      );
  }
}

function closeInfoPanel() {
  document.getElementById('info-panel').classList.remove('open');
  selectedNodeId = null;
  clearHighlights();
}

function updateLabelVisibility() {
  const showLabels = document.getElementById('show-labels').checked;
  if (labelElements) {
    labelElements.style('display', showLabels ? 'block' : 'none');
  }
}

function setupEventListeners() {
  document.getElementById('gov-filter').addEventListener('change', loadData);

  document.getElementById('show-labels').addEventListener('change', updateLabelVisibility);

  document.getElementById('use-bands').addEventListener('change', () => {
    renderGraph();
  });

  document.getElementById('node-size').addEventListener('input', () => {
    renderGraph();
  });

  document.getElementById('link-distance').addEventListener('input', () => {
    renderGraph();
  });

  // Handle window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const container = document.querySelector('.graph-container');
      svg.attr('width', container.clientWidth)
         .attr('height', container.clientHeight);
      renderGraph();
    }, 100);
  });

  // Close info panel on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeInfoPanel();
    }
  });
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

/**
 * Wrap text into multiple lines
 * @param {string} text - Text to wrap
 * @param {number} maxCharsPerLine - Maximum characters per line
 * @param {number} maxLines - Maximum number of lines (default 3)
 * @returns {Array} Array of lines
 */
function wrapText(text, maxCharsPerLine, maxLines = 3) {
  if (!text) return [''];

  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          // Add ellipsis to last line if we're cutting off
          lines[lines.length - 1] = truncateWithEllipsis(lines[lines.length - 1], maxCharsPerLine - 3) + '...';
          return lines;
        }
      }
      // Handle very long words
      if (word.length > maxCharsPerLine) {
        currentLine = word.substring(0, maxCharsPerLine - 1) + '-';
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function truncateWithEllipsis(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.substring(0, maxLen);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
