# Phase Change Summary Template

## Phase [N] Complete: [Phase Name]

**Duration**: [X hours] (Estimated: [Y hours], Variance: [±Z%])
**Status**: ✅ Complete
**Date**: YYYY-MM-DD HH:MM

---

### Files Changed ([Total] files)

#### Created ([Count] files)
- ✅ `path/to/file.dart` ([Lines] lines)
  - Risk: 🟢 Low
  - Purpose: [Brief description]

#### Modified ([Count] files)
- ✅ `path/to/file.dart` ([+X/-Y] lines)
  - Risk: 🟡 Medium
  - Changes: [Brief description]

#### Deleted ([Count] files)
- ❌ `path/to/file.dart`
  - Risk: 🔴 Critical
  - Reason: [Why deleted]

---

### Changes Summary

**What was built**:
- [Major deliverable 1]
- [Major deliverable 2]
- [Major deliverable 3]

**Technical details**:
- [Implementation detail 1]
- [Implementation detail 2]

**Database changes** (if any):
- Schema: [Changes to schema]
- Migrations: [Migration details]

**API changes** (if any):
- New endpoints: [List]
- Modified endpoints: [List]
- Breaking changes: [List]

---

### Risk Assessment

**Overall Risk Level**: [🟢 Low | 🟡 Medium | 🟠 High | 🔴 Critical]

#### Destructive Changes
[None | List destructive operations performed]

#### Potentially Harmful Changes
1. **[Change description]**
   - Risk: [Why this is risky]
   - Impact: [What could break]
   - Mitigation: [How to handle it]

#### Dependencies Changed
**Added**:
- [package-name]: version [X.Y.Z]

**Updated**:
- [package-name]: [old-version] → [new-version]

**Removed**:
- [package-name]: version [X.Y.Z]

#### Breaking Changes
[None | List of breaking changes with migration notes]

---

### Quality Gate Results

**Build**:
- ✅ Command: `flutter build --debug`
- Result: Success

**Tests**:
- ✅ Command: `flutter test`
- Result: [X] passed, [Y] failed
- Coverage: [Z%]

**Analysis**:
- ✅ Command: `flutter analyze`
- Result: [X] issues found

**Formatting**:
- ✅ Command: `dart format --set-exit-if-changed .`
- Result: [All files formatted | X files need formatting]

**Type Safety**:
- ✅ No type errors detected

**Security**:
- ✅ No new vulnerabilities introduced

**Performance**:
- ✅ No regressions detected

---

### Git Information

**Branch**: [branch-name]
**Commit**: [commit-hash]
**Commit Message**:
```
[Full commit message]
```

**Files Staged**: [X] files
**Lines Changed**: +[additions] -[deletions]

---

### Next Steps

**Immediate actions**:
- [ ] [Action item if any]

**Before next phase**:
- [ ] Review changes
- [ ] Test functionality manually
- [ ] Verify no regressions

**Phase [N+1] Preview**:
- Goal: [Next phase goal]
- Estimated time: [X hours]
- Expected risk: [Low/Medium/High/Critical]

---

### Notes

[Any additional context, discoveries, or deviations from plan]
