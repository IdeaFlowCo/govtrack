# GovTrack UI v3 - Comprehensive User Flow Integration

## Design Philosophy
Twitter-inspired components + GovTrack's unique civic governance model

## Key User Flows to Support

### 1. Capture Flow (Primary Action)
```
[Compose Button] → Capture Modal
  ├── Text input (required)
  ├── Photo/Media (optional)
  ├── Location (auto-detect or manual)
  ├── Government selector
  └── Submit → AI Classification
        ├── >90% confidence → Auto-apply type, show in feed
        ├── 70-90% confidence → Show suggestion, user confirms
        └── <70% confidence → Goes to Review Queue as "Unclassified"
```

### 2. Feed/Discovery
- **Home Feed**: All activity from followed governments
- **Explore**: Browse by government, entity type, trending
- **Entity Type Filters**: Goals | Problems | Ideas | Actions tabs

### 3. Entity Cards (Feed Items)
Each card shows:
- Entity type badge (colored: green/red/blue/orange)
- Title
- Preview text
- Author + timestamp
- Government badge
- Location (if Problem)
- Relationship count ("3 linked items")
- Support count (for Ideas)
- Comment count
- Progress bar (for Goals only)

### 4. Entity Detail View
- Full content with images
- Relationship section:
  - "This Problem threatens:" → linked Goals
  - "Ideas addressing this:" → linked Ideas
  - "Actions implementing:" → linked Actions
- Comments thread
- Support button (Ideas only)
- "Link to..." action to add relationships

### 5. Board View (4-Column)
- Goals | Problems | Ideas | Actions columns
- Cards within each column
- Curved Bezier connections between related entities
- Hover to highlight connections
- Click card → slide-out detail panel

### 6. Graph View (Force-Directed)
- Horizontal bands by entity type
- Node size by importance/support
- Edge colors by relationship type
- Zoom/pan navigation
- Click node → detail panel

### 7. Heatmap View
- Geographic distribution of Problems
- Cluster markers
- Filter by government, type, status
- Click cluster → list of issues

### 8. Review Queue (for moderators)
- Items with 70-90% AI confidence
- Show AI suggestion with confidence %
- Quick actions: Confirm, Change Type, Dismiss
- Bulk actions

### 9. Notifications
- @mentions in comments
- Updates to entities you created
- Updates to entities you supported
- New items in your government
- Weekly digest option

### 10. Profiles
**User Profile:**
- Cover photo, avatar, bio
- Stats: Submitted | Supported | Comments
- Tabs: Submissions | Supported Ideas | Activity

**Government Profile:**
- Cover photo, logo, description
- Stats: Goals | Problems | Ideas | Actions
- Progress overview (% of goals on track)
- Tabs: Feed | Board | Heatmap | Stats

---

## Page Structure

### Global Navigation (Left Sidebar)
```
[GovTrack Logo]
[Government Dropdown ▼]
─────────────────
🏠 Home
🔍 Explore
📋 Board
🗺️ Heatmap
🔔 Notifications (badge)
👤 Profile
─────────────────
[+ Capture] Button
─────────────────
[User Widget]
```

### Pages to Mock Up

1. **Home Feed** - Activity stream with entity cards
2. **Explore** - Discovery with filters, trending, governments
3. **Board** - 4-column kanban with connections
4. **Graph** - Force-directed network view
5. **Heatmap** - Geographic Problem distribution
6. **Notifications** - Activity feed for user
7. **User Profile** - User's submissions and activity
8. **Government Profile** - Government dashboard with tabs
9. **Entity Detail** - Full entity view with comments
10. **Review Queue** - AI classification review
11. **Capture Modal** - Quick capture with classification
12. **Search Results** - Search across all entities

### Right Sidebar (Contextual)
Changes based on current page:
- **Home**: Trending issues, suggested governments
- **Board**: Legend, filter controls
- **Entity Detail**: Related entities, similar items
- **Profile**: Stats, achievements
- **Government**: Key metrics, recent activity

---

## Entity Type Visual Language

| Type | Color | Icon | Status Options |
|------|-------|------|----------------|
| Goal | Green #4CAF50 | 🎯 | active, achieved, deprecated |
| Problem | Red #f44336 | ⚠️ | unacknowledged, acknowledged, being_addressed, resolved |
| Idea | Blue #2196F3 | 💡 | proposed, under_review, accepted, rejected |
| Action | Orange #FF9800 | ✓ | open, in_progress, blocked, completed |

---

## Relationship Visual Language

| Relationship | Line Style | Direction |
|-------------|------------|-----------|
| threatens | Red dashed | Problem → Goal |
| addresses | Blue solid | Idea → Problem |
| pursues | Green solid | Idea → Goal |
| implements | Orange solid | Action → Idea |
| depends_on | Purple dashed | Action → Action |

---

## Mobile Considerations
- Bottom tab navigation instead of left sidebar
- Swipe between Board columns
- Camera-first capture (tap to add text)
- Pull-to-refresh
- Infinite scroll feeds
