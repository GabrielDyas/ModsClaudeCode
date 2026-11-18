import type { Register } from 'claude-code'

const PANE = 'chats'
const DIR = 'C:/Users/Omega/.claude/projects/C--Users-Omega'

type Chat = { id: string; mtimeMs: number }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'chats',
      description: 'Abre ou fecha o painel das últimas conversas',
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
    let chats: Chat[] = []
    try {
      const entries = await $.fs.list(DIR)
      chats = entries
        .filter(x => x.kind === 'file' && x.name.endsWith('.jsonl'))
        .map(x => ({ id: x.name.replace('.jsonl', ''), mtimeMs: x.mtimeMs }))
        .sort((a, b) => b.mtimeMs - a.mtimeMs)
        .slice(0, 12)
    } catch {}

    return (
      <Box flexDirection="column">
        {chats.length === 0 && <Text dimColor>Nenhuma encontrada.</Text>}
        {chats.map(c => (
          <Button
            key={c.id}
            onPress={press =>
              $.ui.copy({ text: `claude --resume ${c.id}`, surface: press.surface })
            }
          >
            {new Date(c.mtimeMs).toLocaleString('pt-BR')} · {c.id.slice(0, 8)}
          </Button>
        ))}
        <Text dimColor>Clique para copiar o comando de retomar.</Text>
      </Box>
    )
  })
}
