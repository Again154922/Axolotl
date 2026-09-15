import { convertFileSrc } from '@tauri-apps/api/core'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'

export function useImageThumbnail(
	path: MaybeRefOrGetter<string>,
	_maxDimension = 512,
	_version?: MaybeRefOrGetter<number>,
) {
	return computed(() => {
		const value = toValue(path)
		return value ? convertFileSrc(value) : ''
	})
}
