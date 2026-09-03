import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packageMetadata = JSON.parse(
  readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'),
) as {
  engines?: Record<string, string>
  packageManager?: string
}

it('declares the supported Node and pnpm runtime floor', () => {
  expect(packageMetadata.engines?.node).toBe('>=22.13.0')
  expect(packageMetadata.engines?.pnpm).toBe('>=10')
  expect(packageMetadata.packageManager).toBe('pnpm@11.19.0')
})
