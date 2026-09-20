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

import { get_full_path } from '@/helpers/instance'
import {
	type BackupExclusion,
	type BackupProgressStage,
	type BackupRestorePreview,
	type BackupSnapshot,
	cancelBackup,
	deleteBackup,
	disableBackups,
	enableBackups,
	getBackupConfig,
	getBackupRestorePreview,
	type InstanceBackupConfig,
	type InstanceBackupEligibility,
	listBackups,
	listenBackupProgress,
	restoreBackup,
	startBackup,
	updateBackupExclusions,
} from '@/helpers/instance-backup'
import { injectInstanceSettings } from '@/providers/instance-settings'

import BackupExclusionSelector from './BackupExclusionSelector.vue'

const { instance } = injectInstanceSettings()
const { formatMessage } = useVIntl()
const formatBytes = useFormatBytes()
const formatDate = useFormatDateTime({ dateStyle: 'medium', timeStyle: 'short' })
const { handleError } = injectNotificationManager()

const messages = defineMessages({
	title: { id: 'instance.backups.title', defaultMessage: 'Instance backups' },
	description: {
		id: 'instance.backups.description',
		defaultMessage: 'Create deduplicated snapshots of the whole instance while it is closed.',
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
		defaultMessage:
			'Everything is backed up by default. Add files or folders that should be excluded.',
	},
	enable: { id: 'instance.backups.enable', defaultMessage: 'Enable backups' },
	editExclusions: { id: 'instance.backups.edit-exclusions', defaultMessage: 'Edit exclusions' },
	saveExclusions: {
		id: 'instance.backups.save-exclusions',
		defaultMessage: 'Save exclusions',
	},
	allIncluded: {
		id: 'instance.backups.all-included',
		defaultMessage: 'All instance files and folders are included.',
	},
	excludedPaths: {
		id: 'instance.backups.excluded-paths',
		defaultMessage: 'Excluded: {paths}',
	},
	backupNow: { id: 'instance.backups.backup-now', defaultMessage: 'Back up now' },
	cancelBackup: { id: 'instance.backups.cancel', defaultMessage: 'Cancel backup' },
	stageScanning: {
		id: 'instance.backups.stage.scanning',
		defaultMessage: 'Scanning files',
	},
	stageHashing: { id: 'instance.backups.stage.hashing', defaultMessage: 'Hashing files' },
	stageSaving: { id: 'instance.backups.stage.saving', defaultMessage: 'Saving snapshot index' },
	progressBytes: {
		id: 'instance.backups.progress-bytes',
		defaultMessage: '{processed} of {total}',
	},
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
		defaultMessage:
			'Upcoming operations: add {added, plural, one {# file} other {# files}}, modify {modified, plural, one {# file} other {# files}}, and delete {deleted, plural, one {# file} other {# files}}. Continue?',
	},
	deleteTitle: { id: 'instance.backups.delete-title', defaultMessage: 'Delete this backup?' },
	deleteBody: {
		id: 'instance.backups.delete-body',
		defaultMessage:
			'This snapshot will be permanently deleted. Unused stored files will also be removed.',
	},
})

const config = ref<InstanceBackupConfig | null>(null)
const snapshots = ref<BackupSnapshot[]>([])
const instanceRoot = ref('')
const loading = ref(true)
const editingExclusions = ref(false)
const excludedPaths = ref<BackupExclusion[]>([])
const action = ref<string | null>(null)
const operationId = ref<string | null>(null)
const operationStage = ref<BackupProgressStage | null>(null)
const operationMessage = ref<string | null>(null)
const operationProcessedBytes = ref(0)
const operationTotalBytes = ref(0)
const selectedSnapshot = ref<BackupSnapshot | null>(null)
const restorePreview = ref<BackupRestorePreview | null>(null)
const deleteModal = ref<InstanceType<typeof NewModal>>()
const restoreModal = ref<InstanceType<typeof NewModal>>()
let unlisten: (() => void) | null = null

const eligible = computed(() => config.value?.eligibility === 'eligible')
const isRunning = computed(() => operationId.value !== null)
const canCancel = computed(() =>
	operationStage.value === 'scanning' || operationStage.value === 'hashing',
)

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
		excludedPaths.value = nextConfig.enabled ? [...nextConfig.excluded_paths] : []
		const [nextRoot, nextSnapshots] = await Promise.all([
			nextConfig.eligibility === 'eligible' ? get_full_path(instance.value.id) : '',
			listBackups(instance.value.id),
		])
		instanceRoot.value = nextRoot
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
	void runAction('enable', async () => {
		config.value = await enableBackups(instance.value.id, excludedPaths.value)
		editingExclusions.value = false
	})
}

