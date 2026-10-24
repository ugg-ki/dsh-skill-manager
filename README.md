# dsh-skill-manager

A standalone Skills page for [DeepSeek Harness](https://github.com/deepseek-ai/dsh): every skill in one list with an enable checkbox. A skill you uncheck leaves the model's catalog and is refused by the `skill` tool, so a long skill collection stops costing context and stops getting invoked by accident.

## What it does

- **List** — every skill the harness can see, with a Chinese description for each.
- **Enable / disable** — three scopes: 全局 (global), 本项目 (this project's working directory), 本会话 (this session). Narrower scopes only add restrictions.
- **Categories** — group skills into named categories you create; purely visual, never changes what the model sees.
- **Search** — filters by name, description and Chinese description.
- **Separate page** — registers a `main` panel with its own sidebar entry, so it is not a cell inside the conversation.

Disabled skills are filtered out of `ctx.skills.snapshot()` and blocked by a `ctx.tools.guard()` on the `skill` tool.

## Install

```sh
dsh plugin --profile <profile> add <package-or-github-url>
```

Or in the desktop app: Settings → Plugins → install from a path or URL.

## State

Persisted at `$DSH_HOME/skill-manager.json` (default `~/.dsh/skill-manager.json`):

```json
{ "disabled": [], "sessions": {}, "projects": {}, "groups": [] }
```

## HTTP bridge

The panel talks to its host half over `/api/dsh-skill-manager/{list,toggle,groups}`, served by the harness web server.

## Development

Host JS is imported once per process: after editing `index.js`, disable and re-enable the plugin entry to reload it. Client JS reloads with a page refresh.

`node smoke.mjs` runs a headless test of the client component tree (mini React runtime, fake fetch).

## License

MIT
