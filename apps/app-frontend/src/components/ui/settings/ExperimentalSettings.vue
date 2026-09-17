<script setup lang="ts">
import { RotateCcwIcon } from '@modrinth/assets'
import {
	Admonition,
	defineMessages,
	NewButton as Button,
	NewModal,
	StyledInput,
	Toggle,
	useVIntl,
} from '@modrinth/ui'
import { computed, ref, watch } from 'vue'

import { get as getSettings, set as setSettings } from '@/helpers/settings.ts'

import ExperimentalBadge from './ExperimentalBadge.vue'
import SettingsRow from './SettingsRow.vue'
import SettingsSection from './SettingsSection.vue'
import {
	defaultFeatureState,
	experimentalFeatures,
	experimentalMessages,
	type ExperimentalFeatureId,
	type ExperimentalFeatureStates,
	resolveFeatureState,
} from './experimental-features'

const { formatMessage } = useVIntl()
const settings = ref(await getSettings())

const messages = defineMessages({
	cancel: { id: 'app.settings.experimental.cancel', defaultMessage: 'Cancel' },
})

const featureStates = computed<ExperimentalFeatureStates>(
	() => (settings.value.experimental_features ?? {}) as ExperimentalFeatureStates,
)
const masterEnabled = computed(() => settings.value.experimental_features_enabled)

const confirmModal = ref<InstanceType<typeof NewModal> | null>(null)
const pendingEnable = ref(false)

function writeFeatureState(
	id: ExperimentalFeatureId,
	patch: Partial<{ enabled: boolean; defaultValue: string }>,
) {
	const next: ExperimentalFeatureStates = { ...featureStates.value }
	const current = next[id] ?? {}
	next[id] = { ...current, ...patch }
	settings.value.experimental_features = next as Record<string, unknown>
}

function featureState(id: ExperimentalFeatureId) {
	const feature = experimentalFeatures.find((entry) => entry.id === id)!
	return resolveFeatureState(featureStates.value, feature)
}

function isFeatureEnabled(id: ExperimentalFeatureId) {
	return masterEnabled.value && featureState(id).enabled
}

function setFeatureEnabled(id: ExperimentalFeatureId, enabled: boolean) {
	writeFeatureState(id, { enabled })
}

function setFeatureDefault(id: ExperimentalFeatureId, value: string) {
	writeFeatureState(id, { defaultValue: value })
}

function resetFeature(id: ExperimentalFeatureId) {
	const feature = experimentalFeatures.find((entry) => entry.id === id)!
	writeFeatureState(id, defaultFeatureState(feature))
}

/** The master switch warns once before the first enable. */
function requestMasterToggle(value: boolean) {
	if (!value) {
		settings.value.experimental_features_enabled = false
		return
	}
	pendingEnable.value = true
	confirmModal.value?.show()
}

function confirmMasterEnable() {
	settings.value.experimental_features_enabled = true
	pendingEnable.value = false
	confirmModal.value?.hide()
}

watch(
	settings,
	async () => {
		await setSettings(settings.value)
	},
	{ deep: true },
)
</script>

<template>
	<div class="flex flex-col gap-6">
		<Admonition type="warning" :header="formatMessage(experimentalMessages.warningTitle)">
			{{ formatMessage(experimentalMessages.warningBody) }}
		</Admonition>

		<SettingsSection>
			<SettingsRow>
				<template #label>
					<span
						id="settings-target-experimental-master"
						tabindex="-1"
						class="inline-flex items-center gap-2"
					>
						{{ formatMessage(experimentalMessages.masterTitle) }}
						<ExperimentalBadge :label="formatMessage(experimentalMessages.beta)" />
					</span>
				</template>
				<template #description>
					{{ formatMessage(experimentalMessages.masterDescription) }}
				</template>
				<template #control>
					<Toggle
						id="experimental-master"
						:model-value="masterEnabled"
						@update:model-value="(value) => requestMasterToggle(!!value)"
					/>
				</template>
			</SettingsRow>
		</SettingsSection>

		<!-- Search results for individual features scroll to this group. -->
		<div id="settings-target-experimental-features">
			<SettingsSection>
				<SettingsRow v-for="feature in experimentalFeatures" :key="feature.id" stacked>
				<template #label>
					<span
						:id="`settings-target-experimental-${feature.id}`"
						tabindex="-1"
						class="inline-flex items-center gap-2"
					>
						{{ formatMessage(feature.title) }}
						<ExperimentalBadge :label="formatMessage(experimentalMessages.beta)" />
					</span>
				</template>
				<template #description>
					<span class="block">{{ formatMessage(feature.description) }}</span>
					<span v-if="!masterEnabled" class="mt-1 block text-orange">
						{{ formatMessage(experimentalMessages.disabledHint) }}
					</span>
				</template>
				<template #control>
					<div class="flex w-full flex-col gap-3">
						<div class="flex items-center justify-end gap-3">
							<span class="text-xs text-secondary">
								{{ formatMessage(experimentalMessages.featureDefault) }}
							</span>
							<Button
								type="quiet"
								:disabled="!masterEnabled"
								@click="resetFeature(feature.id)"
							>
								<RotateCcwIcon />
								{{ formatMessage(experimentalMessages.resetToDefault) }}
							</Button>
							<Toggle
								:id="`experimental-${feature.id}`"
								:model-value="isFeatureEnabled(feature.id)"
								:disabled="!masterEnabled"
								@update:model-value="(value) => setFeatureEnabled(feature.id, !!value)"
							/>
						</div>
						<div
							v-if="feature.hasDefaultValue"
							class="flex items-center justify-end gap-3"
						>
							<span class="text-sm text-secondary">
								{{ feature.defaultValueLabel && formatMessage(feature.defaultValueLabel) }}
							</span>
							<StyledInput
								:id="`experimental-${feature.id}-default`"
								:model-value="featureState(feature.id).defaultValue"
								:disabled="!masterEnabled"
								autocomplete="off"
								type="text"
								:placeholder="feature.seedDefaultValue"
								@update:model-value="(value) => setFeatureDefault(feature.id, String(value))"
							/>
						</div>
					</div>
				</template>
			</SettingsRow>
			</SettingsSection>
		</div>
	</div>

	<NewModal
		ref="confirmModal"
		:header="formatMessage(experimentalMessages.masterConfirmTitle)"
		:fade="'warning'"
		max-width="520px"
		@hide="pendingEnable = false"
	>
		<Admonition type="warning">
			{{ formatMessage(experimentalMessages.masterConfirmBody) }}
		</Admonition>
		<template #actions>
			<div class="flex justify-end gap-2">
				<Button type="outlined" @click="confirmModal?.hide()">
					{{ formatMessage(messages.cancel) }}
				</Button>
				<Button type="colored" color="brand" @click="confirmMasterEnable">
					{{ formatMessage(experimentalMessages.masterConfirmAction) }}
				</Button>
			</div>
		</template>
	</NewModal>
</template>
