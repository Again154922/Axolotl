<script setup lang="ts">
import { CheckIcon, ChevronDownIcon, XIcon } from '@modrinth/assets'
import { defineMessages, useVIntl } from '@modrinth/ui'
import {
	CheckboxIndicator,
	CheckboxRoot,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogOverlay,
	DialogPortal,
	DialogRoot,
	DialogTitle,
	DialogTrigger,
	SelectContent,
	SelectItem,
	SelectItemIndicator,
	SelectItemText,
	SelectPortal,
	SelectRoot,
	SelectTrigger,
	SelectValue,
	SelectViewport,
	TooltipContent,
	TooltipPortal,
	TooltipProvider,
	TooltipRoot,
	TooltipTrigger,
} from 'reka-ui'
import { ref } from 'vue'

import { headlessTokenClasses } from '@/components/ui/headless/token-classes'

const { formatMessage } = useVIntl()

const acceptTerms = ref(false)
const selectedLoader = ref('fabric')
const dialogOpen = ref(false)

const loaderOptions = [
	{ value: 'vanilla', labelKey: 'loaderVanilla' },
	{ value: 'fabric', labelKey: 'loaderFabric' },
	{ value: 'forge', labelKey: 'loaderForge' },
	{ value: 'neoforge', labelKey: 'loaderNeoForge' },
] as const

const surfaces = [
	{ token: 'surface-1', className: 'bg-surface-1' },
	{ token: 'surface-2', className: 'bg-surface-2' },
	{ token: 'surface-3', className: 'bg-surface-3' },
	{ token: 'surface-4', className: 'bg-surface-4' },
	{ token: 'surface-5', className: 'bg-surface-5' },
] as const

const messages = defineMessages({
	title: { id: 'app.headless-demo.title', defaultMessage: 'Headless token demo' },
	description: {
		id: 'app.headless-demo.description',
		defaultMessage:
			'Isolated reka-ui primitives styled only with existing app tokens. Switch theme in Settings → Appearance to verify light, dark, and OLED.',
	},
	themeHint: {
		id: 'app.headless-demo.theme-hint',
		defaultMessage:
			'No second theme system is introduced here — surfaces and brand colors follow the active theme.',
	},
	surfacesHeading: { id: 'app.headless-demo.surfaces', defaultMessage: 'Surfaces' },
	controlsHeading: { id: 'app.headless-demo.controls', defaultMessage: 'Controls' },
	openDialog: { id: 'app.headless-demo.open-dialog', defaultMessage: 'Open dialog' },
	dialogTitle: { id: 'app.headless-demo.dialog-title', defaultMessage: 'Token-mapped dialog' },
	dialogDescription: {
		id: 'app.headless-demo.dialog-description',
		defaultMessage:
			'This dialog content uses bg-surface-2, text-contrast, and border-surface-5. Overlay and focus ring stay readable in every theme.',
	},
	dialogClose: { id: 'app.headless-demo.dialog-close', defaultMessage: 'Close' },
	tooltipTrigger: { id: 'app.headless-demo.tooltip-trigger', defaultMessage: 'Hover tooltip' },
	tooltipContent: {
		id: 'app.headless-demo.tooltip-content',
		defaultMessage: 'Tooltip body mapped to surface-4 / text-contrast.',
	},
	selectLabel: { id: 'app.headless-demo.select-label', defaultMessage: 'Loader' },
	selectPlaceholder: {
		id: 'app.headless-demo.select-placeholder',
		defaultMessage: 'Pick a loader',
	},
	loaderVanilla: { id: 'app.headless-demo.loader-vanilla', defaultMessage: 'Vanilla' },
	loaderFabric: { id: 'app.headless-demo.loader-fabric', defaultMessage: 'Fabric' },
	loaderForge: { id: 'app.headless-demo.loader-forge', defaultMessage: 'Forge' },
	loaderNeoForge: { id: 'app.headless-demo.loader-neoforge', defaultMessage: 'NeoForge' },
	checkboxLabel: {
		id: 'app.headless-demo.checkbox-label',
		defaultMessage: 'Accept demo checkbox (brand fill when checked)',
	},
	brandButton: { id: 'app.headless-demo.brand-button', defaultMessage: 'Brand button' },
	standardButton: { id: 'app.headless-demo.standard-button', defaultMessage: 'Standard button' },
})

function loaderLabel(value: string) {
	const option = loaderOptions.find((item) => item.value === value)
	return option
		? formatMessage(messages[option.labelKey])
		: formatMessage(messages.selectPlaceholder)
}
</script>

