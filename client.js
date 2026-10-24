window.__ModuleLoader__.load({
  id: 'dsh-skill-manager',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useCallback, useEffect, useMemo, useRef, useState } = React

    const DICT = {
      zh: {
        tab: '技能',
        panel: '技能管理',
        title: '技能管理',
        hint: '取消勾选的技能不会出现在模型技能目录里，skill 工具也会拒绝调用。',
        search: '按名称或描述过滤',
        enableAll: '全部启用',
        disableAll: '全部停用',
        enabledOf: '已启用 {0} / {1}',
        empty: '没有匹配的技能。',
        loading: '正在读取技能…',
        failed: '读取技能失败：{0}',
        retry: '重试',
        when: '适用时机',
        modelHidden: '模型不可调用',
        noDescription: '（无描述）',
        saving: '保存中…',
        scopeGlobal: '全局',
        scopeProject: '本项目',
        scopeSession: '本会话',
        scopeHint: '越靠左范围越宽，窄范围只能再收紧',
        noProject: '（当前会话还没有工作目录）',
        noSession: '（没有会话信息，只能全局设置）',
        hiddenGlobal: '全局已停用',
        hiddenProject: '本项目已停用',
        hiddenSession: '本会话已停用',
        groupBundled: '内置技能',
        groupCustom: '自定义技能',
        newGroup: '新建分类',
        groupName: '分类名称',
        groupNamePlaceholder: '例如：论文写作',
        pickHint: '勾选要放进这个分类的技能',
        pickFilter: '在分类里搜索技能',
        rename: '重命名',
        editMembers: '改成员',
        remove: '删除',
        save: '保存',
        cancel: '取消',
        nameRequired: '请填写分类名称',
        deleteGroupAsk: '删除分类“{0}”？只删分类，不动技能开关。',
        groupEmpty: '这个分类还没有技能。',
      },
      en: {
        tab: 'Skills',
        panel: 'Skill Manager',
        title: 'Skill Manager',
        hint: 'Unchecked skills leave the model catalog and are refused by the skill tool.',
        search: 'Filter by name or description',
        enableAll: 'Enable all',
        disableAll: 'Disable all',
        enabledOf: '{0} of {1} enabled',
        empty: 'No skill matches the filter.',
        loading: 'Loading skills…',
        failed: 'Could not load skills: {0}',
        retry: 'Retry',
        when: 'Use when',
        modelHidden: 'not model-invocable',
        noDescription: '(no description)',
        saving: 'Saving…',
        scopeGlobal: 'Global',
        scopeProject: 'This project',
        scopeSession: 'This session',
        scopeHint: 'Wider scopes win; narrower ones only restrict further',
        noProject: '(no working directory yet)',
        noSession: '(no session — global only)',
        hiddenGlobal: 'off globally',
        hiddenProject: 'off in project',
        hiddenSession: 'off in session',
        groupBundled: 'Built-in',
        groupCustom: 'Custom',
        newGroup: 'New category',
        groupName: 'Category name',
        groupNamePlaceholder: 'e.g. paper writing',
        pickHint: 'Tick the skills that belong to this category',
        pickFilter: 'Search skills in this category',
        rename: 'Rename',
        editMembers: 'Members',
        remove: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        nameRequired: 'Enter a category name',
        deleteGroupAsk: 'Delete the category "{0}"? Only the category goes away — skill switches stay as they are.',
        groupEmpty: 'This category has no skills yet.',
      },
    }

    const C = {
      root: {
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '16px 20px 0',
        boxSizing: 'border-box',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
      },
      head: { display: 'flex', flexDirection: 'column', gap: 6 },
      titleRow: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
      title: { fontSize: 15, fontWeight: 600, margin: 0 },
      count: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      hint: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', margin: 0, lineHeight: 1.5 },
      toolRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      input: {
        flex: '1 1 220px',
        minWidth: 160,
        height: 30,
        padding: '0 10px',
        fontSize: 13,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        outline: 'none',
      },
      button: {
        height: 30,
        padding: '0 12px',
        fontSize: 12,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        cursor: 'pointer',
      },
      list: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        paddingBottom: 16,
      },
      groupHead: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        padding: '10px 2px 4px',
        position: 'sticky',
        top: 0,
        background: 'var(--dsw-alias-bg-base)',
        zIndex: 1,
      },
      groupName: { fontSize: 12, fontWeight: 600, letterSpacing: '0.02em' },
      groupCount: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' },
      groupTools: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 },
      link: {
        height: 20,
        padding: '0 6px',
        fontSize: 11,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'transparent',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
      },
      editor: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-1)',
        flex: '0 0 auto',
      },
      editorHead: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      picker: {
        maxHeight: 240,
        minHeight: 60,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        padding: 6,
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-base)',
      },
      pickerRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px', fontSize: 12 },
      row: (enabled) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '9px 10px',
        borderRadius: 8,
        background: enabled ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
        border: '1px solid ' + (enabled ? 'var(--dsw-alias-border-l1)' : 'transparent'),
        opacity: enabled ? 1 : 0.62,
      }),
      check: { marginTop: 2, accentColor: 'var(--dsw-alias-brand-primary)', cursor: 'pointer', flex: '0 0 auto' },
      body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 },
      nameRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
      skillName: { fontSize: 13, fontWeight: 600, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
      tag: {
        fontSize: 11,
        padding: '0 6px',
        lineHeight: '17px',
        borderRadius: 999,
        color: 'var(--dsw-alias-label-secondary)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      desc: {
        fontSize: 12,
        lineHeight: 1.55,
        color: 'var(--dsw-alias-label-secondary)',
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      },
      note: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' },
      scopeRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
      chip: (active) => ({
        height: 24,
        padding: '0 10px',
        fontSize: 12,
        color: active ? 'var(--dsw-alias-bg-base)' : 'var(--dsw-alias-label-primary)',
        background: active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 999,
        cursor: 'pointer',
      }),
      scopeNote: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginLeft: 2 },
      error: { fontSize: 12, color: 'var(--dsw-alias-state-error-primary)' },
    }

    const ENDPOINT = '/api/dsh-skill-manager'
    const SOURCE_LABEL = {
      bundled: '内置',
      custom: '自定义',
      user: '用户',
      'user-dsh': '用户目录',
      'user-agents': '子代理',
      project: '项目',
      runtime: '运行时',
    }
    const GROUPS = [
      { key: 'custom', title: 'groupCustom' },
      { key: 'bundled', title: 'groupBundled' },
    ]

    const groupOf = (item) => (item.source === 'bundled' ? 'bundled' : 'custom')

    async function request(path, body) {
      const init = body === undefined
        ? { headers: { accept: 'application/json' } }
        : { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body) }
      const response = await fetch(`${ENDPOINT}/${path}`, init)
      const text = await response.text()
      const value = text === '' ? {} : JSON.parse(text)
      if (!response.ok) throw new Error(value?.error || `HTTP ${response.status}`)
      return value
    }

    // Broader scopes win, so the checkbox of a row locked by a wider scope is read-only.
    function rowState(item, mode) {
      if (mode === 'project') {
        return { checked: !item.projectDisabled, locked: item.globalDisabled ? 'global' : '', own: 'project' }
      }
      if (mode === 'session') {
        const locked = item.globalDisabled ? 'global' : item.projectDisabled ? 'project' : ''
        return { checked: !item.sessionDisabled, locked, own: 'session' }
      }
      return { checked: !item.globalDisabled, locked: '', own: 'global' }
    }

    // Local mirror of the host's write, so a click shows its own result before the
    // silent reload replaces the list (which would otherwise flash and scroll up).
    function applyOptimistic(item, mode, enabled) {
      const next = { ...item }
      if (mode === 'global') {
        next.globalDisabled = !enabled
        if (next.globalDisabled) next.hiddenBy = 'global'
        else next.hiddenBy = next.projectDisabled ? 'project' : next.sessionDisabled ? 'session' : ''
      } else if (mode === 'project') {
        next.projectDisabled = !enabled
        if (next.globalDisabled) next.hiddenBy = 'global'
        else if (next.projectDisabled) next.hiddenBy = 'project'
        else next.hiddenBy = next.sessionDisabled ? 'session' : ''
      } else {
        next.sessionDisabled = !enabled
        if (next.globalDisabled) next.hiddenBy = 'global'
        else if (next.projectDisabled) next.hiddenBy = 'project'
        else if (next.sessionDisabled) next.hiddenBy = 'session'
        else next.hiddenBy = ''
      }
      next.enabled = next.hiddenBy === ''
      return next
    }

    function SkillRow({ item, mode, busy, onToggle, t }) {
      const state = rowState(item, mode)
      const description = item.descriptionZh || item.description
      const whenToUse = item.whenToUseZh || item.whenToUse
      const hiddenLabel = item.hiddenBy === 'global' ? t('hiddenGlobal')
        : item.hiddenBy === 'project' ? t('hiddenProject')
          : item.hiddenBy === 'session' ? t('hiddenSession') : ''
      const visible = state.checked && state.locked === ''
      return h('div', { style: C.row(visible) },
        h('input', {
          type: 'checkbox',
          style: C.check,
          checked: state.checked,
          disabled: busy || state.locked !== '' || item.modelInvocable === false,
          title: item.modelInvocable === false ? t('modelHidden') : item.name,
          onChange: (event) => onToggle([item.name], event.target.checked),
        }),
        h('div', { style: C.body },
          h('div', { style: C.nameRow },
            h('span', { style: C.skillName }, item.name),
            item.source ? h('span', { style: C.tag }, SOURCE_LABEL[item.source] ?? item.source) : null,
            item.modelInvocable === false ? h('span', { style: C.tag }, t('modelHidden')) : null,
            hiddenLabel !== '' ? h('span', { style: C.tag }, hiddenLabel) : null,
          ),
          h('div', { style: C.desc }, description || t('noDescription')),
          whenToUse ? h('div', { style: C.desc }, `${t('when')}: ${whenToUse}`) : null,
        ),
      )
    }

    function createSkillManager(t) {
      return function SkillManagerPage() {
        const [items, setItems] = useState([])
        const [scope, setScope] = useState({ session: '', project: '' })
        const [mode, setMode] = useState('global')
        const [loading, setLoading] = useState(true)
        const [error, setError] = useState('')
        const [busy, setBusy] = useState(false)
        const [query, setQuery] = useState('')
        const [groups, setGroups] = useState([])
        const [editing, setEditing] = useState(null)
        const loaded = useRef(false)

        // `silent` keeps the rendered rows in place: replacing the list with the
        // loading note unmounts the scroll container, so every toggle jumped to top.
        const load = useCallback(async ({ silent = false } = {}) => {
          if (!silent) setLoading(true)
          setError('')
          try {
            const value = await request('list')
            setItems(Array.isArray(value.skills) ? value.skills : [])
            setGroups(Array.isArray(value.groups) ? value.groups : [])
            setScope({
              session: typeof value?.scope?.session === 'string' ? value.scope.session : '',
              project: typeof value?.scope?.project === 'string' ? value.scope.project : '',
            })
          } catch (cause) {
            setError(String(cause?.message ?? cause))
          } finally {
            loaded.current = true
            setLoading(false)
          }
        }, [])

        useEffect(() => { load() }, [load])

        const toggle = useCallback(async (names, enabled) => {
          if (names.length === 0) return
          const wanted = new Set(names)
          setBusy(true)
          setError('')
          setItems((previous) => previous.map((item) => (wanted.has(item.name) ? applyOptimistic(item, mode, enabled) : item)))
          try {
            await request('toggle', { names, enabled, scope: mode, session: scope.session })
          } catch (cause) {
            setError(String(cause?.message ?? cause))
          } finally {
            setBusy(false)
            // Re-read in place: the rows stay mounted, so the scroll offset survives.
            if (loaded.current) await load({ silent: true })
          }
        }, [mode, scope.session, load])

        // Categories only reorder the panel; they are never sent to the catalog filter.
        const postGroup = useCallback(async (body) => {
          setBusy(true)
          setError('')
          try {
            const value = await request('groups', body)
            setGroups(Array.isArray(value.groups) ? value.groups : [])
            setEditing(null)
          } catch (cause) {
            setError(String(cause?.message ?? cause))
          } finally {
            setBusy(false)
          }
        }, [])

        const groupIndex = useMemo(() => {
          const owner = new Map()
          for (const group of groups) {
            for (const name of group.names) if (!owner.has(name)) owner.set(name, group.id)
          }
          return owner
        }, [groups])

        const saveEditing = () => {
          if (!editing) return
          const name = editing.name.trim()
          if (editing.mode === 'delete') {
            postGroup({ action: 'delete', id: editing.id })
            return
          }
          if (name === '') {
            setError(t('nameRequired'))
            return
          }
          if (editing.mode === 'create') postGroup({ action: 'create', name, names: editing.picked })
          else if (editing.mode === 'rename') postGroup({ action: 'rename', id: editing.id, name })
          else postGroup({ action: 'members', id: editing.id, names: editing.picked })
        }

        const [pickFilter, setPickFilter] = useState('')
        const pickNeedle = pickFilter.trim().toLowerCase()
        const pickable = useMemo(() => {
          const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name))
          if (pickNeedle === '') return sorted
          return sorted.filter((item) => `${item.name} ${item.descriptionZh || item.description}`.toLowerCase().includes(pickNeedle))
        }, [items, pickNeedle])

        const editor = editing === null ? null : h('div', { style: C.editor },
          h('div', { style: C.editorHead },
            h('span', { style: C.groupName },
              editing.mode === 'create' ? t('newGroup')
                : editing.mode === 'rename' ? t('rename')
                  : editing.mode === 'delete' ? t('remove') : t('editMembers')),
            editing.mode === 'delete' ? null : h('input', {
              style: { ...C.input, flex: '1 1 200px' },
              type: 'text',
              value: editing.name,
              placeholder: t('groupNamePlaceholder'),
              'aria-label': t('groupName'),
              disabled: busy || editing.mode === 'members',
              onChange: (event) => setEditing((previous) => ({ ...previous, name: event.target.value })),
            }),
            h('button', {
              type: 'button',
              style: C.button,
              disabled: busy || (editing.mode === 'delete' ? false : editing.name.trim() === ''),
              onClick: saveEditing,
            }, t('save')),
            h('button', {
              type: 'button',
              style: C.button,
              disabled: busy,
              onClick: () => setEditing(null),
            }, t('cancel')),
          ),
          editing.mode === 'delete'
            ? h('div', { style: C.note }, t('deleteGroupAsk').replace('{0}', editing.name))
            : null,
          editing.mode === 'delete'
            ? null
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                h('div', { style: C.note }, t('pickHint')),
                h('input', {
                  style: C.input,
                  type: 'search',
                  value: pickFilter,
                  placeholder: t('pickFilter'),
                  'aria-label': t('pickFilter'),
                  onChange: (event) => setPickFilter(event.target.value),
                }),
                h('div', { style: C.picker },
                  pickable.map((item) => h('label', { key: item.name, style: C.pickerRow },
                    h('input', {
                      type: 'checkbox',
                      style: C.check,
                      checked: editing.picked.includes(item.name),
                      onChange: (event) => setEditing((previous) => {
                        const picked = new Set(previous.picked)
                        if (event.target.checked) picked.add(item.name)
                        else picked.delete(item.name)
                        return { ...previous, picked: [...picked] }
                      }),
                    }),
                    h('span', { style: C.skillName }, item.name),
                    h('span', { style: C.tag }, SOURCE_LABEL[item.source] ?? item.source ?? ''),
                  )),
                ),
              ),
        )

        const needle = query.trim().toLowerCase()
        const shown = useMemo(() => {
          if (needle === '') return items
          return items.filter((item) => {
            const haystack = `${item.name} ${item.description} ${item.whenToUse} ${item.descriptionZh} ${item.whenToUseZh}`
            return haystack.toLowerCase().includes(needle)
          })
        }, [items, needle])

        const enabledCount = items.filter((item) => item.enabled).length
        const scopeDisabled = (item) => (mode === 'project'
          ? item.projectDisabled
          : mode === 'session' ? item.sessionDisabled : item.globalDisabled)
        const ownOn = items.filter((item) => !scopeDisabled(item) && rowState(item, mode).locked === '')
        const ownOff = items.filter((item) => scopeDisabled(item))
        const scopeNote = mode === 'project' && scope.project === ''
          ? t('noProject')
          : mode === 'session' && scope.session === '' ? t('noSession') : ''

        const canUseMode = (key) => (key === 'project' ? scope.project !== '' : key === 'session' ? scope.session !== '' : true)

        return h('div', { style: C.root },
          h('div', { style: C.head },
            h('div', { style: C.titleRow },
              h('h2', { style: C.title }, t('title')),
              h('span', { style: C.count }, t('enabledOf').replace('{0}', String(enabledCount)).replace('{1}', String(items.length))),
              busy ? h('span', { style: C.count }, t('saving')) : null,
            ),
            h('div', { style: C.scopeRow },
              ...['global', 'project', 'session'].map((key) => h('button', {
                key,
                type: 'button',
                style: C.chip(mode === key),
                disabled: busy || !canUseMode(key),
                onClick: () => setMode(key),
              }, key === 'global' ? t('scopeGlobal') : key === 'project' ? t('scopeProject') : t('scopeSession'))),
              h('span', { style: C.scopeNote }, scopeNote === '' ? t('scopeHint') : scopeNote),
            ),
            h('p', { style: C.hint }, t('hint')),
          ),
          h('div', { style: C.toolRow },
            h('input', {
              style: C.input,
              type: 'search',
              value: query,
              placeholder: t('search'),
              'aria-label': t('search'),
              onChange: (event) => setQuery(event.target.value),
            }),
            h('button', {
              type: 'button',
              style: C.button,
              disabled: busy || ownOff.length === 0,
              onClick: () => toggle(ownOff.map((item) => item.name), true),
            }, t('enableAll')),
            h('button', {
              type: 'button',
              style: C.button,
              disabled: busy || ownOn.length === 0,
              onClick: () => toggle(ownOn.map((item) => item.name), false),
            }, t('disableAll')),
            h('button', {
              type: 'button',
              style: C.button,
              disabled: busy || items.length === 0,
              onClick: () => {
                setPickFilter('')
                setEditing({ mode: 'create', id: '', name: '', picked: [] })
              },
            }, t('newGroup')),
          ),
          error !== ''
            ? h('div', { style: C.head },
                h('span', { style: C.error }, t('failed').replace('{0}', error)),
                h('button', { type: 'button', style: C.button, onClick: () => load() }, t('retry')),
              )
            : null,
          editor,
          h('div', { style: C.list },
            loading
              ? h('div', { style: C.note }, t('loading'))
              : shown.length === 0
                ? h('div', { style: C.note }, t('empty'))
                : [
                    ...groups.flatMap((group) => {
                      const rows = shown.filter((item) => groupIndex.get(item.name) === group.id)
                      if (rows.length === 0 && needle !== '') return []
                      return [
                        h('div', { key: `g-${group.id}`, style: C.groupHead },
                          h('span', { style: C.groupName }, group.name),
                          h('span', { style: C.groupCount }, String(rows.length)),
                          h('span', { style: C.groupTools },
                            h('button', {
                              type: 'button',
                              style: C.link,
                              disabled: busy,
                              onClick: () => {
                                setPickFilter('')
                                setEditing({ mode: 'members', id: group.id, name: group.name, picked: [...group.names] })
                              },
                            }, t('editMembers')),
                            h('button', {
                              type: 'button',
                              style: C.link,
                              disabled: busy,
                              onClick: () => setEditing({ mode: 'rename', id: group.id, name: group.name, picked: [] }),
                            }, t('rename')),
                            h('button', {
                              type: 'button',
                              style: C.link,
                              disabled: busy,
                              onClick: () => setEditing({ mode: 'delete', id: group.id, name: group.name, picked: [] }),
                            }, t('remove')),
                          ),
                        ),
                        ...(rows.length === 0 ? [h('div', { key: `g-empty-${group.id}`, style: C.note }, t('groupEmpty'))] : []),
                        ...rows.map((item) => h(SkillRow, {
                          key: `${group.id}-${item.name}`,
                          item,
                          mode,
                          busy,
                          t,
                          onToggle: toggle,
                        })),
                      ]
                    }),
                    ...GROUPS.flatMap((group) => {
                      const rows = shown.filter((item) => !groupIndex.has(item.name) && groupOf(item) === group.key)
                      if (rows.length === 0) return []
                      return [
                        h('div', { key: group.key, style: C.groupHead },
                          h('span', { style: C.groupName }, t(group.title)),
                          h('span', { style: C.groupCount }, String(rows.length)),
                        ),
                        ...rows.map((item) => h(SkillRow, {
                          key: item.name,
                          item,
                          mode,
                          busy,
                          t,
                          onToggle: toggle,
                        })),
                      ]
                    }),
                  ],
          ),
        )
      }
    }

    // Sidebar glyph for the Skills page; inherits the row's text color.
    function SkillManagerIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 16
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      },
        h('path', { d: 'M4 6.5h9' }),
        h('path', { d: 'M4 12h6' }),
        h('path', { d: 'M4 17.5h7' }),
        h('path', { d: 'M15 16.5l2.2 2.2L21.5 14' }),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        // UI stays Chinese whatever the app locale is: the panel is read by a zh-speaking user only.
        const t = (key) => DICT.zh[key] ?? key
        const locale = ctx.get('locale')
        if (locale && typeof locale.register === 'function') {
          try {
            for (const [lang, dict] of Object.entries(DICT)) locale.register('skill-manager', lang, dict)
          } catch {
            /* registry is optional: the built-in dictionary above is the source of truth */
          }
        }
        const SkillManagerPage = createSkillManager(t)
        // A root-scoped `main` key is a standalone page beside the Conversation: it takes
        // the whole centre column, so the Conversation's width handle and View tabs never
        // reach it. The sidebar entry below is what opens it.
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: 'skill-manager',
          label: () => t('panel'),
        }, SkillManagerPage))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: 'skill-manager',
          order: 40,
          label: () => t('panel'),
        }, SkillManagerIcon))
      },
    }
  },
})
