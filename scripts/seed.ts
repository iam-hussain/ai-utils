/**
 * Comprehensive seed script for ai-utils.
 * Creates: users, teams, projects, issues, issue comments, chats, team invites.
 * Run: npm run seed
 * Requires: MongoDB running
 */
import mongoose from 'mongoose'
import path from 'path'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'

dotenv.config({ path: path.join(__dirname, '../.env') })

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-utils'
const SEED_PASSWORD = 'seed123456'

const SAMPLE_USERS = [
  { email: 'alice@example.com', name: 'Alice Chen' },
  { email: 'bob@example.com', name: 'Bob Smith' },
  { email: 'carol@example.com', name: 'Carol Davis' },
  { email: 'dave@example.com', name: 'Dave Wilson' },
]

const SAMPLE_TEAMS = [
  { name: 'AI Platform', ownerEmail: 'alice@example.com', memberEmails: ['bob@example.com', 'carol@example.com'] },
  { name: 'Mobile', ownerEmail: 'bob@example.com', memberEmails: ['alice@example.com'] },
  { name: 'Platform Ops', ownerEmail: 'carol@example.com', memberEmails: ['alice@example.com', 'bob@example.com'] },
]

const SAMPLE_PROJECTS = [
  { name: 'AI Chat App', teamName: 'AI Platform', environments: ['DEV', 'SIT', 'UAT', 'PT', 'PROD'] },
  { name: 'Mobile App', teamName: 'Mobile', environments: ['DEV', 'STAGING', 'PROD'] },
  { name: 'API Gateway', teamName: 'Platform Ops', environments: ['DEV', 'UAT', 'PROD'] },
  { name: 'Prompt Library', teamName: 'AI Platform', environments: ['DEV', 'PROD'] },
]

const SAMPLE_ISSUES = [
  {
    title: 'Chat response truncated for long messages',
    description: 'When sending messages over 2000 characters, the AI response gets cut off mid-sentence.',
    status: 'open' as const,
    environment: 'UAT',
    jiraTicketId: 'AI-101',
    projectName: 'AI Chat App',
    reporterEmail: 'alice@example.com',
    assigneeEmail: 'bob@example.com',
    promptSteps: [{ promptText: 'Summarize this 3000-word article', envStatus: 'not_working' as const }],
    nextPromptList: ['Continue the summary', 'Provide key takeaways'],
    links: [{ url: 'https://example.com/repro-steps' }],
  },
  {
    title: 'Incorrect date formatting in export',
    description: 'CSV export shows dates in ISO format instead of user locale.',
    status: 'in_progress' as const,
    environment: 'DEV',
    jiraTicketId: 'AI-102',
    projectName: 'AI Chat App',
    reporterEmail: 'bob@example.com',
    assigneeEmail: 'alice@example.com',
    promptSteps: [{ promptText: 'Export my data for last week', envStatus: 'working' as const }],
    nextPromptList: [],
    links: [],
  },
  {
    title: 'Prompt timeout on first load',
    description: 'First prompt after page load sometimes times out. Suspect cold start.',
    status: 'open' as const,
    environment: 'PROD',
    jiraTicketId: null,
    projectName: 'AI Chat App',
    reporterEmail: 'carol@example.com',
    assigneeEmail: null,
    promptSteps: [{ promptText: 'Hello, what can you help me with?', envStatus: 'unknown' as const }],
    nextPromptList: [],
    links: [],
  },
  {
    title: 'Suggestion chips not appearing',
    description: 'Follow-up suggestion chips are missing in the chat UI after the latest deploy.',
    status: 'completed' as const,
    environment: 'SIT',
    jiraTicketId: 'AI-103',
    projectName: 'AI Chat App',
    reporterEmail: 'alice@example.com',
    assigneeEmail: 'carol@example.com',
    promptSteps: [{ promptText: 'What is the capital of France?', envStatus: 'working' as const }],
    nextPromptList: ['Tell me more', 'What about Germany?'],
    links: [],
  },
  {
    title: 'Rate limit error shown incorrectly',
    description: 'Users see generic 500 instead of friendly "slow down" message.',
    status: 'open' as const,
    environment: 'DEV',
    jiraTicketId: 'AI-104',
    projectName: 'AI Chat App',
    reporterEmail: 'bob@example.com',
    assigneeEmail: null,
    promptSteps: [],
    nextPromptList: [],
    links: [],
  },
  {
    title: 'App crashes on iOS 17',
    description: 'Mobile app crashes on launch for users on iOS 17.0.',
    status: 'in_progress' as const,
    environment: 'STAGING',
    jiraTicketId: 'MOB-201',
    projectName: 'Mobile App',
    reporterEmail: 'bob@example.com',
    assigneeEmail: 'alice@example.com',
    promptSteps: [],
    nextPromptList: [],
    links: [{ url: 'https://example.com/crash-logs' }],
  },
  {
    title: 'API Gateway 502 on high load',
    description: 'Under load, gateway returns 502. Need to scale or add retries.',
    status: 'open' as const,
    environment: 'PROD',
    jiraTicketId: 'API-301',
    projectName: 'API Gateway',
    reporterEmail: 'carol@example.com',
    assigneeEmail: 'bob@example.com',
    promptSteps: [],
    nextPromptList: [],
    links: [],
  },
  {
    title: 'Prompt Library search slow',
    description: 'Search takes 3+ seconds with 500+ prompts.',
    status: 'open' as const,
    environment: 'DEV',
    jiraTicketId: null,
    projectName: 'Prompt Library',
    reporterEmail: 'alice@example.com',
    assigneeEmail: null,
    promptSteps: [],
    nextPromptList: [],
    links: [],
  },
]

