<script setup lang="ts">
import { FileArchiveIcon, SaveIcon, TrashIcon, UndoIcon, XIcon } from '@modrinth/assets'
import {
	Admonition,
	ButtonStyled,
	commonMessages,
	defineMessages,
	injectNotificationManager,
	NewModal,
	useFormatBytes,
	useFormatDateTime,
	useVIntl,
} from '@modrinth/ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import {
	type BackupDirectoryEntry,
	type BackupProgressStage,
	type BackupSnapshot,
	cancelBackup,
	deleteBackup,
	disableBackups,
	enableBackups,
	getBackupConfig,
	type InstanceBackupConfig,
	type InstanceBackupEligibility,
	listBackupDirectories,
	listBackups,
	listenBackupProgress,
	restoreBackup,
	startBackup,
	updateBackupSelections,
} from '@/helpers/instance-backup'
import { injectInstanceSettings } from '@/providers/instance-settings'

import BackupDirectorySelector from './BackupDirectorySelector.vue'

const { instance } = injectInstanceSettings()
const { formatMessage } = useVIntl()
const formatBytes = useFormatBytes()
const formatDate = useFormatDateTime({ dateStyle: 'medium', timeStyle: 'short' })
const { handleError } = injectNotificationManager()

const messages = defineMessages({
	title: { id: 'instance.backups.title', defaultMessage: 'Instance backups' },
	description: {
		id: 'instance.backups.description',
		defaultMessage:
			'Create deduplicated snapshots of selected folders while the instance is closed.',
	},
	loading: { id: 'instance.backups.loading', defaultMessage: 'Loading backup settings...' },
	unavailable: { id: 'instance.backups.unavailable', defaultMessage: 'Backups are unavailable' },
	notInstalled: {
		id: 'instance.backups.unavailable.not-installed',
		defaultMessage: 'Finish installing this instance before enabling backups.',
	},
	symlinkInstance: {
		id: 'instance.backups.unavailable.symlink',
		defaultMessage: 'Imported symbolic-link instances cannot be backed up.',
	},
	directLinked: {
		id: 'instance.backups.unavailable.direct-linked',
		defaultMessage: 'Instances linked directly to another launcher cannot be backed up.',
	},
	externalDirectory: {
		id: 'instance.backups.unavailable.external-directory',
		defaultMessage: 'Instances that use an external game directory cannot be backed up.',
	},
	rootMissing: {
		id: 'instance.backups.unavailable.root-missing',
		defaultMessage: 'The instance folder is missing.',
	},
	rootLink: {
		id: 'instance.backups.unavailable.root-link',
		defaultMessage: 'Instances whose root folder is a link cannot be backed up.',
	},
	choose: {
		id: 'instance.backups.choose',
		defaultMessage: 'Choose folders to include in every future backup.',
	},
	enable: { id: 'instance.backups.enable', defaultMessage: 'Enable backups' },
	editFolders: { id: 'instance.backups.edit-folders', defaultMessage: 'Edit folders' },
	saveFolders: { id: 'instance.backups.save-folders', defaultMessage: 'Save folders' },
	selectedFolders: {
		id: 'instance.backups.selected-folders',
		defaultMessage: 'Included folders: {folders}',
	},
	backupNow: { id: 'instance.backups.backup-now', defaultMessage: 'Back up now' },
	cancelBackup: { id: 'instance.backups.cancel', defaultMessage: 'Cancel backup' },
	stageScanning: {
		id: 'instance.backups.stage.scanning',
		defaultMessage: 'Scanning and hashing files',
	},
	stageSaving: { id: 'instance.backups.stage.saving', defaultMessage: 'Saving snapshot index' },
	stageFailed: { id: 'instance.backups.stage.failed', defaultMessage: 'Backup failed' },
	snapshots: { id: 'instance.backups.snapshots', defaultMessage: 'Snapshots' },
	empty: { id: 'instance.backups.empty', defaultMessage: 'No backups have been created yet.' },
	snapshotMeta: {
		id: 'instance.backups.snapshot-meta',
		defaultMessage: '{files, plural, one {# file} other {# files}} · {size}',
	},
	addedSize: { id: 'instance.backups.added-size', defaultMessage: '{size} newly stored' },
	restore: { id: 'instance.backups.restore', defaultMessage: 'Restore backup' },
	delete: { id: 'instance.backups.delete', defaultMessage: 'Delete backup' },
	disable: { id: 'instance.backups.disable', defaultMessage: 'Disable backups' },
	disableBlocked: {
		id: 'instance.backups.disable-blocked',
		defaultMessage: 'Delete every snapshot before disabling backups.',
	},
	restoreTitle: { id: 'instance.backups.restore-title', defaultMessage: 'Restore this backup?' },
	restoreBody: {
		id: 'instance.backups.restore-body',
		defaultMessage: 'The folders included in this snapshot will replace their current versions.',
	},
	deleteTitle: { id: 'instance.backups.delete-title', defaultMessage: 'Delete this backup?' },
	deleteBody: {
		id: 'instance.backups.delete-body',
		defaultMessage:
			'This snapshot will be permanently deleted. Unused stored files will also be removed.',
	},
})

