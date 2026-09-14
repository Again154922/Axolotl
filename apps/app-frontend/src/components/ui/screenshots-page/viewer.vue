<script setup lang="ts">
import { NewModal } from '@modrinth/ui'
import { computed, ref } from 'vue'

export interface ScreenshotViewerItem {
	id: string
	src: string
	alt: string
	title: string
	description?: string
}

export interface ScreenshotViewerSavePayload {
	item: ScreenshotViewerItem
	pngBytes: Uint8Array
	mode: 'create_copy' | 'replace_edit'
}

const props = defineProps<{
	items: ScreenshotViewerItem[]
	editor?: string
	saving?: boolean
}>()

defineEmits<{ save: [payload: ScreenshotViewerSavePayload] }>()

const modal = ref<InstanceType<typeof NewModal>>()
const currentIndex = ref(0)
const currentItem = computed(() => props.items[currentIndex.value])

function show(index: number) {
	currentIndex.value = index
	modal.value?.show()
}

function edit(index: number) {
	show(index)
}

function hide() {
	modal.value?.hide()
}

function markSavedAndView(id: string) {
	const index = props.items.findIndex((item) => item.id === id)
	if (index >= 0) currentIndex.value = index
}

defineExpose({ show, edit, hide, markSavedAndView })
</script>

<template>
	<NewModal ref="modal" :header="currentItem?.title ?? ''" max-width="72rem">
		<div v-if="currentItem" class="flex min-h-0 flex-col gap-3">
			<img
				:src="currentItem.src"
				:alt="currentItem.alt"
				class="max-h-[70vh] w-full object-contain"
			/>
			<div class="flex items-center gap-2">
				<span class="min-w-0 flex-1 truncate text-secondary">{{ currentItem.description }}</span>
				<slot name="actions" :item="currentItem" />
			</div>
		</div>
	</NewModal>
</template>
