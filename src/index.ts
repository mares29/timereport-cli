#!/usr/bin/env node
import { Command } from 'commander'
import { login, logout } from './commands/auth.js'
import {
  startTimer,
  stopTimer,
  pauseTimer,
  resumeTimer,
} from './commands/timer.js'
import { logEntry } from './commands/log.js'
import { status } from './commands/status.js'
import { todaySummary, weekSummary } from './commands/summary.js'

const program = new Command()

program
  .name('timereport')
  .description('CLI for timereport.app')
  .version('0.1.0')

program.command('login').description('Log in via browser').action(login)

program.command('logout').description('Clear stored credentials').action(logout)

program
  .command('start <task>')
  .description('Start a timer')
  .option('-p, --project <name>', 'Project name')
  .action(startTimer)

program.command('stop').description('Stop active timer').action(stopTimer)

program.command('pause').description('Pause active timer').action(pauseTimer)

program.command('resume').description('Resume paused timer').action(resumeTimer)

program
  .command('log <duration> <description>')
  .description(
    'Log a manual time entry (e.g. timereport log 1h30m "Feature work")',
  )
  .option('-p, --project <name>', 'Project name')
  .option('-t, --task <name>', 'Task name')
  .action(logEntry)

program
  .command('status')
  .description('Show active timer and today summary')
  .action(status)

program
  .command('today')
  .description('Today hours breakdown')
  .action(todaySummary)

program
  .command('week')
  .description('Weekly hours breakdown')
  .action(weekSummary)

program.parse()