const config = ref<InstanceBackupConfig | null>(null)
const directories = ref<BackupDirectoryEntry[]>([])
const snapshots = ref<BackupSnapshot[]>([])
const loading = ref(true)
const editingFolders = ref(false)
const selectedDirectories = ref<string[]>(['config', 'saves'])
const action = ref<string | null>(null)
const operationId = ref<string | null>(null)
const operationStage = ref<BackupProgressStage | null>(null)
const operationMessage = ref<string | null>(null)
const selectedSnapshot = ref<BackupSnapshot | null>(null)
const deleteModal = ref<InstanceType<typeof NewModal>>()
const restoreModal = ref<InstanceType<typeof NewModal>>()
let unlisten: (() => void) | null = null

const eligible = computed(() => config.value?.eligibility === 'eligible')
const isRunning = computed(() => operationId.value !== null)
const canCancel = computed(() => operationStage.value === 'scanning')

const eligibilityMessages: Record<
	Exclude<InstanceBackupEligibility, 'eligible'>,
	keyof typeof messages
> = {
	not_installed: 'notInstalled',
	symlink_instance: 'symlinkInstance',
	direct_linked_instance: 'directLinked',
	external_game_directory: 'externalDirectory',
	root_missing: 'rootMissing',
	root_is_link: 'rootLink',
}

const unavailableReason = computed(() => {
	const eligibility = config.value?.eligibility
	if (!eligibility || eligibility === 'eligible') return ''
	return formatMessage(messages[eligibilityMessages[eligibility]])
})

async function refresh() {
	loading.value = true
	try {
		const nextConfig = await getBackupConfig(instance.value.id)
		config.value = nextConfig
		selectedDirectories.value = nextConfig.enabled
			? [...nextConfig.selected_directories]
			: ['config', 'saves']
		const [nextDirectories, nextSnapshots] = await Promise.all([
			nextConfig.eligibility === 'eligible'
				? listBackupDirectories(instance.value.id)
				: Promise.resolve([]),
			listBackups(instance.value.id),
		])
		directories.value = nextDirectories
		snapshots.value = nextSnapshots
	} catch (error) {
		handleError(error)
	} finally {
		loading.value = false
	}
}

async function runAction(name: string, task: () => Promise<void>) {
	action.value = name
	try {
		await task()
	} catch (error) {
		handleError(error)
	} finally {
		action.value = null
	}
}

function enable() {
	if (selectedDirectories.value.length === 0) return
	void runAction('enable', async () => {
		config.value = await enableBackups(instance.value.id, selectedDirectories.value)
		editingFolders.value = false
	})
}

function beginEditingFolders() {
	selectedDirectories.value = [...(config.value?.selected_directories ?? [])]
	editingFolders.value = true
}

function saveFolders() {
	if (selectedDirectories.value.length === 0) return
	void runAction('folders', async () => {
		config.value = await updateBackupSelections(instance.value.id, selectedDirectories.value)
		editingFolders.value = false
	})
}

function start() {
	void runAction('start', async () => {
		operationStage.value = 'scanning'
		operationMessage.value = null
		operationId.value = await startBackup(instance.value.id)
	})
}

function cancel() {
	if (!operationId.value || !canCancel.value) return
	void runAction('cancel', async () => {
		await cancelBackup(operationId.value!)
	})
}

