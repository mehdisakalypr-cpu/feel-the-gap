import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { spawn } = await import('child_process')

    return new Promise<Response>((resolve) => {
      const proc = spawn('npx', ['tsx', 'agents/auto-optimizer.ts', '--execute'], {
        cwd: process.cwd(),
        env: { ...process.env } as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      const chunks: string[] = []
      proc.stdout?.on('data', (d) => chunks.push(d.toString()))
      proc.stderr?.on('data', (d) => chunks.push(d.toString()))

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM')
        resolve(NextResponse.json({ status: 'timeout', output: chunks.join('').slice(-500) }))
      }, 110_000)

      proc.on('close', (code) => {
        clearTimeout(timeout)
        resolve(NextResponse.json({
          status: code === 0 ? 'ok' : 'error',
          agent: 'auto-optimizer',
          output: chunks.join('').slice(-1000),
        }))
      })
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
