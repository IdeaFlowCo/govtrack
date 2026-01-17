/**
 * GovTrack Board View - 4-Column Visualization
 * Uses D3.js for curved Bezier connections between entities
 */

let entities = [];
let graphData = { nodes: [], edges: [] };
let selectedEntityId = null;
let cardPositions = new Map();

// Column type to DOM element ID mapping
const columnMap = {
  goal: 'goals-column',
  problem: 'problems-column',
  idea: 'ideas-column',
  action: 'actions-column'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadGovernments();
  await loadData();
  setupEventListeners();
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
  const statusFilter = document.getElementById('status-filter').value;

  let url = '/api/graph?';
  if (govFilter) url += `gov_id=${govFilter}&`;
  if (statusFilter) url += `status=${statusFilter}&`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      graphData = data.data;
      renderBoard();
    }
  } catch (err) {
    console.error('Failed to load graph data:', err);
  }
}

function renderBoard() {
  // Clear columns
  Object.values(columnMap).forEach(id => {
    document.getElementById(id).innerHTML = '';
  });
  cardPositions.clear();

  // Group entities by type
  const byType = {
    goal: [],
    problem: [],
    idea: [],
    action: []
  };

  graphData.nodes.forEach(node => {
    if (byType[node.type]) {
      byType[node.type].push(node);
    }
  });

  // Update counts
  document.getElementById('goals-count').textContent = byType.goal.length;
  document.getElementById('problems-count').textContent = byType.problem.length;
  document.getElementById('ideas-count').textContent = byType.idea.length;
  document.getElementById('actions-count').textContent = byType.action.length;

  // Render cards in each column
  Object.entries(byType).forEach(([type, items]) => {
    const column = document.getElementById(columnMap[type]);
    items.forEach(item => {
      const card = createCard(item);
      column.appendChild(card);
    });
  });

  // Calculate card positions after render
  requestAnimationFrame(() => {
    updateCardPositions();
    renderConnections();
  });
}

function createCard(entity) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = entity.id;
  card.dataset.type = entity.type;

  // Count relations
  const relCount = graphData.edges.filter(e => e.source === entity.id || e.target === entity.id).length;

  card.innerHTML = `
    <div class="card-title">${escapeHtml(entity.title)}</div>
    <div class="card-meta">
      <span class="badge priority-${entity.priority}">P${entity.priority}</span>
      <span class="status">${entity.status}</span>
      ${entity.government ? `<span class="badge">${entity.government.name}</span>` : ''}
    </div>
    ${relCount > 0 ? `<div class="relation-indicator">${relCount} link${relCount > 1 ? 's' : ''}</div>` : ''}
  `;

  card.addEventListener('click', () => selectEntity(entity.id));
  card.addEventListener('mouseenter', () => highlightConnections(entity.id));
  card.addEventListener('mouseleave', () => clearHighlights());

  return card;
}

function updateCardPositions() {
  document.querySelectorAll('.card').forEach(card => {
    const rect = card.getBoundingClientRect();
    const boardRect = document.getElementById('board').getBoundingClientRect();
    cardPositions.set(card.dataset.id, {
      x: rect.left - boardRect.left + rect.width / 2,
      y: rect.top - boardRect.top + rect.height / 2,
      width: rect.width,
      height: rect.height,
      left: rect.left - boardRect.left,
      right: rect.right - boardRect.left,
      top: rect.top - boardRect.top,
      bottom: rect.bottom - boardRect.top
    });
  });
}

