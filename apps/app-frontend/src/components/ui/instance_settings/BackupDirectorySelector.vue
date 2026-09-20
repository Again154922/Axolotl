<script setup lang="ts">
import { CheckIcon, FolderIcon, PlusIcon, TrashIcon, XIcon } from '@modrinth/assets'
import { ButtonStyled, Checkbox, defineMessages, StyledInput, useVIntl } from '@modrinth/ui'
import { computed, ref } from 'vue'

import {
	type BackupDirectoryEntry,
	canonicalizeBackupDirectories,
	normalizeBackupDirectory,
} from '@/helpers/instance-backup'

const props = defineProps<{
	directories: BackupDirectoryEntry[]
	modelValue: string[]
	disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()
const { formatMessage } = useVIntl()
const manualPath = ref('')
const manualError = ref(false)

const messages = defineMessages({
	existing: {
		id: 'instance.backups.directories.existing',
		defaultMessage: 'Instance folders',
	},
	missing: { id: 'instance.backups.directories.missing', defaultMessage: 'Created when needed' },
	linked: { id: 'instance.backups.directories.linked', defaultMessage: 'Symbolic link' },
	manual: {
		id: 'instance.backups.directories.manual',
		defaultMessage: 'Additional relative folder',
	},
	manualPlaceholder: {
		id: 'instance.backups.directories.manual-placeholder',
		defaultMessage: 'For example: shaderpacks/custom',
	},
	add: { id: 'instance.backups.directories.add', defaultMessage: 'Add folder' },
	invalid: {
		id: 'instance.backups.directories.invalid',
		defaultMessage: 'Enter a relative folder inside this instance.',
	},
	remove: { id: 'instance.backups.directories.remove', defaultMessage: 'Remove {path}' },
	selectAll: {
		id: 'instance.backups.directories.select-all',
		defaultMessage: 'Select existing folders',
	},
	clearAll: { id: 'instance.backups.directories.clear-all', defaultMessage: 'Clear selection' },
})

const knownPaths = computed(() => new Set(props.directories.map((directory) => directory.path)))
const manualSelections = computed(() =>
	props.modelValue.filter((path) => !knownPaths.value.has(path)),
)

function isSelected(path: string) {
	return props.modelValue.some((selected) => path === selected || path.startsWith(`${selected}/`))
}

function setSelected(path: string, selected: boolean) {
	const values = selected
		? [...props.modelValue, path]
		: props.modelValue.filter((value) => value !== path && !value.startsWith(`${path}/`))
	emit('update:modelValue', canonicalizeBackupDirectories(values))
}

function addManual() {
	const normalized = normalizeBackupDirectory(manualPath.value)
	if (!normalized) {
		manualError.value = true
		return
	}
	manualError.value = false
	manualPath.value = ''
	emit('update:modelValue', canonicalizeBackupDirectories([...props.modelValue, normalized]))
}

function selectExisting() {
	emit(
		'update:modelValue',
		canonicalizeBackupDirectories([
			...props.modelValue,
			...props.directories
				.filter((directory) => directory.exists)
				.map((directory) => directory.path),
		]),
	)
}
</script>

<template>
	<div class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<span class="text-sm font-semibold text-contrast">{{
				formatMessage(messages.existing)
			}}</span>
			<div class="flex flex-wrap gap-1">
				<ButtonStyled size="small" type="transparent">
					<button type="button" :disabled="disabled" @click="selectExisting">
						<CheckIcon />
						{{ formatMessage(messages.selectAll) }}
					</button>
				</ButtonStyled>
				<ButtonStyled size="small" type="transparent">
					<button type="button" :disabled="disabled" @click="emit('update:modelValue', [])">
						<XIcon />
						{{ formatMessage(messages.clearAll) }}
					</button>
				</ButtonStyled>
			</div>
		</div>
		<div
			class="divide-y divide-solid divide-surface-4 rounded-lg border border-solid border-surface-4"
		>
			<label
				v-for="directory in directories"
				:key="directory.path"
				class="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2"
			>
				<Checkbox
					:model-value="isSelected(directory.path)"
					:disabled="disabled"
					@update:model-value="(value) => setSelected(directory.path, value)"
				/>
				<FolderIcon class="size-5 shrink-0 text-secondary" />
				<span class="min-w-0 flex-1 truncate font-medium text-contrast">{{ directory.name }}</span>
				<span v-if="!directory.exists" class="text-xs text-secondary">
					{{ formatMessage(messages.missing) }}
				</span>
				<span v-else-if="directory.is_symlink" class="text-xs text-secondary">
					{{ formatMessage(messages.linked) }}
				</span>
			</label>
		</div>

		<label class="flex flex-col gap-2 text-sm font-semibold text-contrast">
			{{ formatMessage(messages.manual) }}
			<div class="flex gap-2">
				<StyledInput
					v-model="manualPath"
					:disabled="disabled"
					:placeholder="formatMessage(messages.manualPlaceholder)"
					wrapper-class="min-w-0 flex-1"
					@keydown.enter.prevent="addManual"
				/>
				<ButtonStyled>
					<button type="button" :disabled="disabled" @click="addManual">
						<PlusIcon />
						{{ formatMessage(messages.add) }}
					</button>
				</ButtonStyled>
			</div>
		</label>
		<p v-if="manualError" class="m-0 text-sm text-red">{{ formatMessage(messages.invalid) }}</p>

		<div v-if="manualSelections.length" class="flex flex-col gap-1">
			<div
				v-for="path in manualSelections"
				:key="path"
				class="flex min-h-10 items-center gap-2 rounded-lg bg-button-bg px-3 py-2"
			>
				<FolderIcon class="size-4 shrink-0 text-secondary" />
				<code class="min-w-0 flex-1 truncate">{{ path }}</code>
				<ButtonStyled circular size="small" type="transparent">
					<button
						type="button"
						:disabled="disabled"
						:aria-label="formatMessage(messages.remove, { path })"
						@click="setSelected(path, false)"
					>
						<TrashIcon />
					</button>
				</ButtonStyled>
			</div>
		</div>
	</div>
</template>
