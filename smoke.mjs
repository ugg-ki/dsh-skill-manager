// Headless smoke test for dsh-skill-manager client logic: mini React runtime + fake host.
import { readFileSync } from 'node:fs'

let hooks = []
let cursor = 0
let dirty = false
const effectSlots = new Map()

const React = {
  createElement(type, props, ...children) {
    const flat = []
    const walk = (value) => {
      if (Array.isArray(value)) value.forEach(walk)
      else if (value !== null && value !== undefined && value !== false && value !== true) flat.push(value)
    }
    walk(children)
    return { type, props: { ...(props ?? {}), children: flat } }
  },
  Fragment: 'fragment',
  useState(init) {
    const i = cursor++
    if (!(i in hooks)) hooks[i] = typeof init === 'function' ? init() : init
    const set = (value) => {
      const next = typeof value === 'function' ? value(hooks[i]) : value
      if (next !== hooks[i]) {
        hooks[i] = next
        dirty = true
      }
    }
    return [hooks[i], set]
  },
  useRef(init) {
    const i = cursor++
    if (!(i in hooks)) hooks[i] = { current: init }
    return hooks[i]
  },
  useCallback(fn, deps) {
    const i = cursor++
    const previous = hooks[i]
    if (!previous || !sameDeps(previous.deps, deps)) hooks[i] = { fn, deps }
    return hooks[i].fn
  },
  useMemo(fn, deps) {
    const i = cursor++
    const previous = hooks[i]
    if (!previous || !sameDeps(previous.deps, deps)) hooks[i] = { value: fn(), deps }
    return hooks[i].value
  },
  useEffect(fn, deps) {
    const i = cursor++
    const previous = effectSlots.get(i)
    if (!previous || !sameDeps(previous.deps, deps)) effectSlots.set(i, { deps, pending: fn })
  },
}

function sameDeps(a, b) {
  if (!a || !b || a.length !== b.length) return false
  return a.every((value, index) => Object.is(value, b[index]))
}

// Fake host: the same JSON shapes the plugin's HTTP routes return.
const skill = (name, source) => ({
  name, source, description: `${name} desc`, descriptionZh: `${name} 说明`, whenToUse: 'x', whenToUseZh: '时机',
  modelInvocable: true, userInvocable: true, enabled: true, hiddenBy: '',
  globalDisabled: false, projectDisabled: false, sessionDisabled: false,
})
const server = {
  skills: [skill('caveman', 'custom'), skill('ponytail', 'custom'), skill('office', 'bundled'), skill('scammer', 'custom')],
  groups: [],
  disabled: [],
  calls: [],
}
let groupSeq = 0

globalThis.fetch = async (url, init = {}) => {
  const path = String(url).replace('/api/dsh-skill-manager/', '')
  const body = init.body ? JSON.parse(init.body) : undefined
  server.calls.push({ path, body })
  const reply = (value) => ({ ok: true, status: 200, text: async () => JSON.stringify(value) })
  if (path.startsWith('list')) {
    return reply({ disabled: server.disabled, scope: { session: 'session-x', project: 'D:\\ws' }, groups: server.groups, skills: server.skills })
  }
  if (path === 'toggle') {
    for (const name of body.names) {
      const row = server.skills.find((item) => item.name === name)
      if (row) row.globalDisabled = !body.enabled
    }
    return reply({ ok: true, disabled: server.disabled })
  }
  if (path === 'groups') {
    if (body.action === 'create') {
      server.groups.push({ id: `g${++groupSeq}`, name: body.name, names: body.names })
    } else if (body.action === 'rename') {
      const group = server.groups.find((entry) => entry.id === body.id)
      if (group) group.name = body.name
    } else if (body.action === 'members') {
      const group = server.groups.find((entry) => entry.id === body.id)
      if (group) group.names = body.names
    } else if (body.action === 'delete') {
      server.groups = server.groups.filter((entry) => entry.id !== body.id)
    }
    return reply({ ok: true, groups: server.groups })
  }
  throw new Error(`unexpected path ${path}`)
}

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')
let loaded
globalThis.window = { __ModuleLoader__: { load(definition) { loaded = definition } } }
new Function('window', 'require', source)(globalThis.window, (name) => (name === 'react' ? React : {}))
if (!loaded || loaded.id !== 'dsh-skill-manager') throw new Error('module not loaded')

const registrations = []
const plugin = loaded.factory((name) => (name === 'react' ? React : {}))
plugin.apply({
  get: () => undefined,
  slots: {
    inject: (owner, register) => {
      registrations.push(owner)
      register()
    },
    register: (options) => {
      registrations.push(`${options.name}:${options.key ?? options.id}`)
      return () => {}
    },
  },
})
console.log('registrations', registrations)

let Page
try {
  Page = loaded.factory((name) => (name === 'react' ? React : {})).apply, null
} catch {}

