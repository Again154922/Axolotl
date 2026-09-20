import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export type InstanceBackupEligibility =
	| 'eligible'
	| 'not_installed'
	| 'symlink_instance'
	| 'direct_linked_instance'
	| 'external_game_directory'
	| 'root_missing'
	| 'root_is_link'

export interface BackupRepositoryStatus {
	path: string
	initialized: boolean
	available: boolean
	stored_size: number
	logical_size: number
	snapshot_count: number
	error: string | null
}

export interface BackupDirectoryEntry {
	path: string
	name: string
	exists: boolean
	is_symlink: boolean
	link_target: string | null
}

export interface InstanceBackupConfig {
	instance_id: string
	enabled: boolean
	eligibility: InstanceBackupEligibility
	selected_directories: string[]
	snapshot_count: number
}

export interface BackupSnapshot {
	id: string
	instance_id: string
	instance_name: string
	created_at: number
	file_count: number
	symlink_count: number
	logical_size: number
	added_size: number
}

export interface BackupDeleteSummary {
	snapshot_count: number
	logical_size: number
}

export type BackupProgressStage = 'scanning' | 'saving' | 'completed' | 'cancelled' | 'failed'

export interface BackupProgressEvent {
	operationId: string
	instanceId: string
	stage: BackupProgressStage
	snapshotId?: string
	message?: string
}

export function normalizeBackupDirectory(value: string): string | null {
	const normalized = value.trim().replaceAll('\\', '/')
	if (
		!normalized ||
		normalized === '.' ||
		normalized.startsWith('/') ||
		/^[A-Za-z]:/.test(normalized)
	) {
		return null
	}
	const parts = normalized.split('/').filter((part) => part && part !== '.')
	if (parts.length === 0 || parts.some((part) => part === '..')) return null
	return parts.join('/')
}

export function canonicalizeBackupDirectories(values: string[]): string[] {
	const normalized = values
		.map(normalizeBackupDirectory)
		.filter((value): value is string => value !== null)
		.sort(
			(left, right) =>
				left.split('/').length - right.split('/').length || left.localeCompare(right),
		)
	const result: string[] = []
	for (const value of normalized) {
		if (result.includes(value) || result.some((parent) => value.startsWith(`${parent}/`))) continue
		result.push(value)
	}
	return result
}

export function getBackupRepositoryStatus(): Promise<BackupRepositoryStatus> {
	return invoke('plugin:instance|instance_get_backup_repository_status')
}

export function moveBackupRepository(destination: string): Promise<void> {
	return invoke('plugin:instance|instance_move_backup_repository', { destination })
}

export function getBackupConfig(instanceId: string): Promise<InstanceBackupConfig> {
	return invoke('plugin:instance|instance_get_backup_config', { instanceId })
}

export function listBackupDirectories(instanceId: string): Promise<BackupDirectoryEntry[]> {
	return invoke('plugin:instance|instance_list_backup_directories', { instanceId })
}

export function enableBackups(
	instanceId: string,
	selectedDirectories: string[],
): Promise<InstanceBackupConfig> {
	return invoke('plugin:instance|instance_enable_backups', { instanceId, selectedDirectories })
}

export function updateBackupSelections(
	instanceId: string,
	selectedDirectories: string[],
): Promise<InstanceBackupConfig> {
	return invoke('plugin:instance|instance_update_backup_selections', {
		instanceId,
		selectedDirectories,
	})
}

export function disableBackups(instanceId: string): Promise<void> {
	return invoke('plugin:instance|instance_disable_backups', { instanceId })
}

export function startBackup(instanceId: string): Promise<string> {
	return invoke('plugin:instance|instance_start_backup', { instanceId })
}

export function cancelBackup(operationId: string): Promise<boolean> {
	return invoke('plugin:instance|instance_cancel_backup', { operationId })
}

export function listBackups(instanceId: string): Promise<BackupSnapshot[]> {
	return invoke('plugin:instance|instance_list_backups', { instanceId })
}

export function deleteBackup(snapshotId: string): Promise<void> {
	return invoke('plugin:instance|instance_delete_backup', { snapshotId })
}

export function restoreBackup(snapshotId: string): Promise<void> {
	return invoke('plugin:instance|instance_restore_backup', { snapshotId })
}

export function getBackupDeleteSummary(instanceId: string): Promise<BackupDeleteSummary> {
	return invoke('plugin:instance|instance_get_backup_delete_summary', { instanceId })
}

export function listenBackupProgress(
	handler: (event: BackupProgressEvent) => void,
): Promise<UnlistenFn> {
	return listen<BackupProgressEvent>('instance_backup_progress', (event) => handler(event.payload))
}
