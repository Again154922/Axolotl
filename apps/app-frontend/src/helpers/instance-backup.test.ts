import assert from 'node:assert/strict'
import test from 'node:test'

import { canonicalizeBackupDirectories, normalizeBackupDirectory } from './instance-backup.ts'

test('backup directory rules include future descendants without duplicate child rules', () => {
	assert.deepEqual(
		canonicalizeBackupDirectories(['saves/world', 'config\\mods', 'saves', 'config']),
		['config', 'saves'],
	)
})

test('backup directory rules reject paths outside the instance', () => {
	for (const value of ['', '.', '..', '../saves', '/saves', 'C:\\saves']) {
		assert.equal(normalizeBackupDirectory(value), null)
	}
})