const SAMPLE_COMMENTS = [
  { issueTitle: 'Chat response truncated for long messages', authorEmail: 'bob@example.com', content: 'Reproduced. Adding to sprint.' },
  { issueTitle: 'Chat response truncated for long messages', authorEmail: 'alice@example.com', content: 'Thanks for confirming. I have a fix in progress.' },
  { issueTitle: 'App crashes on iOS 17', authorEmail: 'alice@example.com', content: 'Investigating the crash logs. Looks like a memory issue.' },
]

const SAMPLE_CHATS = [
  { userEmail: 'alice@example.com', title: 'API design discussion' },
  { userEmail: 'alice@example.com', title: 'Prompt tuning notes' },
  { userEmail: 'bob@example.com', title: 'Mobile bug investigation' },
]

const SAMPLE_INVITES = [
  { teamName: 'Platform Ops', inviterEmail: 'carol@example.com', inviteeEmail: 'dave@example.com' },
]

async function ensureUser(
  User: mongoose.Model<mongoose.Document>,
  email: string,
  name: string
): Promise<mongoose.Types.ObjectId> {
  const user = await User.findOne({ email }).select('+password')
  if (!user) {
    const created = await User.create({ email, name, password: SEED_PASSWORD })
    return created._id
  }
  // Fix password for existing seed users (may have been double-hashed before)
  if (SAMPLE_USERS.some((u) => u.email === email)) {
    user.password = SEED_PASSWORD
    await user.save()
  }
  return user._id as mongoose.Types.ObjectId
}

async function ensureTeam(
  Team: mongoose.Model<mongoose.Document>,
  name: string,
  ownerId: mongoose.Types.ObjectId,
  memberIds: mongoose.Types.ObjectId[]
): Promise<mongoose.Types.ObjectId> {
  const team = await Team.findOne({ name }).select('_id').lean()
  if (!team) {
    const allIds = [ownerId, ...memberIds.filter((id) => !id.equals(ownerId))]
    const created = await Team.create({
      name,
      ownerId,
      memberIds: allIds,
      members: allIds.map((userId) => ({ userId, role: 'write' as const })),
    })
    return created._id
  }
  return team._id as mongoose.Types.ObjectId
}

async function ensureProject(
  Project: mongoose.Model<mongoose.Document>,
  name: string,
  teamId: mongoose.Types.ObjectId,
  ownerId: mongoose.Types.ObjectId,
  environments: string[]
): Promise<mongoose.Types.ObjectId> {
  const project = await Project.findOne({ name }).select('_id teamIds teamId').lean()
  if (project) {
    const doc = project as { _id: mongoose.Types.ObjectId; teamIds?: mongoose.Types.ObjectId[]; teamId?: mongoose.Types.ObjectId }
    const ids = doc.teamIds ?? (doc.teamId ? [doc.teamId] : [])
    if (!ids.some((id: mongoose.Types.ObjectId) => id.equals(teamId))) {
      await Project.updateOne({ _id: doc._id }, { $addToSet: { teamIds: teamId }, $unset: { teamId: 1 } })
    }
    return doc._id
  }
  const created = await Project.create({
    name,
    teamIds: [teamId],
    ownerId,
    environments,
  })
  return created._id
}