function renderConnections() {
  const svg = d3.select('#connections');
  svg.selectAll('*').remove();

  const showConnections = document.getElementById('show-connections').checked;
  if (!showConnections) return;

  const boardRect = document.getElementById('board').getBoundingClientRect();
  svg.attr('width', boardRect.width)
     .attr('height', boardRect.height);

  // Column order for determining flow direction
  const columnOrder = { goal: 0, problem: 1, idea: 2, action: 3 };

  // Track edge indices for offsetting multiple edges between same columns
  const edgeOffsets = new Map();

  // Draw edges as curved Bezier paths
  graphData.edges.forEach(edge => {
    const sourcePos = cardPositions.get(edge.source);
    const targetPos = cardPositions.get(edge.target);

    if (!sourcePos || !targetPos) return;

    // Get entity types to determine column positions
    const sourceNode = graphData.nodes.find(n => n.id === edge.source);
    const targetNode = graphData.nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const sourceCol = columnOrder[sourceNode.type];
    const targetCol = columnOrder[targetNode.type];

    let sourceX, sourceY, targetX, targetY;
    let controlX1, controlY1, controlX2, controlY2;

    // Same column - arc to the side
    if (sourceCol === targetCol) {
      // Both on right side of cards, arc outward
      sourceX = sourcePos.right;
      sourceY = sourcePos.y;
      targetX = targetPos.right;
      targetY = targetPos.y;

      const arcOffset = 80; // How far the curve extends outward
      const midY = (sourceY + targetY) / 2;

      controlX1 = sourceX + arcOffset;
      controlY1 = sourceY;
      controlX2 = targetX + arcOffset;
      controlY2 = targetY;
    }
    // Source is to the LEFT of target (normal flow: Goal→Problem→Idea→Action)
    else if (sourceCol < targetCol) {
      sourceX = sourcePos.right;
      sourceY = sourcePos.y;
      targetX = targetPos.left;
      targetY = targetPos.y;

      const controlOffset = Math.abs(targetX - sourceX) * 0.4;
      controlX1 = sourceX + controlOffset;
      controlY1 = sourceY;
      controlX2 = targetX - controlOffset;
      controlY2 = targetY;
    }
    // Source is to the RIGHT of target (reverse flow: Problem→Goal with "threatens")
    else {
      sourceX = sourcePos.left;
      sourceY = sourcePos.y;
      targetX = targetPos.right;
      targetY = targetPos.y;

      const controlOffset = Math.abs(sourceX - targetX) * 0.4;
      controlX1 = sourceX - controlOffset;
      controlY1 = sourceY;
      controlX2 = targetX + controlOffset;
      controlY2 = targetY;
    }

    const path = d3.path();
    path.moveTo(sourceX, sourceY);
    path.bezierCurveTo(controlX1, controlY1, controlX2, controlY2, targetX, targetY);

    svg.append('path')
       .attr('class', `connection-line ${edge.type}`)
       .attr('d', path.toString())
       .attr('data-source', edge.source)
       .attr('data-target', edge.target)
       .attr('data-type', edge.type);
  });
}

function highlightConnections(entityId) {
  // Dim all cards
  document.querySelectorAll('.card').forEach(card => {
    card.classList.add('dimmed');
  });

  // Highlight selected card
  const selectedCard = document.querySelector(`.card[data-id="${entityId}"]`);
  if (selectedCard) {
    selectedCard.classList.remove('dimmed');
    selectedCard.classList.add('highlighted');
  }

  // Find connected entities
  const connectedIds = new Set([entityId]);
  graphData.edges.forEach(edge => {
    if (edge.source === entityId) {
      connectedIds.add(edge.target);
    }
    if (edge.target === entityId) {
      connectedIds.add(edge.source);
    }
  });

  // Highlight connected cards
  connectedIds.forEach(id => {
    const card = document.querySelector(`.card[data-id="${id}"]`);
    if (card) {
      card.classList.remove('dimmed');
    }
  });

  // Highlight connected lines
  document.querySelectorAll('.connection-line').forEach(line => {
    const source = line.getAttribute('data-source');
    const target = line.getAttribute('data-target');
    if (source === entityId || target === entityId) {
      line.classList.add('highlighted');
    }
  });
}

function clearHighlights() {
  document.querySelectorAll('.card').forEach(card => {
    card.classList.remove('dimmed', 'highlighted');
  });
  document.querySelectorAll('.connection-line').forEach(line => {
    line.classList.remove('highlighted');
  });
}

