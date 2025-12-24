---
name: feature-implementer
description: Executes feature implementation phase-by-phase based on existing plan documents. Updates progress, runs quality checks, tracks changes, and provides risk assessments. Use when implementing planned features, executing development phases, building according to plans, or coding from structured roadmaps. Keywords: implement, execute, build, code, develop, start implementation, continue implementation, phase execution.
---

# Feature Implementer

## Purpose
Execute feature implementation following structured plans with:
- Phase-by-phase execution with user approval between phases
- Real-time checkbox updates in plan document
- Quality gate validation after each phase
- Change tracking and risk assessment
- Git integration with automatic commits
- Dry-run mode for preview
- Destructive operation warnings

## Execution Workflow

### Step 1: Plan Discovery and Loading
1. Ask user for plan document path or search `docs/plans/` directory
2. Read plan document and parse structure
3. Identify current phase (first unchecked phase)
4. Display plan overview and current progress
5. Confirm with user before starting

### Step 2: Dry-Run Mode (Optional)
Before making actual changes, offer dry-run mode:
- "Run in dry-run mode first to preview changes? (Y/n)"
- If yes: Analyze what would change without modifying files
- Show preview of files to be created/modified/deleted
- Display risk assessment
- After preview, ask: "Proceed with actual implementation? (Y/n)"

### Step 3: Phase Execution Loop
For each phase:

**A. Pre-Phase Check**
- Display phase name, goal, and tasks
- Analyze risk level based on operations:
  - 🟢 Low: New files, additive code, documentation
  - 🟡 Medium: Modifying existing code, configuration changes
  - 🟠 High: Database migrations, API changes, dependency updates
  - 🔴 Critical: File deletions, breaking changes, security modifications
- If High/Critical risk: Require explicit confirmation
- Ask: "Ready to start Phase N: [Name]? (Y/n)"

**B. Task Execution**
For each task in phase:
1. Execute the implementation
2. Track files created/modified/deleted
3. Mark checkbox [x] in plan document immediately
4. Update task status in real-time

**C. Destructive Operation Handling**
Before any destructive operation:
- File deletion: "⚠️ About to DELETE [file]. This is IRREVERSIBLE. Confirm? (Y/n)"
- Breaking changes: "⚠️ This change BREAKS existing API. Confirm? (Y/n)"
- Database drops: "🔴 CRITICAL: About to drop table/data. Confirm? (Y/n)"
- Require explicit "Y" confirmation, default to abort

**D. Phase Completion**
1. Update phase status: ⏳ Pending → 🔄 In Progress → ✅ Complete
2. Update "Last Updated" date in plan
3. Record actual time spent
4. Add notes to plan document if any deviations occurred

### Step 4: Quality Gate Validation
After phase completion:

**A. Extract Validation Commands**
- Read validation commands from plan's Quality Gate section
- If not specified, use project-detected defaults

**B. Run All Checks**
Execute each validation command:
```bash
flutter test
flutter analyze
dart format --set-exit-if-changed .
```

**C. Track Results**
- ✅ Command passed
- ❌ Command failed (capture error output)

**D. Failure Handling**
If quality gate fails:
- **Attempt 1**: Show errors, ask "Fix and retry? (Y/n)"
- **Attempt 2**: Show errors, ask "Retry? (Y/n)"
- **Attempt 3**: Show errors, analyze potential problems, ask user

On 3rd failure, provide problem analysis:
```markdown
## Quality Gate Failed After 3 Attempts

### Failed Checks
- ❌ `flutter analyze` - 5 errors in lib/data/models/

### Potential Problems Identified
1. Type mismatch in DateModel.fromJson() - expecting String but got int
2. Missing null safety operators in 3 locations
3. Import statement references non-existent file

### Suggested Actions
- Review error output above for specific line numbers
- Check if plan tasks were incomplete or misunderstood
- Consider reverting this phase and revising approach

### Options
- Continue anyway (skip quality gate) - NOT RECOMMENDED
- Pause implementation to debug
- Abort and restore to previous phase
- Get help/clarification

Continue despite failures? (Y/n)
```

**E. Success Path**
If all checks pass:
- Mark all quality gate items [x] in plan
- Proceed to change summary

### Step 5: Change Summary & Risk Briefing
Use change-summary-template.md to generate:

```markdown
## Phase N Complete: [Phase Name]

### Files Changed (X files)
**Created** (Y files):
- ✅ `lib/domain/entities/partner.dart` (🟢 Low risk - new entity)
- ✅ `lib/data/models/date_model.dart` (🟢 Low risk - new model)

**Modified** (Z files):
- ✅ `lib/injection.dart` (🟡 Medium risk - added 3 new dependencies)
- ✅ `lib/core/database/app_database.dart` (🟠 High risk - schema changes)

**Deleted** (0 files):
- None

### Changes Summary
- Added 3 new entity classes (Partner, Date, Note)
- Added 3 corresponding Drift models with JSON serialization
- Updated dependency injection to register new repositories
- **⚠️ Database schema change**: Added 3 new tables via Drift migration

### Risk Assessment
**Overall Risk**: 🟠 High

**Destructive Changes**: None

**Potentially Harmful Changes**:
- Database migration (lib/core/database/app_database.dart)
  - Risk: Existing app data may need migration
  - Impact: App may crash if migration fails on user devices
  - Mitigation: Test migration with existing data before release

**Dependencies Added**:
- None

**Breaking Changes**: None

### Quality Gate Results
✅ Build successful (flutter build --debug)
✅ All tests pass (18 passed, 0 failed)
✅ Analysis clean (flutter analyze - 0 issues)
✅ Formatting consistent (dart format)

### Git Status
Branch: feature/semantic-search
Uncommitted changes: 5 files
```

### Step 6: Git Integration
After successful quality gate and change summary:

**A. Stage Changes**
```bash
git add [all modified files from this phase]
```

**B. Create Commit**
```bash
git commit -m "Phase N complete: [Phase Name]

- Task 1: [description]
- Task 2: [description]
- Task 3: [description]

Quality gates: All passed
Risk level: [Low/Medium/High/Critical]
"
```

**C. Confirm with User**
Show commit message and ask: "Commit these changes? (Y/n)"
- If Y: Execute commit
- If n: Leave changes staged but uncommitted

**D. Optional Tagging**
Ask: "Create git tag for this phase? (Y/n)"
- If Y: Create tag `phase-N-complete`

### Step 7: Inter-Phase Approval
Before starting next phase:

**A. Show Progress**
```markdown
## Implementation Progress

✅ Phase 1: Database Schema (2.1 hours) - Complete
✅ Phase 2: Entity Models (1.5 hours) - Complete
⏳ Phase 3: Repository Layer (3 hours) - Next
⏳ Phase 4: BLoC State Management (2 hours)
⏳ Phase 5: UI Components (4 hours)

Overall: 40% complete (2 of 5 phases)
```

**B. Ask for Continuation**
"Continue to Phase 3: Repository Layer? (Y/n/pause)"
- Y: Proceed to next phase
- n: Stop implementation, save progress
- pause: Save progress, allow resume later

### Step 8: Change Tracking
Maintain session-level tracking of all changes:

```markdown
## Session Change Log

### Phase 1
- Created: 3 files
- Modified: 1 file
- Deleted: 0 files
- Risk: High (database migration)

### Phase 2
- Created: 3 files
- Modified: 2 files
- Deleted: 0 files
- Risk: Low (entity classes)

### Total Session Impact
- Files created: 6
- Files modified: 3
- Files deleted: 0
- Highest risk level: High
- Git commits: 2
```

## Dry-Run Mode

### Activation
- Automatically offer before starting: "Preview changes in dry-run mode? (Y/n)"
- Can be explicitly requested: "Run dry-run first"

### Behavior
1. **Analyze without executing**: Read plan tasks, determine what would change
2. **File preview**:
   ```
   Would create:
   - lib/domain/entities/partner.dart (~150 lines)
   - lib/data/models/partner_model.dart (~200 lines)

   Would modify:
   - lib/injection.dart (add 15 lines)
   - lib/core/database/app_database.dart (add 50 lines)

   Would delete:
   - None
   ```

3. **Risk preview**: Show estimated risk level
4. **No actual changes**: No files modified, no git operations
5. **After preview**: "Proceed with actual implementation? (Y/n)"

## Destructive Operation Warnings

### File Deletion
Before deleting any file:
```
⚠️  DESTRUCTIVE OPERATION WARNING

About to DELETE: lib/old/deprecated_service.dart

This operation:
- Is IRREVERSIBLE (file will be permanently removed)
- May break code that imports this file
- Cannot be undone by quality gates

Recommendation: Verify no active imports before proceeding

Type 'DELETE' to confirm, or 'n' to skip: _
```

