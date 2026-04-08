# 🧑‍💼 LEADERSHIP GUIDE: Git & Team Management

## As a Leader, Here's What You Should Do

---

## **GIT WORKFLOWS & BEST PRACTICES**

### 1. **Commit Frequency & Messaging** ✅ (Do This Constantly)

**COMMIT EVERY TIME YOU:**
- Complete a specific feature/function (not entire modules)
- Fix a bug
- Add tests
- Update documentation

**Format:**
```bash
# Feature
git commit -m "feat(orders): add order creation endpoint"

# Fix
git commit -m "fix(auth): correct password validation logic"

# Documentation
git commit -m "docs(orders): add API documentation for order endpoints"

# Test
git commit -m "test(orders): add unit tests for order service"

# Refactor (internal changes, no feature addition)
git commit -m "refactor(stock): simplify stock reservation logic"

# Chore (dependencies, config)
git commit -m "chore: update package.json dependencies"
```

**WHY:** Your team can:
- See exactly what you did and when
- Revert specific changes if needed
- Reference your work ("I need the logic from commit abc123")
- Understand the project history

---

### 2. **Push Regularly** ✅ (Every 1-2 Hours)

```bash
# Before leaving your seat, always:
git push origin master

# This allows team to pull your changes:
git pull origin master
```

**Why:** 
- Prevents lost work if your machine crashes
- Team can see your progress in real-time
- Reduces merge conflicts (everyone has latest code)

---

### 3. **Create a README with Setup Instructions** ✅

Update [README.md](README.md) with:

```markdown
# Magilam Foods Backend

Catering management system API built with Express.js and PostgreSQL.

## Tech Stack
- Node.js 18+
- Express.js
- PostgreSQL 14+
- JWT Authentication
- Joi for validation

## Quick Start

### 1. Clone and Install
\`\`\`bash
git clone <repo-url>
cd magilam-foods-backend
npm install
\`\`\`

### 2. Setup Environment
\`\`\`bash
cp .env.example .env
# Edit .env with your database credentials
\`\`\`

### 3. Initialize Database
\`\`\`bash
psql -h localhost -U postgres -d magilam < src/database/migrations/001_initial_schema.sql
\`\`\`

### 4. Start Development Server
\`\`\`bash
npm run dev
# Server runs on http://localhost:3000
\`\`\`

### 5. Run Tests
\`\`\`bash
npm test
\`\`\`

## API Documentation
See [docs/api/](docs/api/) for detailed endpoint documentation.

## Project Structure
\`\`\`
src/
├── modules/
│   ├── auth/
│   ├── orders/
│   ├── stock/
│   ├── menu/
│   ├── billing/
│   └── ml-costing/
├── middlewares/
├── shared/
│   ├── errors/
│   ├── utils/
│   └── constants/
├── config/
├── database/
└── app.js
\`\`\`

## Module Ownership (Team Assignments)
- **Auth Module:** Jai (Complete)
- **Orders Module:** Jai (In Progress)
- **Stock Module:** [Team Member]
- **Menu Module:** [Team Member]  
- **Billing Module:** [Team Member]
- **ML-Costing Module:** [Team Member]

## Development Guidelines
1. Never commit to master directly - use feature branches
2. Write tests for new features
3. Run \`npm run lint\` before committing
4. Follow the validation pattern in existing code
5. Always handle errors with AppError class

## API Base URL
- Development: http://localhost:3000/api/v1
- Production: https://api.magilamfoods.com/api/v1
```

---

## **AS LEADER: YOUR RESPONSIBILITIES**

### Daily Standup (5 minutes)
- [ ] Check git log: who committed what
```bash
git log --oneline --decorate --graph --all --author-date=relative
```
- [ ] Review commits since yesterday
- [ ] Ask team: "Any blockers?"

---

### Code Review & Quality Checks ✅

**Each day, review team members' work:**

```bash
# See what changed since last review
git log --oneline master..origin/master -10

# See detailed changes
git diff master origin/master

# See who changed what
git log --pretty=format:"%h %an - %s" -10
```

**Check for:**
- ✅ Proper commit messages (clear, descriptive)
- ✅ One feature per commit (not mixing unrelated changes)
- ✅ Tests written for new code
- ✅ No console.log statements left in production code
- ✅ Proper error handling (using AppError)
- ✅ Consistent code style with existing code

---

### Raising Issues (Problems Found) ✅

When you find bugs or need clarification:

```bash
# Create .github/ISSUES.md or use GitHub Issues interface:

Issue Title: "Orders endpoint not calculating tax correctly"

Description:
When creating an order with 5 items, the tax calculation shows 20% instead of 18%.

Steps to Reproduce:
1. POST /api/v1/orders with sample order data
2. Check response tax_amount field
3. Manually calculate: 18% of subtotal

Expected: 18% tax (GST)
Actual: 20% tax
Affected Module: Billing
Assigned to: [Team Member Name]
```

---

### Pull Request (PR) Review Process ✅

If your team uses GitHub/GitLab:

**When reviewing a PR:**

```
For each commit in the PR, check:
1. Does the code do what the commit message says?
2. Did they add tests?
3. Does it follow the existing code pattern?
4. Any security issues?
5. Any performance problems?

Comments to leave:
- "Great! Clean code." ✅
- "This function does too much. Could you split it?" 🤔
- "Missing error handling for database failure." ⚠️
- "Looks good, but can you add a test for edge case?" 📝
```

