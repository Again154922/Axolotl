import { defineMessage, type MessageDescriptor } from '@modrinth/ui'

/**
 * Experimental features ship behind a master switch plus a per-feature toggle.
 * Each entry declares the default value the feature falls back to when the
 * master switch is off or the user has not chosen yet, so the UI always has a
 * concrete "default" to show and reset to.
 */
export type ExperimentalFeatureId = 'window_title'

export interface ExperimentalFeatureDefinition {
	id: ExperimentalFeatureId
	title: MessageDescriptor
	description: MessageDescriptor
	/** Whether the feature starts enabled once the master switch is on. */
	defaultEnabled: boolean
	/** Whether this feature carries a user-editable default value. */
	hasDefaultValue: boolean
	/** Label for the default-value input, when `hasDefaultValue` is true. */
	defaultValueLabel?: MessageDescriptor
	/** Seed value used until the user edits it; doubles as the input placeholder. */
	seedDefaultValue?: string
}

export const experimentalMessages = defineMessages({
	pageTitle: {
		id: 'app.settings.experimental.title',
		defaultMessage: 'Experimental features',
	},
	warningTitle: {
		id: 'app.settings.experimental.warning-title',
		defaultMessage: 'These features are in grey release',
	},
	warningBody: {
		id: 'app.settings.experimental.warning-body',
		defaultMessage:
			'Experimental features are still being tested. They will not break the launcher basics, but their availability and behaviour are not guaranteed and may change or be removed at any time.',
	},
	masterTitle: {
		id: 'app.settings.experimental.master.title',
		defaultMessage: 'Enable experimental features',
	},
	masterDescription: {
		id: 'app.settings.experimental.master.description',
		defaultMessage:
			'Turn this on to unlock the features below. Turning it off keeps your saved choices but disables every experimental feature.',
	},
	masterConfirmTitle: {
		id: 'app.settings.experimental.master.confirm-title',
		defaultMessage: 'Enable experimental features?',
	},
	masterConfirmBody: {
		id: 'app.settings.experimental.master.confirm-body',
		defaultMessage:
			'Experimental features are in grey release: they are still being validated, so behaviour may change between releases and some options may be incomplete. The launcher basics keep working, but there is no guarantee these features are usable in every situation.',
	},
	masterConfirmAction: {
		id: 'app.settings.experimental.master.confirm-action',
		defaultMessage: 'I understand, enable them',
	},
	featureDefault: {
		id: 'app.settings.experimental.feature.default',
		defaultMessage: 'Default',
	},
	resetToDefault: {
		id: 'app.settings.experimental.feature.reset',
		defaultMessage: 'Reset',
	},
	disabledHint: {
		id: 'app.settings.experimental.feature.disabled-hint',
		defaultMessage: 'Turn on experimental features to change this.',
	},
	beta: { id: 'app.settings.experimental.beta', defaultMessage: 'Beta' },
	windowTitleTitle: {
		id: 'app.settings.experimental.window-title.title',
		defaultMessage: 'Custom Minecraft window title',
	},
	windowTitleDescription: {
		id: 'app.settings.experimental.window-title.description',
		defaultMessage:
			'Let each instance show a custom title in the Minecraft window. Set the fallback title used when an instance does not override it.',
	},
	windowTitleDefaultLabel: {
		id: 'app.settings.experimental.window-title.default-label',
		defaultMessage: 'Fallback window title',
	},
})

export const experimentalFeatures: ExperimentalFeatureDefinition[] = [
	{
		id: 'window_title',
		title: experimentalMessages.windowTitleTitle,
		description: experimentalMessages.windowTitleDescription,
		defaultEnabled: true,
		hasDefaultValue: true,
		defaultValueLabel: experimentalMessages.windowTitleDefaultLabel,
		seedDefaultValue: 'Minecraft',
	},
]

export interface ExperimentalFeatureState {
	enabled: boolean
	defaultValue?: string
}

export type ExperimentalFeatureStates = Partial<
	Record<ExperimentalFeatureId, ExperimentalFeatureState>
>

export function defaultFeatureState(
	feature: ExperimentalFeatureDefinition,
): Required<ExperimentalFeatureState> {
	return {
		enabled: feature.defaultEnabled,
		defaultValue: feature.seedDefaultValue ?? '',
	}
}

/** Resolves the stored state for a feature, falling back to its defaults. */
export function resolveFeatureState(
	states: ExperimentalFeatureStates,
	feature: ExperimentalFeatureDefinition,
): Required<ExperimentalFeatureState> {
	const stored = states[feature.id]
	const fallback = defaultFeatureState(feature)
	return {
		enabled: stored?.enabled ?? fallback.enabled,
		defaultValue: stored?.defaultValue ?? fallback.defaultValue,
	}
}