async function seed() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB\n')

  const { User } = await import('../models/User')
  const { Team } = await import('../models/Team')
  const { Project } = await import('../models/Project')
  const { Issue } = await import('../models/Issue')
  const { IssueComment } = await import('../models/IssueComment')
  const { Chat } = await import('../models/Chat')
  const { TeamInvite } = await import('../models/TeamInvite')

  const userMap = new Map<string, mongoose.Types.ObjectId>()
  const teamMap = new Map<string, mongoose.Types.ObjectId>()
  const projectMap = new Map<string, mongoose.Types.ObjectId>()
  const issueMap = new Map<string, mongoose.Types.ObjectId>()

  // --- Users ---
  console.log('--- Users ---')
  for (const u of SAMPLE_USERS) {
    const id = await ensureUser(User, u.email, u.name)
    userMap.set(u.email, id)
    console.log(`  ${u.email} (${u.name})`)
  }

  // --- Teams ---
  console.log('\n--- Teams ---')
  for (const t of SAMPLE_TEAMS) {
    const ownerId = userMap.get(t.ownerEmail)!
    const memberIds = t.memberEmails.map((e) => userMap.get(e)!).filter(Boolean)
    const id = await ensureTeam(Team, t.name, ownerId, memberIds)
    teamMap.set(t.name, id)
    console.log(`  ${t.name} (owner: ${t.ownerEmail})`)
  }

  // --- Projects ---
  console.log('\n--- Projects ---')
  for (const p of SAMPLE_PROJECTS) {
    const teamId = teamMap.get(p.teamName)!
    const team = await Team.findById(teamId).select('ownerId').lean()
    const ownerId = (team as { ownerId: mongoose.Types.ObjectId })?.ownerId ?? userMap.get('alice@example.com')!
    const id = await ensureProject(Project, p.name, teamId, ownerId, p.environments)
    projectMap.set(p.name, id)
    console.log(`  ${p.name} (team: ${p.teamName})`)
  }

  // --- Issues ---
  console.log('\n--- Issues ---')
  for (const s of SAMPLE_ISSUES) {
    const existing = await Issue.findOne({ teamId: { $in: Array.from(teamMap.values()) }, title: s.title })
    if (existing) {
      console.log(`  Skipped (exists): ${s.title}`)
      issueMap.set(s.title, existing._id)
      continue
    }
    const projectId = projectMap.get(s.projectName)!
    const project = await Project.findById(projectId).lean()
    const teamIds = (project as { teamIds?: mongoose.Types.ObjectId[] })?.teamIds ?? []
    const teamId = teamIds[0]!
    const reporterId = userMap.get(s.reporterEmail)!
    const assigneeId = s.assigneeEmail ? userMap.get(s.assigneeEmail) ?? null : null
    const created = await Issue.create({
      title: s.title,
      description: s.description,
      teamId,
      projectId,
      reporterId,
      assigneeId: assigneeId ?? undefined,
      status: s.status,
      environment: s.environment ?? undefined,
      jiraTicketId: s.jiraTicketId ?? undefined,
      promptSteps: s.promptSteps,
      nextPromptList: s.nextPromptList,
      links: s.links,
    })
    issueMap.set(s.title, created._id)
    console.log(`  Created: ${s.title}`)
  }

  // --- Issue Comments ---
  console.log('\n--- Issue Comments ---')
  for (const c of SAMPLE_COMMENTS) {
    const issueId = issueMap.get(c.issueTitle)
    if (!issueId) continue
    const existing = await IssueComment.findOne({ issueId, content: c.content })
    if (existing) {
      console.log(`  Skipped (exists): comment on ${c.issueTitle}`)
      continue
    }
    const authorId = userMap.get(c.authorEmail)!
    await IssueComment.create({ issueId, authorId, content: c.content })
    console.log(`  Created: comment on "${c.issueTitle}" by ${c.authorEmail}`)
  }

  // --- Chats ---
  console.log('\n--- Chats ---')
  const now = Date.now()
  for (const ch of SAMPLE_CHATS) {
    const userId = userMap.get(ch.userEmail)!
    const existing = await Chat.findOne({ userId, title: ch.title })
    if (existing) {
      console.log(`  Skipped (exists): ${ch.title} for ${ch.userEmail}`)
      continue
    }
    await Chat.create({
      id: randomUUID(),
      userId,
      title: ch.title,
      messages: [
        { id: randomUUID(), content: 'Sample message', type: 'human', timestamp: new Date().toISOString() },
        { id: randomUUID(), content: 'Sample reply', type: 'ai', timestamp: new Date().toISOString() },
      ],
      createdAt: now,
      updatedAt: now,
    })
    console.log(`  Created: ${ch.title} for ${ch.userEmail}`)
  }

  // --- Team Invites ---
  console.log('\n--- Team Invites ---')
  for (const inv of SAMPLE_INVITES) {
    const teamId = teamMap.get(inv.teamName)!
    const inviterId = userMap.get(inv.inviterEmail)!
    const inviteeId = userMap.get(inv.inviteeEmail)
    if (!inviteeId) continue
    const existing = await TeamInvite.findOne({ teamId, inviteeId, status: 'pending' })
    if (existing) {
      console.log(`  Skipped (exists): invite ${inv.inviteeEmail} to ${inv.teamName}`)
      continue
    }
    await TeamInvite.create({ teamId, inviterId, inviteeId, status: 'pending' })
    console.log(`  Created: invite ${inv.inviteeEmail} to ${inv.teamName}`)
  }

  console.log('\n--- Done ---')
  console.log('Seed users: alice@example.com, bob@example.com, carol@example.com, dave@example.com')
  console.log('Password for all: ' + SEED_PASSWORD)
  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