**Merge only if:**
- ✅ All tests pass
- ✅ Code review approved
- ✅ No conflicts
- ✅ Follows project standards

---

### Tracking Progress ✅ (Update Weekly)

Create `TEAM_PROGRESS.md`:

```markdown
# Team Progress - Week of [Date]

## Completed (✅)
- [x] Auth Module - Complete (Jai)
- [x] Orders CRUD endpoints (Jai) - Commit: abc123
- [x] Stock transaction endpoint (Member B) - Commit: def456

## In Progress (🚀)
- [ ] Orders to Stock integration
- [ ] Billing quotation calculations

## Blocked (🚫)
- [ ] Menu module - Waiting for category schema clarification
  - Blocker: Database schema needs approval
  - Action: Get approval from PM by Friday

## Next Priority
1. Complete Stock module
2. Start Billing module integration
3. Setup CI/CD pipeline
```

---

## **MONITORING TEAM WORK**

### What to Check Regularly

**1. Commit Activity** (See if people are committing regularly)
```bash
git log --since="2 days ago" --pretty=format:"%h %an %ar %s"
```

**2. Code Coverage** (Run tests)
```bash
npm test -- --coverage
```

**3. Linting** (Code quality)
```bash
npm run lint
```

**4. Dependencies** (Security check)
```bash
npm audit
```

---

## **HANDLING BLOCKERS**

When team member says "I'm blocked":

| Blocker | Your Action |
|---------|------------|
| **Need data from other module** | Coordinate between teams, create mock data if needed |
| **Database schema issue** | Review schema, approve change, migrate if needed |
| **Don't understand requirement** | Clarify with PM, update docs, communicate to team |
| **Code conflict** | Help resolve merge conflicts, review logic |
| **Technical decision needed** | Make decision quickly, document it, move on |

---

## **MARKING WORK COMPLETE FOR TEAM**

When a module/feature is ready for others to use:

```bash
# Create a tag (release point)
git tag -a v1.0-orders -m "Orders module complete - CRUD and status workflow"
git push origin v1.0-orders

# Or update READY_FOR_USE.md file:
```

Create `/READY_FOR_USE.md`:
```markdown
# ✅ Features Ready for Integration

## Orders Module v1.0 ✅
- Status: READY
- Commit: abc123
- Endpoints available:
  - POST /api/v1/orders
  - GET /api/v1/orders/:id
  - PUT /api/v1/orders/:id/status
  - DELETE /api/v1/orders/:id
- Tested: Yes (89% coverage)
- Documentation: [docs/api/orders.md](docs/api/orders.md)
- Dependencies: Auth, Menu (already have these)
- Can be used by: Stock, Billing modules

## Stock Module v1.0 - IN PROGRESS
- Status: 60% complete
- Eta: Friday EOD
- Currently available: GET /api/v1/stock/ingredients
- Coming soon: Transactions, reservations
```

---

## **WEDNESDAY/THURSDAY CHECK-IN (Before Deadline)**

```bash
# Run full health check:

echo "=== CHECKING PROJECT STATUS ===" 

echo "1. Latest commits:"
git log --oneline -5

echo "2. Code coverage:"
npm test -- --coverage

echo "3. Any linting issues:"
npm run lint

echo "4. Database migration ready:"
cat src/database/migrations/001_initial_schema.sql | wc -l

echo "5. All modules registered in app.js:"
grep "app.use('/api/v1" src/app.js

echo "6. Environment variables configured:"
cat .env.example | head -10
```

---

## **SATURDAY MORNING - FINAL CHECKLIST** ✅

- [ ] All modules committed and pushed
- [ ] README.md is complete and accurate
- [ ] Database migration script is tested
- [ ] All endpoints documented
- [ ] Tests written and passing
- [ ] `.env.example` has all required variables
- [ ] No console.log or debug code left
- [ ] Error handling consistent across all modules
- [ ] CORS/Security headers configured
- [ ] Rate limiting working

---

## **QUICK GIT COMMANDS CHEAT SHEET**

```bash
# See what you changed
git status

# Stage changes
git add src/modules/orders/

# Commit with message
git commit -m "feat(orders): add create endpoint"

# Push to team
git push origin master

# Pull latest from team
git pull origin master

# See commit history
git log --oneline -10

# See who changed what
git log -p -- src/modules/orders/service.js

# Undo last commit (keep changes)
git reset --soft HEAD~1

# See diff between branches
git diff master origin/master

# Create a backup branch before major changes
git branch backup-before-refactor

# Switch branch
git checkout backup-before-refactor
```

---

## **RED FLAGS TO WATCH FOR** 🚩

| Flag | What It Means | Fix |
|------|---------------|-----|
| No commits in 2 days | Team member might be stuck | Check in, offer help |
| 10 files changed in 1 commit | Doing too many things at once | Ask to split into smaller commits |
| Commit message: "Update" | Unclear what was done | Ask for descriptive message |
| Tests failing in CI/CD | Code quality issue | Have them run tests locally first |
| Merge conflicts daily | Not pulling frequently enough | Remind to pull before starting work |
| `.env` or passwords in commits | Security risk! | Rewrite history to remove, update .gitignore |

---

## **CELEBRATION CHECKLIST** 🎉

When each module is complete:

```bash
# 1. Tag it as a milestone
git tag -a v1.0-module-name -m "Module complete"

# 2. Update READY_FOR_USE.md  
# 3. Notify team in Slack/Discord
# 4. Update project board status
```

