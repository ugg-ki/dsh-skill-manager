// dsh-skill-manager — host half.
//
// The model's skill catalog is built by @deepseek-ai/dsh-tool-skill from
// ctx.skills.snapshot() on every agent/pre-step, so the only place a skill can be
// hidden is that snapshot. The service has no enable/disable filter (its Config
// schema is {collectCacheMaxEntries} only) and shadowing the `skill` tool is both
// impossible (duplicate name in one layer) and self-defeating (the shipped catalog
// listener drops the whole catalog when the tool is shadowed). Hence the wrap
// below plus a guard for the call itself.
//
// State lives in $DSH_HOME/skill-manager.json: the plugin's own Config would force
// a profile reload on every toggle, and settings.update() re-applies the entry.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import ZH from './zh.js'

export const name = 'skill-manager'
export const inject = ['skills', 'tools']

const PREFIX = '/api/dsh-skill-manager'
const STATE_FILE = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-manager.json')
const MAX_BODY = 1 << 20

function nameSet(value) {
  return new Set(Array.isArray(value) ? value.filter((n) => typeof n === 'string' && n !== '') : [])
}

function newState() {
  return { global: new Set(), sessions: new Map(), projects: new Map(), groups: [] }
}

function readState() {
  try {
    const raw = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
    const state = newState()
    state.global = nameSet(raw?.disabled)
    const load = (source, target) => {
      if (!source || typeof source !== 'object') return
      for (const [key, value] of Object.entries(source)) {
        const set = nameSet(value)
        if (set.size > 0) target.set(key, set)
      }
    }
    load(raw?.sessions, state.sessions)
    load(raw?.projects, state.projects)
    // Named categories only organize the panel; they never touch the catalog.
    if (Array.isArray(raw?.groups)) {
      for (const group of raw.groups) {
        const id = typeof group?.id === 'string' ? group.id : ''
        const name = typeof group?.name === 'string' ? group.name : ''
        if (id === '' || name === '') continue
        state.groups.push({ id, name, names: [...nameSet(group?.names)] })
      }
    }
    return state
  } catch {
    return newState()
  }
}

function writeState(state) {
  const dump = (map) => {
    const out = {}
    for (const key of [...map.keys()].sort()) {
      const set = map.get(key)
      if (set && set.size > 0) out[key] = [...set].sort()
    }
    return out
  }
  mkdirSync(dirname(STATE_FILE), { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify({
    disabled: [...state.global].sort(),
    sessions: dump(state.sessions),
    projects: dump(state.projects),
    groups: state.groups.map((group) => ({ id: group.id, name: group.name, names: [...group.names].sort() })),
  }, null, 2), 'utf8')
}

// Narrower scopes only ever add restrictions: a skill hidden globally stays hidden
// everywhere, so the widest matching scope is the one reported.
function hiddenBy(state, scope, name) {
  if (state.global.has(name)) return 'global'
  if (scope.project !== '' && state.projects.get(scope.project)?.has(name)) return 'project'
  if (scope.session !== '' && state.sessions.get(scope.session)?.has(name)) return 'session'
  return ''
}

function json(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(value))
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        resolve(undefined)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8').trim()
        resolve(text === '' ? {} : JSON.parse(text))
      } catch {
        resolve(undefined)
      }
    })
    req.on('error', () => resolve(undefined))
  })
}

// A bare skills.list({}) only reads the global layer, which is the bundled
// catalog: the user's own ~/.dsh/skills entries live in the agent preset's layer
// and their project roots are resolved from the agent's cwd. Read through the
// viewing agent so the panel shows exactly what that session's model sees.
// `skills.list()` is derived from the same snapshot this plugin wraps, so the panel
// must read the untouched snapshot or a disabled skill would vanish from the very
// list that is supposed to switch it back on.
async function listFor(ctx, sessionId, rawList) {
  const agents = ctx.get('agents')
  let agent
  try {
    agent = sessionId === '' ? agents?.roots?.()?.[0] : agents?.get(sessionId)
  } catch {
    agent = undefined
  }
  if (!agent) return { skills: await rawList({}), project: '', session: '' }
  const signal = AbortSignal.timeout(5000)
  let cwd
  try {
    cwd = await ctx.get('workingDirectory')?.ensure(agent, signal)
  } catch {
    cwd = undefined
  }
  const hasCwd = typeof cwd === 'string' && cwd !== ''
  const scoped = await rawList({ scope: agent, ...(hasCwd ? { cwd } : {}) })
  const seen = new Set(scoped.map((skill) => String(skill?.name ?? '')))
  const global = await rawList({})
  return {
    skills: [...scoped, ...global.filter((skill) => !seen.has(String(skill?.name ?? '')))],
    project: hasCwd ? cwd : '',
    // The page is a global panel with no session prop, so it learns the resolved
    // agent from this field and posts its project/session toggles against it.
    session: String(agent.id ?? ''),
  }
}