function beginEditingExclusions() {
	excludedPaths.value = [...(config.value?.excluded_paths ?? [])]
	editingExclusions.value = true
}

function saveExclusions() {
	void runAction('exclusions', async () => {
		config.value = await updateBackupExclusions(instance.value.id, excludedPaths.value)
		editingExclusions.value = false
	})
}

function start() {
	void runAction('start', async () => {
		operationStage.value = 'scanning'
		operationMessage.value = null
		operationProcessedBytes.value = 0
		operationTotalBytes.value = 0
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
	void runAction(`preview:${snapshot.id}`, async () => {
		const preview = await getBackupRestorePreview(snapshot.id)
		selectedSnapshot.value = snapshot
		restorePreview.value = preview
		restoreModal.value?.show()
	})
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
	if (!selectedSnapshot.value || !restorePreview.value) return
	void runAction(`restore:${selectedSnapshot.value.id}`, async () => {
		await restoreBackup(selectedSnapshot.value!.id, restorePreview.value!.plan_token)
		restoreModal.value?.hide()
		selectedSnapshot.value = null
		restorePreview.value = null
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
		if (event.operationType !== 'create' || event.instanceId !== instance.value.id) return
		operationId.value = event.operationId
		operationStage.value = event.stage
		operationMessage.value = event.message ?? null
		operationProcessedBytes.value = event.processedBytes
		operationTotalBytes.value = event.totalBytes
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
			<div v-if="!config.enabled || editingExclusions" class="flex flex-col gap-4">
				<p class="m-0 text-secondary">{{ formatMessage(messages.choose) }}</p>
				<BackupExclusionSelector
					v-model="excludedPaths"
					:instance-id="instance.id"
					:instance-root="instanceRoot"
					:disabled="action !== null"
				/>
				<div class="flex flex-wrap gap-2">
					<ButtonStyled>
						<button
							type="button"
							:disabled="action !== null"
							@click="config.enabled ? saveExclusions() : enable()"
						>
							<SaveIcon />
							{{ formatMessage(config.enabled ? messages.saveExclusions : messages.enable) }}
						</button>
					</ButtonStyled>
					<ButtonStyled v-if="config.enabled" type="outlined">
						<button type="button" :disabled="action !== null" @click="editingExclusions = false">
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
							config.excluded_paths.length === 0
								? formatMessage(messages.allIncluded)
								: formatMessage(messages.excludedPaths, {
										paths: config.excluded_paths.map((entry) => entry.path).join(', '),
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
								@click="beginEditingExclusions"
							>
								{{ formatMessage(messages.editExclusions) }}
							</button>
						</ButtonStyled>
					</div>
					<p v-if="isRunning" class="m-0 text-sm font-medium text-contrast">
						{{
							formatMessage(
								operationStage === 'saving'
									? messages.stageSaving
									: operationStage === 'hashing'
										? messages.stageHashing
										: messages.stageScanning,
							)
						}}
						<span v-if="operationTotalBytes > 0" class="ml-2 text-secondary">
							{{
								formatMessage(messages.progressBytes, {
									processed: formatBytes(operationProcessedBytes),
									total: formatBytes(operationTotalBytes),
								})
							}}
						</span>
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
				<div class="flex items-center justify-end gap-2">
					<ButtonStyled type="outlined">
						<button :disabled="action?.startsWith('delete:')" @click="deleteModal?.hide()">
							{{ formatMessage(commonMessages.cancelButton) }}
						</button>
					</ButtonStyled>
					<ButtonStyled color="red">
						<button :disabled="action?.startsWith('delete:')" @click="removeSnapshot">
							<TrashIcon />{{ formatMessage(messages.delete) }}
						</button>
					</ButtonStyled>
				</div>
			</template>
		</NewModal>
		<NewModal ref="restoreModal" :header="formatMessage(messages.restoreTitle)" max-width="500px">
			<Admonition v-if="restorePreview" type="warning">
				{{
					formatMessage(messages.restoreBody, {
						added: restorePreview.added_files,
						modified: restorePreview.modified_files,
						deleted: restorePreview.deleted_files,
					})
				}}
			</Admonition>
			<template #actions>
				<div class="flex items-center justify-end gap-2">
					<ButtonStyled type="outlined">
						<button :disabled="action?.startsWith('restore:')" @click="restoreModal?.hide()">
							{{ formatMessage(commonMessages.cancelButton) }}
						</button>
					</ButtonStyled>
					<ButtonStyled>
						<button :disabled="action?.startsWith('restore:')" @click="restoreSnapshot">
							<UndoIcon />{{ formatMessage(messages.restore) }}
						</button>
					</ButtonStyled>
				</div>
			</template>
		</NewModal>
	</div>
</template>
