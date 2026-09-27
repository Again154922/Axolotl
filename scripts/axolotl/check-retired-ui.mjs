import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOTS = ['packages/ui/src', 'apps/app-frontend/src', 'apps/website/src']
const RETIRED = [
	{ pattern: /\bButtonStyled\b/, reason: 'use Button, IconButton or ButtonLink' },
	{ pattern: /\bLegacyButton\b/, reason: 'use Button, IconButton or ButtonLink' },
	{ pattern: /\b(?:hover-)?color-fill\s*=/, reason: 'use the quiet-button interaction prop' },
	{ pattern: /\bhighlighted-style\s*=/, reason: 'use semantic selected state and ARIA' },
	{ pattern: /\bbtn-wrapper\b/, reason: 'the descendant-search wrapper was removed' },
	{ pattern: /\bjoined-buttons\b/, reason: 'use ButtonGroup' },
	{ pattern: /\bDropdownSelect\b/, reason: 'use Combobox' },
	{ pattern: /\banimated-dropdown\b/, reason: 'use Combobox, which exposes data-combobox' },
	{ pattern: /<\/?Input(?=[\s/>])/, reason: 'use StyledInput' },
]
const RETIRED_SOURCE = [
	{
		pattern: /\bimport\s*\{[^}]*\bInput\b[^}]*\}\s*from\s*['"]@modrinth\/ui['"]/g,
		reason: 'import StyledInput from @modrinth/ui',
	},
]

async function* walk(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (/^(?:node_modules|dist|\.nuxt|\.output|__screenshots__)$/.test(entry.name)) continue
		const entryPath = path.join(directory, entry.name)
		if (entry.isDirectory()) yield* walk(entryPath)
		else if (/\.(?:vue|ts|js|mjs|scss|css)$/.test(entry.name)) yield entryPath
	}
}

const violations = []
for (const root of ROOTS) {
	for await (const file of walk(root)) {
		const contents = await readFile(file, 'utf8')
		const lines = contents.split(/\r?\n/)
		for (const [index, line] of lines.entries()) {
			for (const retired of RETIRED) {
				if (retired.pattern.test(line)) {
					violations.push(`${file}:${index + 1}: ${retired.reason}\n  ${line.trim()}`)
				}
			}
		}
		for (const retired of RETIRED_SOURCE) {
			retired.pattern.lastIndex = 0
			for (const match of contents.matchAll(retired.pattern)) {
				const line = contents.slice(0, match.index).split(/\r?\n/).length
				violations.push(`${file}:${line}: ${retired.reason}`)
			}
		}
	}
}

if (violations.length > 0) {
	console.error(
		`Axolotl retired UI check failed: ${violations.length} retired UI API reference(s).\n` +
			violations.join('\n'),
	)
	process.exit(1)
}

console.log('Axolotl retired UI check passed.')
