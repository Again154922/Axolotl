import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
	combineCrashLogs,
	type CrashLogFile,
	crashLogLabel,
	preferredCrashLogKey,
	selectCrashLogFiles,
} from './minecraft-crash-logs.ts'

const files: CrashLogFile[] = [
	{ age: 1_000, filename: 'latest.log', log_type: 'InfoLog' },
	{ age: 1_020, filename: 'crash-new.txt', log_type: 'CrashReport' },
	{ age: 1_010, filename: 'hs_err_pid10.log', log_type: 'JvmCrash' },
	{ age: 800, filename: 'crash-old.txt', log_type: 'CrashReport' },
	{ age: 1_015, filename: '2026-09-23-1.log.gz', log_type: 'InfoLog' },
]

describe('Minecraft crash log selection', () => {
	test('keeps current-run diagnostic files and one crash report per singleton type', () => {
		const selected = selectCrashLogFiles(files)
		assert.deepEqual(
			selected.map((file) => file.filename),
			['crash-new.txt', 'hs_err_pid10.log', 'latest.log'],
		)
	})

	test('prefers the crash report and formats its relative path', () => {
		const selected = selectCrashLogFiles(files)
		assert.equal(preferredCrashLogKey(selected), 'CrashReport:crash-new.txt')
		assert.equal(crashLogLabel(selected[0]!), 'crash-reports/crash-new.txt')
	})

	test('combines loaded files for non-LogShare fallback sharing', () => {
		const content = combineCrashLogs([
			{ ...files[0]!, output: 'latest output' },
			{ ...files[1]!, output: 'crash output' },
		])
		assert.match(content, /===== latest\.log =====\nlatest output/)
		assert.match(content, /===== crash-reports\/crash-new\.txt =====\ncrash output/)
	})
})
