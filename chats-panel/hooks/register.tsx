import type { Register } from 'claude-code'

const PANE = 'chats'

type Chat = { id: string; mtimeMs: number; project: string }

const dirname = (p: string) => p.replace(/[\\/][^\\/]*$/, '')
const basename = (p: string) => p.replace(/^.*[\\/]/, '')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'chats',
      description: 'Abre ou fecha o painel de conversas',
    })
    void $.ui.open({ id: PANE, title: 'Conversas' })
    return next(e)
  })

  on('command.run', { command: 'chats' }, async $ => {
    const panes = await $.ui.panes()
    const isUp = panes.some(p => p.id === PANE && p.isPlaced)
    if (isUp) await $.ui.close({ id: PANE })
    else await $.ui.open({ id: PANE, title: 'Conversas' })
    return { text: isUp ? 'Painel fechado.' : 'Painel aberto.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)

    // A pasta de conversas da sessão fica em <home>/.claude/projects/<pasta>/<id>.jsonl
    const { transcriptPath } = await $.session.info()
    const currentDir = transcriptPath ? dirname(transcriptPath) : ''
    const projectsDir = currentDir ? dirname(currentDir) : ''
    const currentSession = transcriptPath
      ? basename(transcriptPath).replace('.jsonl', '')
      : ''

    const listChats = async (dir: string): Promise<Chat[]> => {
      try {
        const entries = await $.fs.list(dir)
        return entries
          .filter(x => x.kind === 'file' && x.name.endsWith('.jsonl'))
          .map(x => ({
            id: x.name.replace('.jsonl', ''),
            mtimeMs: x.mtimeMs,
            project: basename(dir),
          }))
      } catch {
        return []
      }
    }

    const here = currentDir
      ? (await listChats(currentDir)).sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 8)
      : []

    let all: Chat[] = []
    if (projectsDir) {
      try {
        const folders = (await $.fs.list(projectsDir)).filter(x => x.kind === 'dir')
        const lists = await Promise.all(
          folders.map(f => listChats(`${projectsDir}/${f.name}`)),
        )
        all = lists.flat().sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 8)
      } catch {}
    }

    const row = (c: Chat, withFolder: boolean) => (
      <Button
        key={`${c.project}/${c.id}`}
        onPress={press =>
          $.ui.copy({ text: `claude --resume ${c.id}`, surface: press.surface })
        }
      >
        {new Date(c.mtimeMs).toLocaleString('pt-BR')} · {c.id.slice(0, 8)}
        {c.id === currentSession ? ' (esta)' : ''}
        {withFolder ? ` · ${c.project.replace(/^C--Users-/, '')}` : ''}
      </Button>
    )

    return (
      <Box flexDirection="column">
        <Text bold>Desta pasta</Text>
        {here.length === 0 && <Text dimColor>Nenhuma encontrada.</Text>}
        {here.map(c => row(c, false))}
        <Text bold>Últimas conversas (qualquer pasta)</Text>
        {all.length === 0 && <Text dimColor>Nenhuma encontrada.</Text>}
        {all.map(c => row(c, true))}
        <Text dimColor>Clique para copiar o comando de retomar.</Text>
      </Box>
    )
  })
}