function confirmDelete(snapshot: BackupSnapshot) {
	selectedSnapshot.value = snapshot
	deleteModal.value?.show()
}

function confirmRestore(snapshot: BackupSnapshot) {
	selectedSnapshot.value = snapshot
	restoreModal.value?.show()
}

function removeSnapshot() {
	if (!selectedSnapshot.value) return
	void runAction(`delete:${selectedSnapshot.value.id}`, async () => {
		await deleteBackup(selectedSnapshot.value!.id)
		await refresh()
		deleteModal.value?.hide()
		selectedSnapshot.value = null
	})
}

function restoreSnapshot() {
	if (!selectedSnapshot.value) return
	void runAction(`restore:${selectedSnapshot.value.id}`, async () => {
		await restoreBackup(selectedSnapshot.value!.id)
		restoreModal.value?.hide()
		selectedSnapshot.value = null
	})
}

function disable() {
	void runAction('disable', async () => {
		await disableBackups(instance.value.id)
		await refresh()
	})
}

onMounted(async () => {
	unlisten = await listenBackupProgress((event) => {
		if (event.instanceId !== instance.value.id) return
		operationId.value = event.operationId
		operationStage.value = event.stage
		operationMessage.value = event.message ?? null
		if (['completed', 'cancelled', 'failed'].includes(event.stage)) {
			operationId.value = null
			void refresh()
		}
	})
	await refresh()
})

onUnmounted(() => unlisten?.())
watch(
	() => instance.value.id,
	() => void refresh(),
)
</script>