<template>
	<main class="flex w-full flex-col gap-6 p-6">
		<header class="flex min-w-0 flex-col gap-1">
			<h1 class="m-0 text-2xl font-bold text-contrast">{{ formatMessage(messages.title) }}</h1>
			<p class="m-0 text-sm text-secondary">{{ formatMessage(messages.description) }}</p>
			<p class="m-0 text-xs text-secondary">{{ formatMessage(messages.themeHint) }}</p>
		</header>

		<section class="flex flex-col gap-3" :aria-label="formatMessage(messages.surfacesHeading)">
			<h2 class="m-0 text-base font-bold text-contrast">
				{{ formatMessage(messages.surfacesHeading) }}
			</h2>
			<div class="flex flex-wrap gap-2">
				<div
					v-for="surface in surfaces"
					:key="surface.token"
					class="flex h-16 min-w-24 flex-1 items-end rounded-[var(--radius-md)] border border-surface-5 p-2"
					:class="surface.className"
				>
					<span class="font-mono text-xs text-primary">{{ surface.token }}</span>
				</div>
			</div>
		</section>

		<section class="flex flex-col gap-4" :aria-label="formatMessage(messages.controlsHeading)">
			<h2 class="m-0 text-base font-bold text-contrast">
				{{ formatMessage(messages.controlsHeading) }}
			</h2>

			<div class="flex flex-wrap items-center gap-3">
				<DialogRoot v-model:open="dialogOpen">
					<DialogTrigger as-child>
						<button type="button" :class="headlessTokenClasses.buttonBrand">
							{{ formatMessage(messages.openDialog) }}
						</button>
					</DialogTrigger>
					<DialogPortal>
						<DialogOverlay :class="headlessTokenClasses.dialogOverlay" />
						<DialogContent :class="headlessTokenClasses.dialogContent">
							<div class="flex items-start justify-between gap-3">
								<DialogTitle :class="headlessTokenClasses.dialogTitle">
									{{ formatMessage(messages.dialogTitle) }}
								</DialogTitle>
								<DialogClose as-child>
									<button
										type="button"
										aria-label="Close"
										class="flex size-8 shrink-0 items-center justify-center rounded-md text-secondary transition-colors hover:text-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
									>
										<XIcon class="size-4" />
									</button>
								</DialogClose>
							</div>
							<DialogDescription :class="headlessTokenClasses.dialogDescription">
								{{ formatMessage(messages.dialogDescription) }}
							</DialogDescription>
							<div class="mt-4 flex justify-end">
								<DialogClose as-child>
									<button type="button" :class="headlessTokenClasses.buttonStandard">
										{{ formatMessage(messages.dialogClose) }}
									</button>
								</DialogClose>
							</div>
						</DialogContent>
					</DialogPortal>
				</DialogRoot>

				<TooltipProvider>
					<TooltipRoot>
						<TooltipTrigger as-child>
							<button type="button" :class="headlessTokenClasses.buttonStandard">
								{{ formatMessage(messages.tooltipTrigger) }}
							</button>
						</TooltipTrigger>
						<TooltipPortal>
							<TooltipContent :class="headlessTokenClasses.tooltipContent" :side-offset="6">
								{{ formatMessage(messages.tooltipContent) }}
							</TooltipContent>
						</TooltipPortal>
					</TooltipRoot>
				</TooltipProvider>
			</div>

			<div class="flex flex-wrap items-end gap-4">
				<label class="flex min-w-40 flex-col gap-1 text-sm text-secondary">
					<span>{{ formatMessage(messages.selectLabel) }}</span>
					<SelectRoot v-model="selectedLoader">
						<SelectTrigger :class="headlessTokenClasses.selectTrigger">
							<SelectValue :placeholder="formatMessage(messages.selectPlaceholder)">
								{{ loaderLabel(selectedLoader) }}
							</SelectValue>
							<ChevronDownIcon class="size-4 shrink-0 text-secondary" />
						</SelectTrigger>
						<SelectPortal>
							<SelectContent
								:class="headlessTokenClasses.selectContent"
								position="popper"
								:side-offset="4"
							>
								<SelectViewport>
									<SelectItem
										v-for="option in loaderOptions"
										:key="option.value"
										:value="option.value"
										:class="headlessTokenClasses.selectItem"
									>
										<SelectItemText>{{ formatMessage(messages[option.labelKey]) }}</SelectItemText>
										<SelectItemIndicator class="absolute right-2 flex items-center">
											<CheckIcon class="size-3.5 text-brand" />
										</SelectItemIndicator>
									</SelectItem>
								</SelectViewport>
							</SelectContent>
						</SelectPortal>
					</SelectRoot>
				</label>

				<label class="flex cursor-pointer items-center gap-2 text-sm text-contrast">
					<CheckboxRoot v-model="acceptTerms" :class="headlessTokenClasses.checkboxRoot">
						<CheckboxIndicator class="flex items-center justify-center">
							<CheckIcon class="size-3.5" />
						</CheckboxIndicator>
					</CheckboxRoot>
					<span>{{ formatMessage(messages.checkboxLabel) }}</span>
				</label>
			</div>

			<div class="flex flex-wrap gap-3">
				<button type="button" :class="headlessTokenClasses.buttonBrand">
					{{ formatMessage(messages.brandButton) }}
				</button>
				<button type="button" :class="headlessTokenClasses.buttonStandard">
					{{ formatMessage(messages.standardButton) }}
				</button>
			</div>
		</section>
	</main>
</template>
