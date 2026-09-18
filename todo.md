# RupiBook — UX & Feature Fixes (from user testing)

## 1. Pull-to-refresh — keep spinner until sync completes + toast on done
- [ ] Show spinner **after release** until `onRefresh()` resolves
- [ ] Show success toast "Synced" / "All caught up" when done
- [ ] PWA: hard refresh (reload) when pull-to-refresh triggered

## 2. Dashboard charts — remove ugly white box on click
- [ ] The Card `hover:bg-surface-2` on clickable charts shows white flash
- [ ] Make chart areas non-interactive or use subtle feedback

## 3. Settings — fix category reorder + delete
- [ ] Replace arrow buttons with **drag-to-reorder** (native HTML5 drag or react-beautiful-dnd)
- [ ] Fix delete category error: "[object Object]" → show actual error message
- [ ] Add confirmation before delete (if expenses reference it)

## 4. Expense swipe actions (Gmail/Apple Mail style)
- [ ] **Swipe right** → delete (red background, trash icon, confirm)
- [ ] **Swipe left** → edit (blue background, pencil icon, opens ExpenseSheet)
- [ ] Smooth spring animation, haptic feedback
- [ ] Works on Dashboard "Recent" + Analytics "Results" lists

## 5. Tab swipe navigation (Jacob's Law)
- [ ] Horizontal swipe on content area → switch tabs (Log ↔ Stats ↔ Search ↔ Settings)
- [ ] **Priority**: expense swipe actions (edit/delete) > tab navigation
- [ ] Edge swipe from left → go back (if in nested view like ExpenseSheet)
- [ ] Max 5 tabs: Log (Home, far left), Stats, Search, Profile (far right)
- [ ] **Move Settings out of bottom nav** → top-right header or Profile menu

## 6. Design / Jacob's Law compliance
- [ ] Home (Log) far left ✓
- [ ] Profile far right → add Profile tab/page, move Settings there
- [ ] Create (Plus) in middle → Log tab has + ✓
- [ ] Edge swipe back
- [ ] Pull to refresh ✓ (improve per #1)

---

## Clarifying questions before I start:

1. **Drag-to-reorder**: Use native HTML5 drag-and-drop (no deps) or a tiny library? Native is ~30 lines but touch support needs polyfill on mobile.
2. **Profile tab**: What goes in Profile? (User avatar, email, sign out, app version, maybe Settings link)
3. **Tab swipe**: Should it be a full-page swipe (like Instagram) or just the content area? Full-page feels more native.
4. **PWA hard refresh**: `location.reload()` or `serviceWorker.update()`? Former is simpler.
5. **Expense swipe on Dashboard/Analytics**: Both pages use similar ResultRow pattern — apply to both?

Confirm these and I'll implement in batches.