<template>
	<div class="flex flex-col gap-5">
		<header>
			<h2 class="m-0 text-lg font-semibold text-contrast">{{ formatMessage(messages.title) }}</h2>
			<p class="m-0 mt-1 text-secondary">{{ formatMessage(messages.description) }}</p>
		</header>

		<p v-if="loading" class="m-0 text-secondary">{{ formatMessage(messages.loading) }}</p>
		<Admonition v-else-if="!eligible" type="warning" :header="formatMessage(messages.unavailable)">
			{{ unavailableReason }}
		</Admonition>
		<template v-else-if="config">
			<div v-if="!config.enabled || editingFolders" class="flex flex-col gap-4">
				<p class="m-0 text-secondary">{{ formatMessage(messages.choose) }}</p>
				<BackupDirectorySelector
					v-model="selectedDirectories"
					:directories="directories"
					:disabled="action !== null"
				/>
				<div class="flex flex-wrap gap-2">
					<ButtonStyled>
						<button
							type="button"
							:disabled="action !== null || selectedDirectories.length === 0"
							@click="config.enabled ? saveFolders() : enable()"
						>
							<SaveIcon />
							{{ formatMessage(config.enabled ? messages.saveFolders : messages.enable) }}
						</button>
					</ButtonStyled>
					<ButtonStyled v-if="config.enabled" type="outlined">
						<button type="button" :disabled="action !== null" @click="editingFolders = false">
							<XIcon />
							{{ formatMessage(commonMessages.cancelButton) }}
						</button>
					</ButtonStyled>
				</div>
			</div>

			<template v-else>
				<div class="flex flex-col gap-2 rounded-lg border border-solid border-surface-4 p-3">
					<p class="m-0 text-sm text-secondary">
						{{
							formatMessage(messages.selectedFolders, {
								folders: config.selected_directories.join(', '),
							})
						}}
					</p>
					<div class="flex flex-wrap gap-2">
						<ButtonStyled>
							<button type="button" :disabled="isRunning || action !== null" @click="start">
								<FileArchiveIcon />
								{{ formatMessage(messages.backupNow) }}
							</button>
						</ButtonStyled>
						<ButtonStyled v-if="canCancel" type="outlined">
							<button type="button" :disabled="action !== null" @click="cancel">
								<XIcon />
								{{ formatMessage(messages.cancelBackup) }}
							</button>
						</ButtonStyled>
						<ButtonStyled type="outlined">
							<button
								type="button"
								:disabled="isRunning || action !== null"
								@click="beginEditingFolders"
							>
								{{ formatMessage(messages.editFolders) }}
							</button>
						</ButtonStyled>
					</div>
					<p v-if="isRunning" class="m-0 text-sm font-medium text-contrast">
						{{
							formatMessage(
								operationStage === 'saving' ? messages.stageSaving : messages.stageScanning,
							)
						}}
					</p>
					<p v-else-if="operationStage === 'failed'" class="m-0 text-sm text-red">
						{{ formatMessage(messages.stageFailed)
						}}<span v-if="operationMessage">: {{ operationMessage }}</span>
					</p>
				</div>

				<section class="flex flex-col gap-3">
					<h3 class="m-0 text-base font-semibold text-contrast">
						{{ formatMessage(messages.snapshots) }}
					</h3>
					<p v-if="snapshots.length === 0" class="m-0 text-secondary">
						{{ formatMessage(messages.empty) }}
					</p>
					<div
						v-else
						class="divide-y divide-solid divide-surface-4 rounded-lg border border-solid border-surface-4"
					>
						<div
							v-for="snapshot in snapshots"
							:key="snapshot.id"
							class="flex items-center gap-3 px-3 py-3"
						>
							<FileArchiveIcon class="size-5 shrink-0 text-secondary" />
							<div class="min-w-0 flex-1">
								<p class="m-0 font-semibold text-contrast">
									{{ formatDate(new Date(snapshot.created_at)) }}
								</p>
								<p class="m-0 text-sm text-secondary">
									{{
										formatMessage(messages.snapshotMeta, {
											files: snapshot.file_count,
											size: formatBytes(snapshot.logical_size),
										})
									}}
									·
									{{
										formatMessage(messages.addedSize, { size: formatBytes(snapshot.added_size) })
									}}
								</p>
							</div>
							<ButtonStyled circular size="small" type="transparent">
								<button
									type="button"
									:disabled="action !== null || isRunning"
									:aria-label="formatMessage(messages.restore)"
									@click="confirmRestore(snapshot)"
								>
									<UndoIcon />
								</button>
							</ButtonStyled>
							<ButtonStyled circular color="red" size="small" type="transparent">
								<button
									type="button"
									:disabled="action !== null || isRunning"
									:aria-label="formatMessage(messages.delete)"
									@click="confirmDelete(snapshot)"
								>
									<TrashIcon />
								</button>
							</ButtonStyled>
						</div>
					</div>
				</section>

				<div class="flex flex-col items-start gap-2">
					<ButtonStyled color="red" type="outlined">
						<button
							type="button"
							:disabled="snapshots.length > 0 || action !== null || isRunning"
							@click="disable"
						>
							{{ formatMessage(messages.disable) }}
						</button>
					</ButtonStyled>
					<p v-if="snapshots.length > 0" class="m-0 text-sm text-secondary">
						{{ formatMessage(messages.disableBlocked) }}
					</p>
				</div>
			</template>
		</template>

		<NewModal
			ref="deleteModal"
			:header="formatMessage(messages.deleteTitle)"
			fade="danger"
			max-width="500px"
		>
			<Admonition type="critical">{{ formatMessage(messages.deleteBody) }}</Admonition>
			<template #actions>
				<ButtonStyled type="outlined"
					><button :disabled="action?.startsWith('delete:')" @click="deleteModal?.hide()">
						{{ formatMessage(commonMessages.cancelButton) }}
					</button></ButtonStyled
				>
				<ButtonStyled color="red"
					><button :disabled="action?.startsWith('delete:')" @click="removeSnapshot">
						<TrashIcon />{{ formatMessage(messages.delete) }}
					</button></ButtonStyled
				>
			</template>
		</NewModal>
		<NewModal ref="restoreModal" :header="formatMessage(messages.restoreTitle)" max-width="500px">
			<Admonition type="warning">{{ formatMessage(messages.restoreBody) }}</Admonition>
			<template #actions>
				<ButtonStyled type="outlined"
					><button :disabled="action?.startsWith('restore:')" @click="restoreModal?.hide()">
						{{ formatMessage(commonMessages.cancelButton) }}
					</button></ButtonStyled
				>
				<ButtonStyled
					><button :disabled="action?.startsWith('restore:')" @click="restoreSnapshot">
						<UndoIcon />{{ formatMessage(messages.restore) }}
					</button></ButtonStyled
				>
			</template>
		</NewModal>
	</div>
</template>