async function selectEntity(entityId) {
  selectedEntityId = entityId;
  await loadEntityDetails(entityId);
  document.getElementById('detail-panel').classList.add('open');
}

async function loadEntityDetails(entityId) {
  try {
    const res = await fetch(`/api/entities/${entityId}`);
    const data = await res.json();
    if (data.success) {
      renderDetailPanel(data.data);
    }
  } catch (err) {
    console.error('Failed to load entity details:', err);
  }
}

function renderDetailPanel(entity) {
  document.getElementById('detail-title').textContent = entity.title;

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="detail-section">
      <h3>Info</h3>
      <p><strong>ID:</strong> ${entity.id}</p>
      <p><strong>Type:</strong> ${entity.type}</p>
      <p><strong>Status:</strong> ${entity.status}</p>
      <p><strong>Priority:</strong> P${entity.priority}</p>
      ${entity.government ? `<p><strong>Government:</strong> ${entity.government.name}</p>` : ''}
      <p><strong>Created:</strong> ${new Date(entity.created_at).toLocaleDateString()}</p>
    </div>

    ${entity.body ? `
    <div class="detail-section">
      <h3>Description</h3>
      <p>${escapeHtml(entity.body)}</p>
    </div>
    ` : ''}

    ${entity.relationsInfo && entity.relationsInfo.outgoing.length > 0 ? `
    <div class="detail-section">
      <h3>Outgoing Relations</h3>
      <ul class="relation-list">
        ${entity.relationsInfo.outgoing.map(rel => `
          <li onclick="selectEntity('${rel.target}')">
            <strong>${rel.type}</strong> &rarr; ${rel.targetEntity ? escapeHtml(rel.targetEntity.title) : rel.target}
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${entity.relationsInfo && entity.relationsInfo.incoming.length > 0 ? `
    <div class="detail-section">
      <h3>Incoming Relations</h3>
      <ul class="relation-list">
        ${entity.relationsInfo.incoming.map(rel => `
          <li onclick="selectEntity('${rel.source}')">
            ${rel.sourceEntity ? escapeHtml(rel.sourceEntity.title) : rel.source} &rarr; <strong>${rel.type}</strong>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    ${entity.type === 'idea' ? `
    <div class="detail-section">
      <h3>Support</h3>
      <p><strong>Support count:</strong> ${entity.support_count || 0}</p>
      ${entity.supporters && entity.supporters.length > 0 ? `
        <p><strong>Supporters:</strong> ${entity.supporters.join(', ')}</p>
      ` : ''}
    </div>
    ` : ''}

    ${entity.type === 'action' ? `
    <div class="detail-section">
      <h3>Action Details</h3>
      ${entity.assignee ? `<p><strong>Assignee:</strong> ${escapeHtml(entity.assignee)}</p>` : ''}
      ${entity.due_date ? `<p><strong>Due date:</strong> ${new Date(entity.due_date).toLocaleDateString()}</p>` : ''}
    </div>
    ` : ''}

    ${entity.type === 'problem' && entity.location ? `
    <div class="detail-section">
      <h3>Location</h3>
      <p>${escapeHtml(entity.location.address || 'N/A')}</p>
      ${entity.location.lat ? `<p>Lat: ${entity.location.lat}, Lng: ${entity.location.lng}</p>` : ''}
    </div>
    ` : ''}
  `;
}

function closeDetailPanel() {
  document.getElementById('detail-panel').classList.remove('open');
  selectedEntityId = null;
}

function setupEventListeners() {
  document.getElementById('gov-filter').addEventListener('change', loadData);
  document.getElementById('status-filter').addEventListener('change', loadData);
  document.getElementById('show-connections').addEventListener('change', renderConnections);

  // Redraw connections on window resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateCardPositions();
      renderConnections();
    }, 100);
  });

  // Close detail panel on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDetailPanel();
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