// Find the page component the plugin registered on slot `main`.
const captured = []
plugin.apply({
  get: () => undefined,
  slots: {
    inject: (owner, register) => register(),
    register: (options, component) => {
      captured.push({ options, component })
      return () => {}
    },
  },
})
const pageRegistration = captured.find((entry) => entry.options.name === 'main')
if (!pageRegistration) throw new Error('no main panel component')
const Component = pageRegistration.component

function flatten(node, out = []) {
  if (Array.isArray(node)) node.forEach((child) => flatten(child, out))
  else if (node && typeof node === 'object') {
    out.push(node)
    flatten(node.props?.children ?? [], out)
  }
  return out
}

function findByText(tree, text) {
  return flatten(tree).find((node) => (node.props?.children ?? []).includes(text))
}

function findByLabel(tree, label) {
  return flatten(tree).find((node) => node.props?.['aria-label'] === label)
}

async function settle(rounds = 12) {
  let tree
  for (let round = 0; round < rounds; round++) {
    dirty = false
    cursor = 0
    tree = Component({})
    const pending = [...effectSlots.entries()].filter(([, slot]) => slot.pending)
    for (const [, slot] of pending) {
      const cleanup = await slot.pending()
      slot.pending = undefined
      slot.cleanup = cleanup
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
    if (!dirty) return tree
  }
  throw new Error('did not settle')
}

let tree = await settle()
console.log('initial groups', server.groups.length, 'rows', flatten(tree).filter((node) => node.type?.name === 'SkillRow').length)

// 1. create a category with two picked skills
findByText(tree, '新建分类').props.onClick()
tree = await settle()
findByLabel(tree, '分类名称').props.onChange({ target: { value: '写作' } })
tree = await settle()
const picker = flatten(tree).filter((node) => node.type === 'label')
for (const row of picker) {
  const name = [].concat(row.props.children[1].props.children).join('')
  if (name === 'caveman' || name === 'ponytail') {
    row.props.children[0].props.onChange({ target: { checked: true } })
    tree = await settle()
  }
}
findByText(tree, '保存').props.onClick()
tree = await settle()
console.log('after create', JSON.stringify(server.groups))

// 2. rename
findByText(tree, '重命名').props.onClick()
tree = await settle()
findByLabel(tree, '分类名称').props.onChange({ target: { value: '论文写作' } })
tree = await settle()
findByText(tree, '保存').props.onClick()
tree = await settle()
console.log('after rename', JSON.stringify(server.groups))

// 3. members
findByText(tree, '改成员').props.onClick()
tree = await settle()
const memberRows = flatten(tree).filter((node) => node.type === 'label')
for (const row of memberRows) {
  const name = [].concat(row.props.children[1].props.children).join('')
  if (name === 'caveman' && row.props.children[0].props.checked) {
    row.props.children[0].props.onChange({ target: { checked: false } })
    tree = await settle()
  }
}
findByText(tree, '保存').props.onClick()
tree = await settle()
console.log('after members', JSON.stringify(server.groups))

// 4. delete
findByText(tree, '删除').props.onClick()
tree = await settle()
findByText(tree, '保存').props.onClick()
tree = await settle()
console.log('after delete', JSON.stringify(server.groups)); const tally = {}; for (const n of flatten(tree)) tally[typeof n.type === 'string' ? n.type : 'comp'] = (tally[typeof n.type === 'string' ? n.type : 'comp'] || 0) + 1; console.log('tally', JSON.stringify(tally))

// 5. toggle a skill through SkillRow and check the list reloads silently
const before = server.calls.filter((call) => call.path === 'list').length
const rows = flatten(tree).filter((node) => typeof node.type === 'function' && node.type.name === 'SkillRow')
rows[0].props.onToggle([rows[0].props.item.name], false)
tree = await settle()
const after = server.calls.filter((call) => call.path === 'list').length
console.log('toggle target', rows[0].props.item.name, 'list reloads', after - before)
console.log('rows after toggle', flatten(tree).filter((node) => typeof node.type === 'function' && node.type.name === 'SkillRow').length)
console.log('group headers', flatten(tree).filter((node) => node.props?.style?.position === 'sticky').length)
// 6. a category holding a bundled skill takes it out of the built-in section
findByText(tree, '新建分类').props.onClick()
tree = await settle()
findByLabel(tree, '分类名称').props.onChange({ target: { value: '办公' } })
tree = await settle()
for (const row of flatten(tree).filter((node) => node.type === 'label')) {
  const name = [].concat(row.props.children[1].props.children).join('')
  if (name === 'office') {
    row.props.children[0].props.onChange({ target: { checked: true } })
    tree = await settle()
  }
}
findByText(tree, '保存').props.onClick()
tree = await settle()
const headers = flatten(tree)
  .filter((node) => node.props?.style?.position === 'sticky')
  .map((node) => [].concat(node.props.children[0].props.children).join(''))
console.log('headers', JSON.stringify(headers))
console.log('OK')
