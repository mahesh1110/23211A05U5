import fetch from 'node-fetch'

const stacks = ['backend', 'frontend'] as const
const levels = ['debug', 'info', 'warn', 'error', 'fatal'] as const
const backendPackages = ['cache', 'controller', 'cron_job', 'db', 'domain', 'handler', 'repository', 'route', 'service'] as const
const frontendPackages = ['api', 'component', 'hook', 'page', 'state', 'style'] as const
const sharedPackages = ['auth', 'config', 'middleware', 'utils'] as const

type Stack = typeof stacks[number]
type Level = typeof levels[number]
type PackageName = typeof backendPackages[number] | typeof frontendPackages[number] | typeof sharedPackages[number]

export default async function Log(stack: Stack, level: Level, packageName: PackageName, message: string) {
  if (!stacks.includes(stack)) throw new Error('invalid stack')
  if (!levels.includes(level)) throw new Error('invalid level')
  const allPackages = [...backendPackages, ...frontendPackages, ...sharedPackages]
  if (!allPackages.includes(packageName as PackageName)) throw new Error('invalid package')

  const token = process.env.LOG_SERVICE_TOKEN || process.env.ACCESS_TOKEN || ''
  const response = await fetch('http://4.224.186.213/evaluation-service/logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ stack, level, package: packageName, message })
  })

  return response.json()
}
