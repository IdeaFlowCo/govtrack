# Mockup Notes

## v3-comprehensive.html (2026-01-17)
**Status: Good baseline mockup**

This mockup successfully integrates:
- All 4 entity types with visual language
- Full capture → classify → route flow
- Relationship visualization on cards and detail pages
- Board, Heatmap, and feed views
- User/Government profiles
- Comments, @mentions, support system
- Review queue for AI classification

Ready for implementation reference.

---

## v4-improved.html (2026-01-17)
**Status: Comprehensive - all brainstormed workflows covered**

### Added in v4:
- Graph view (force-directed D3 visualization) with zoom controls
- Dedicated Mentions page showing where user was @mentioned
- Idea-to-idea relationships (complements, alternative, requires)
- Similar/duplicate detection UI with AI confidence percentages
- Merged submissions indicator on Ideas

### Workflow Verification (govtrack-9vv)

| Workflow | Covered | Notes |
|----------|---------|-------|
| 4 entity types (Goal/Problem/Idea/Action) | ✅ | Color-coded badges |
| Problem → Goal "threatens" | ✅ | Shown in relationships |
| Idea → Problem "addresses" | ✅ | Shown in relationships |
| Idea → Goal "pursues" | ✅ | Shown in relationships |
| Action → Idea "implements" | ✅ | Shown in relationships |
| Action → Action "depends_on" | ✅ | Action detail page |
| Idea-to-idea relationships | ✅ | Added in v4 (complements, alternative, requires, similar) |
| AI classification + Review Queue | ✅ | Capture modal + Review Queue page |
| Similar/duplicate detection | ✅ | Added in v4 - AI badge with similarity % |
| Supporter tracking for Ideas | ✅ | Support button + count |
| Progress tracking on Goals | ✅ | Progress bars |
| Comments with @mentions | ✅ | Comment threads |
| Notifications | ✅ | Notifications page |
| Dedicated Mentions view | ✅ | Added in v4 |
| User profiles | ✅ | Profile page |
| Government profiles | ✅ | Government page |
| Board view (4-column) | ✅ | Board page |
| Graph view (force-directed) | ✅ | Added in v4 |
| Heatmap view | ✅ | Heatmap page |

### Remaining Gap:
- **Mobile capture experience** - Was in v2-twitter-style-draft but not in v4
  - Could add as separate page or keep mobile as responsive version of capture modal
  - Low priority if desktop capture modal works on mobile
