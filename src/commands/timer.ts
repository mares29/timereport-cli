import chalk from 'chalk'
import ora from 'ora'
import { getClient } from '../client.js'
import { formatDuration } from '../duration.js'

export async function startTimer(
  taskName: string,
  options: { project?: string },
): Promise<void> {
  const client = getClient()
  const spinner = ora('Starting timer...').start()

  try {
    let projectId: string | undefined

    if (options.project) {
      const projects = await client.query('projects:getAllProjects', {})
      const match = projects.find(
        (p: { name: string }) =>
          p.name.toLowerCase() === options.project!.toLowerCase(),
      )
      if (!match) {
        spinner.fail(`Project not found: "${options.project}"`)
        const names = projects.map((p: { name: string }) => p.name).join(', ')
        if (names) console.log(chalk.dim(`Available: ${names}`))
        return
      }
      projectId = match._id
    }

    await client.mutation('timers:startTimer', {
      taskName,
      projectId,
    })

    spinner.succeed(
      chalk.green(`Timer started: ${taskName}`) +
        (options.project ? chalk.dim(` (${options.project})`) : ''),
    )
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    )
  }
}

export async function stopTimer(): Promise<void> {
  const client = getClient()
  const spinner = ora('Stopping timer...').start()

  try {
    const active = await client.query('timers:getActiveTimer', {})
    if (!active) {
      spinner.info('No active timer.')
      return
    }

    const result = await client.mutation('timers:stopTimer', {})
    spinner.succeed(
      chalk.green(`Timer stopped: ${active.taskName}`) +
        chalk.dim(` — ${formatDuration(result.duration)}`),
    )
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    )
  }
}

export async function pauseTimer(): Promise<void> {
  const client = getClient()
  const spinner = ora('Pausing timer...').start()

  try {
    const active = await client.query('timers:getActiveTimer', {})
    if (!active) {
      spinner.info('No active timer.')
      return
    }

    if (active.status === 'paused') {
      spinner.info('Timer is already paused.')
      return
    }

    await client.mutation('timers:pauseTimer', {})
    spinner.succeed(chalk.yellow(`Timer paused: ${active.taskName}`))
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    )
  }
}

export async function resumeTimer(): Promise<void> {
  const client = getClient()
  const spinner = ora('Resuming timer...').start()

  try {
    const active = await client.query('timers:getActiveTimer', {})
    if (!active) {
      spinner.info('No active timer.')
      return
    }

    if (active.status === 'running') {
      spinner.info('Timer is already running.')
      return
    }

    await client.mutation('timers:resumeTimer', {})
    spinner.succeed(chalk.green(`Timer resumed: ${active.taskName}`))
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    )
  }
}
