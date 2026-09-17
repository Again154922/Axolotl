<script setup lang="ts">
withDefaults(
	defineProps<{
		label?: string
	}>(),
	{ label: 'Beta' },
)
</script>

<template>
	<span
		class="inline-flex shrink-0 items-center rounded-full border border-solid border-brand bg-brand-highlight px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-brand"
	>
		{{ label }}
	</span>
</template>
