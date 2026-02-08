import chalk from 'chalk'
import ora from 'ora'
import { getClient } from '../client.js'
import { parseDuration, formatDuration } from '../duration.js'

export async function logEntry(
  duration: string,
  description: string,
  options: { project?: string; task?: string },
): Promise<void> {
  const client = getClient()

  let durationMs: number
  try {
    durationMs = parseDuration(duration)
  } catch (err) {
    console.error(
      chalk.red(err instanceof Error ? err.message : 'Invalid duration'),
    )
    return
  }

  const spinner = ora('Logging time entry...').start()

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

    const endTime = Date.now()
    const startTime = endTime - durationMs

    await client.mutation('timers:createManualEntry', {
      taskName: options.task || description,
      taskDescription: description,
      projectId,
      startTime,
      endTime,
    })

    spinner.succeed(
      chalk.green(`Logged ${formatDuration(durationMs)}: ${description}`) +
        (options.project ? chalk.dim(` (${options.project})`) : ''),
    )
  } catch (err) {
    spinner.fail(
      chalk.red(`Failed: ${err instanceof Error ? err.message : err}`),
    )
  }
}
