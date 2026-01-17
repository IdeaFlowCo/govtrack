# Comprehensive Audit: v4 Mockup vs Brainstorming Session

**Date:** 2026-01-17
**Source:** docs/claude-session-80a-design-readable.txt, open tickets

---

## 1. Core 4-Column Model

| Requirement | v4 Status | Notes |
|-------------|-----------|-------|
| Goals column | ✅ | Green badges, progress bars |
| Problems column | ✅ | Red badges, location support |
| Ideas column | ✅ | Blue badges, support counts |
| Actions column | ✅ | Orange badges, due dates |
| Board view showing all 4 | ✅ | Board page with columns |
| Graph view (force-directed) | ✅ | Added in v4 |

---

## 2. Cross-Column Relationships

| Relationship | Direction | v4 Status | Notes |
|--------------|-----------|-----------|-------|
| `threatens` | Problem → Goal | ✅ | Shown in Goal detail |
| `addresses` | Idea → Problem | ✅ | Shown in Idea detail |
| `pursues` | Idea → Goal (proactive) | ✅ | Shown in Idea detail |
| `implements` | Action → Idea | ✅ | Shown in Action detail |
| `depends_on` | Action → Action | ✅ | Shown in Action detail |

---

## 3. Idea-to-Idea Relationships (from session lines 1327-1527)

| Relationship | Meaning | v4 Status | Notes |
|--------------|---------|-----------|-------|
| `complements` | Better together | ✅ | Added in v4, shown on Idea detail |
| `requires` | Won't work without | ✅ | Added in v4 |
| `conflicts` | Mutually exclusive | ❌ | **NOT shown** |
| `alternative` | Different approaches | ✅ | Added in v4 |
| `extends` | Builds on another | ❌ | **NOT shown** |
| `similar` | Overlapping | ✅ | Added in v4 with AI badge |
| `duplicate` | Same, merge | ⚠️ | Implied by "merged from" but no explicit UI |
| `supersedes` | Replaces older | ❌ | **NOT shown** |

---

## 4. Similar/Duplicate Detection (from session lines 1424-1529)

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| AI detects similar submissions | ✅ | Shows "Similar ideas detected" with % |
| Supporter counting | ✅ | "128 supporters" on Ideas |
| Merged submissions indicator | ✅ | "(merged from 3 submissions)" |
| Prompt to confirm merge | ❌ | **NOT shown** - "Is this same as existing?" flow |
| Trending by supporter count | ✅ | Right sidebar shows trending |

---

## 5. Progress Tracking (Goals)

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| Progress bar on Goals | ✅ | Shows % complete |
| "X/Y problems being addressed" | ✅ | Shown in progress label |
| Color coding (low/medium/high) | ✅ | Red/orange/green |

---

## 6. AI Classification & Capture Flow

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| Capture modal | ✅ | Desktop capture modal |
| AI classification preview | ✅ | Shows type badges in capture modal |
| >90% auto-apply | ⚠️ | Implied but not explicitly shown |
| 70-90% review queue | ✅ | Review Queue page |
| <70% unclassified | ⚠️ | Implied but not explicitly shown |
| Confidence percentage display | ✅ | In Review Queue |

---

## 7. Epics & Dependencies (from session lines 880-949)

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| Epics (group Actions) | ❌ | **NOT shown** - no epic grouping UI |
| `depends_on` between Actions | ✅ | Shown in Action detail |
| Cross-idea dependencies | ⚠️ | Implied but not clearly shown |
| Dependency chain visualization | ❌ | **NOT shown** |

---

## 8. User Features

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| User profile | ✅ | Profile page |
| Submissions tab | ✅ | On profile |
| Supported tab | ✅ | On profile |
| Comments tab | ✅ | On profile |
| Mentions tab | ✅ | Added in latest update |
| Government profile | ✅ | Government page |

---

## 9. Notifications

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| @mentions | ✅ | Notification + dedicated page |
| Support activity | ✅ | In notifications |
| Status updates | ✅ | In notifications |
| Unread indicator | ✅ | Badge on nav |

---

## 10. Mobile Capture (from govtrack-buk, govtrack-ft8)

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| Mobile capture mockup | ❌ | **In v2 only, not in v4** |
| Touch-optimized UI | ❌ | Not in v4 |
| Camera integration | ⚠️ | Icon in capture modal, no mobile-specific |
| GPS location | ⚠️ | Icon in capture modal |
| Quick "3 taps to post" | ❌ | Not in v4 |

---

## 11. Active Hazard Reporting (from govtrack-ft8)

| Feature | v4 Status | Notes |
|---------|-----------|-------|
| Urgency levels (Critical/High/Medium) | ❌ | **NOT shown anywhere** |
| One-tap emergency report | ❌ | **NOT shown** |
| Voice-to-text | ❌ | **NOT shown** |
| Offline mode indicator | ❌ | **NOT shown** |
| Estimated response time | ❌ | **NOT shown** |
| Auto-expiration for time-bound | ❌ | **NOT shown** |

---

## 12. Compelling Use Cases (from session lines 957-1233)

The brainstorming covered use cases for:
- Participatory budgeting
- School district planning
- Neighborhood associations
- Climate action plans
- Public health

**v4 Status:** The mockup uses San Francisco civic examples which align with these use cases, but could better demonstrate:
- ❌ **Budget/cost information** on Actions
- ❌ **Voting/ranking** on Ideas for participatory budgeting
- ❌ **Timeline/milestone** views

---

## Summary: Critical Gaps

### Must Fix (Core Model Gaps)
1. **Epics UI** - No way to see Action groupings
2. **Dependency visualization** - No chain/graph view for Action deps
3. **conflicts/extends/supersedes** idea relationships
4. **Merge confirmation flow** - "Is this same as existing?" prompt

### Should Add (Feature Gaps)
5. **Mobile capture in v4** - Currently only in v2
6. **Urgency/priority selector** - For hazard reporting
7. **One-tap emergency mode** - Quick hazard capture
8. **Budget/cost on Actions** - For participatory budgeting

### Nice to Have
9. Voice-to-text input
10. Offline mode indicator
11. Estimated response time
12. Timeline/milestone view

---

## Recommendation

Create tickets for the critical gaps and add them to v4 or a v5 mockup.