Require typing "DELETE" (case-sensitive) for confirmation.

### Breaking API Changes
Before modifying public APIs:
```
⚠️  BREAKING CHANGE WARNING

About to modify: lib/core/api/auth_service.dart
Change: Remove method signInWithEmail()

This change:
- BREAKS existing code using this method
- Requires updates in dependent files
- May cause runtime errors if not fully migrated

Impact analysis: Found 7 usages in codebase

Continue? (Y/n): _
```

### Database Destructive Operations
```
🔴 CRITICAL OPERATION WARNING

About to execute: DROP TABLE users

This operation:
- Permanently DELETES user data
- Cannot be recovered without backup
- Will break app if data still needed

DANGER LEVEL: CRITICAL

Type 'I UNDERSTAND THE RISK' to proceed: _
```

### Security-Related Changes
```
⚠️  SECURITY CHANGE WARNING

About to modify: lib/core/auth/token_manager.dart
Change: Authentication logic modification

This change affects:
- User authentication flow
- Security token handling
- Session management

Recommendation: Extra thorough testing required

Continue? (Y/n): _
```

## Change Tracking System

### Per-Phase Tracking
Track for each phase:
- Files created (list with line counts)
- Files modified (list with change descriptions)
- Files deleted (list)
- Risk classifications
- Time spent
- Quality gate results

### Session Aggregation
Aggregate across all phases in current session:
- Total files affected
- Cumulative risk assessment
- Total commits made
- Overall progress percentage

### Plan Document Updates
After each phase, append to Notes section:
```markdown
### Phase N Implementation Notes (YYYY-MM-DD HH:MM)
- Created 3 new entity files
- Modified database schema (migration #005)
- All quality gates passed on first attempt
- No blockers encountered
- Time: 2.1 hours (estimated: 2 hours, variance: +6%)
```

## Git Integration Details

### Commit Strategy
After each successful phase:
1. Stage only files modified in this phase
2. Generate descriptive commit message with:
   - Phase name and number
   - Task list
   - Quality gate status
   - Risk level
3. Ask user approval before committing
4. Execute commit if approved

### Commit Message Template
```
Phase N complete: [Phase Name]

Tasks completed:
- Task N.1: [description]
- Task N.2: [description]
- Task N.3: [description]

Quality gates: All passed
Risk level: [Low/Medium/High/Critical]
Files changed: X created, Y modified, Z deleted

[Optional: Additional context]
```

### Branch Management
- Work on current branch (don't create/switch)
- Suggest creating feature branch if on main/master
- Tag each phase completion (optional)

### No Auto-Push
- Never automatically push to remote
- Leave that decision to user
- Can suggest pushing after major milestones

## Quality Gate Failure Protocol

### Attempt Tracking
Track failures per quality gate check:
- Attempt 1: Show error, auto-suggest retry
- Attempt 2: Show error, ask if user wants to retry
- Attempt 3: Show error + analysis + options

### Problem Analysis (After 3rd Failure)
Analyze and brief user on potential issues:

**For Build Failures**:
- Missing dependencies in pubspec.yaml
- Syntax errors in generated code
- Import path issues
- Platform-specific build problems

**For Test Failures**:
- New code not covered by tests
- Breaking changes affecting test assertions
- Mock/stub issues
- Async timing problems

**For Linting Failures**:
- Code style violations
- Unused imports
- Naming convention violations
- Documentation missing

**For Type Errors**:
- Null safety violations
- Type mismatches
- Missing type annotations
- Generic type issues

### User Options After 3 Failures
1. **Continue anyway** (skip quality gate) - Mark as ⚠️ in plan
2. **Pause implementation** - Save progress, let user fix manually
3. **Abort phase** - Mark phase as blocked, stop
4. **Get detailed analysis** - Show full error context with suggestions

## Resume Capability

### Detecting Current State
When starting:
1. Read plan document
2. Find first phase with unchecked tasks or ⏳ Pending status
3. Show: "Detected incomplete Phase N. Resume from here? (Y/n)"
4. If previous phase has unchecked tasks: "Phase N-1 incomplete. Resume there? (Y/n)"

### Mid-Phase Resume
If phase has some checked tasks:
- Show completed tasks
- Show remaining tasks
- Ask: "Resume Phase N from Task N.X? (Y/n)"
- Continue from that point

## Supporting Files Reference
- [change-summary-template.md](change-summary-template.md) - Template for change briefings