function snapshotSkill(skill, state, scope) {
  const name = String(skill.name ?? '')
  const label = ZH[name]
  const hidden = hiddenBy(state, scope, name)
  return {
    name,
    description: String(skill.description ?? ''),
    whenToUse: typeof skill.whenToUse === 'string' ? skill.whenToUse : '',
    descriptionZh: typeof label?.d === 'string' ? label.d : '',
    whenToUseZh: typeof label?.w === 'string' ? label.w : '',
    source: typeof skill.source === 'string' ? skill.source : '',
    modelInvocable: skill.invocation?.modelInvocable !== false,
    userInvocable: skill.invocation?.userInvocable !== false,
    enabled: hidden === '',
    hiddenBy: hidden,
    globalDisabled: state.global.has(name),
    projectDisabled: scope.project !== '' && state.projects.get(scope.project)?.has(name) === true,
    sessionDisabled: scope.session !== '' && state.sessions.get(scope.session)?.has(name) === true,
  }
}

export function apply(ctx) {
  const state = readState()
  // The guard is synchronous and has no cwd: remember the project each session last
  // resolved its catalog from, which is the same cwd the skill lookup uses.
  const projectBySession = new Map()
  const skills = ctx.skills
  const originalSnapshot = typeof skills?.snapshot === 'function' ? skills.snapshot : undefined
  const rawList = async (options) => {
    if (!originalSnapshot) return []
    const value = await originalSnapshot.call(skills, options)
    return Array.isArray(value?.skills) ? value.skills : []
  }

  // Hide disabled skills from the model's catalog.
  ctx.effect(() => {
    const original = originalSnapshot
    if (typeof original !== 'function') return
    const patched = function patchedSnapshot(options, ...rest) {
      const session = String(options?.scope?.id ?? '')
      const project = typeof options?.cwd === 'string' ? options.cwd : ''
      if (session !== '' && project !== '') projectBySession.set(session, project)
      return Promise.resolve(original.call(skills, options, ...rest)).then((value) => {
        if (!value || !Array.isArray(value.skills)) return value
        const scope = { session, project }
        const kept = value.skills.filter((skill) => hiddenBy(state, scope, String(skill?.name ?? '')) === '')
        if (kept.length === value.skills.length) return value
        return { ...value, skills: kept }
      })
    }
    try {
      Object.defineProperty(skills, 'snapshot', { value: patched, configurable: true, writable: true })
    } catch {
      return
    }
    return () => {
      try {
        Object.defineProperty(skills, 'snapshot', { value: original, configurable: true, writable: true })
      } catch {
        /* left patched: the plugin is going away anyway */
      }
    }
  }, 'skill-manager: catalog filter')

  // Refuse the call if anything still reaches the tool (gestures, stale catalogs).
  ctx.effect(() => ctx.tools.guard((exec) => {
    if (exec.name !== 'skill') return
    const wanted = exec.arguments?.name
    if (typeof wanted !== 'string') return
    const session = String(exec.agent?.id ?? '')
    const scope = { session, project: projectBySession.get(session) ?? '' }
    const hidden = hiddenBy(state, scope, wanted)
    if (hidden === '') return
    const where = hidden === 'project' ? 'for this project' : hidden === 'session' ? 'for this session' : 'globally'
    return `skill "${wanted}" is disabled ${where} in the Skill Manager. Do not retry — ask the user to enable it in the Skills view first.`
  }), 'skill-manager: skill guard')

  // Resolve the cwd that keys the project scope, without trusting a client-supplied path.
  const projectFor = async (session) => {
    const agents = ctx.get('agents')
    let agent
    try {
      agent = session === '' ? undefined : agents?.get(session)
    } catch {
      agent = undefined
    }
    if (!agent) return ''
    try {
      const cwd = await ctx.get('workingDirectory')?.ensure(agent, AbortSignal.timeout(5000))
      return typeof cwd === 'string' ? cwd : ''
    } catch {
      return ''
    }
  }

  ctx.inject(['webServer'], (web) => {
    web.effect(() => {
      const disposers = [
        web.webServer.register({
          kind: 'exact',
          path: `${PREFIX}/list`,
          handler: async (req, res) => {
            if (req.method !== 'GET') return json(res, 405, { error: 'GET only' })
            try {
              const url = new URL(req.url ?? '/', 'http://dsh.invalid')
              const session = url.searchParams.get('session') ?? ''
              const listed = await listFor(ctx, session, rawList)
              const scope = { session: session !== '' ? session : listed.session, project: listed.project }
              json(res, 200, {
                disabled: [...state.global].sort(),
                scope,
                groups: state.groups.map((group) => ({ id: group.id, name: group.name, names: [...group.names] })),
                skills: listed.skills.map((skill) => snapshotSkill(skill, state, scope)),
              })
            } catch (error) {
              json(res, 500, { error: String(error?.message ?? error) })
            }
          },
        }),
        web.webServer.register({
          kind: 'exact',
          path: `${PREFIX}/toggle`,
          handler: async (req, res) => {
            if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
            if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
              return json(res, 415, { error: 'application/json only' })
            }
            const body = await readBody(req)
            if (body === undefined) return json(res, 400, { error: 'malformed JSON body' })
            const enabled = body?.enabled
            const names = Array.isArray(body?.names) ? body.names : []
            const scopeName = body?.scope === 'session' || body?.scope === 'project' ? body.scope : 'global'
            const session = typeof body?.session === 'string' ? body.session : ''
            if (typeof enabled !== 'boolean' || names.length === 0) {
              return json(res, 400, { error: 'expected { names: string[], enabled: boolean, scope?, session? }' })
            }
            for (const value of names) {
              if (typeof value !== 'string' || value === '') return json(res, 400, { error: 'invalid name' })
            }
            if (scopeName !== 'global' && session === '') {
              return json(res, 400, { error: `${scopeName} scope needs a session` })
            }
            let project = ''
            if (scopeName === 'project') {
              project = await projectFor(session)
              if (project === '') return json(res, 400, { error: 'session has no working directory yet' })
            }
            const target = scopeName === 'global'
              ? state.global
              : scopeName === 'session'
                ? state.sessions.get(session) ?? state.sessions.set(session, new Set()).get(session)
                : state.projects.get(project) ?? state.projects.set(project, new Set()).get(project)
            for (const value of names) {
              if (enabled) target.delete(value)
              else target.add(value)
            }
            try {
              writeState(state)
            } catch (error) {
              return json(res, 500, { error: `cannot persist: ${String(error?.message ?? error)}` })
            }
            json(res, 200, { ok: true, disabled: [...state.global].sort(), scope: { session, project } })
          },
        }),
        web.webServer.register({
          kind: 'exact',
          path: `${PREFIX}/groups`,
          handler: async (req, res) => {
            if (req.method !== 'POST') return json(res, 405, { error: 'POST only' })
            if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
              return json(res, 415, { error: 'application/json only' })
            }
            const body = await readBody(req)
            if (body === undefined) return json(res, 400, { error: 'malformed JSON body' })
            const action = body?.action
            const id = typeof body?.id === 'string' ? body.id : ''
            const name = typeof body?.name === 'string' ? body.name.trim() : ''
            const names = Array.isArray(body?.names) ? body.names.filter((value) => typeof value === 'string' && value !== '') : []
            const reply = () => json(res, 200, {
              ok: true,
              groups: state.groups.map((group) => ({ id: group.id, name: group.name, names: [...group.names] })),
            })
            if (action === 'create') {
              if (name === '') return json(res, 400, { error: 'category name is required' })
              if (state.groups.some((group) => group.name === name)) {
                return json(res, 400, { error: 'category name already exists' })
              }
              state.groups.push({ id: `g${Date.now().toString(36)}`, name, names: new Set(names) })
            } else if (action === 'rename') {
              const group = state.groups.find((entry) => entry.id === id)
              if (!group) return json(res, 404, { error: 'no such category' })
              if (name === '') return json(res, 400, { error: 'category name is required' })
              group.name = name
            } else if (action === 'delete') {
              const before = state.groups.length
              state.groups = state.groups.filter((entry) => entry.id !== id)
              if (state.groups.length === before) return json(res, 404, { error: 'no such category' })
            } else if (action === 'members') {
              const group = state.groups.find((entry) => entry.id === id)
              if (!group) return json(res, 404, { error: 'no such category' })
              group.names = new Set(names)
            } else {
              return json(res, 400, { error: 'expected { action: create|rename|delete|members }' })
            }
            try {
              writeState(state)
            } catch (error) {
              return json(res, 500, { error: `cannot persist: ${String(error?.message ?? error)}` })
            }
            reply()
          },
        }),
      ]
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'skill-manager: bridge')
  })
}
