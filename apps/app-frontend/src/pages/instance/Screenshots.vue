<script setup lang="ts">
import ScreenshotsPage from '@/components/ui/screenshots-page/index.vue'
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
	<div class="box-border h-full p-6">
		<ScreenshotsPage :instance-id="String(route.params.id)" show-heading />
	</div>
</template>
