<script setup lang="ts">
import { defineMessages, Toggle, injectNotificationManager, useVIntl } from '@modrinth/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'

import {
  type SyncedOption,
  get_synced_options_overview,
  set_instance_synced_option,
} from '@/helpers/instance'
import { instanceKeys } from '@/pages/instance/query-options'
import { injectInstanceSettings } from '@/providers/instance-settings'

const { instance } = injectInstanceSettings()
const { formatMessage } = useVIntl()
const { handleError } = injectNotificationManager()
const queryClient = useQueryClient()

const messages = defineMessages({
  title: { id: 'instance.settings.sync.title', defaultMessage: 'Settings synchronization' },
  description: {
    id: 'instance.settings.sync.description',
    defaultMessage: 'Choose which settings this instance shares with other instances.',
  },
  unsupported: { id: 'instance.settings.sync.unsupported', defaultMessage: 'Unavailable for this instance' },
})

const options: Array<{ key: SyncedOption; label: string }> = [
  { key: 'game_options', label: 'Game settings' },
  { key: 'command_history', label: 'Command history' },
  { key: 'multiplayer_servers', label: 'Multiplayer servers' },
  { key: 'creative_hotbars', label: 'Creative hotbars' },
  { key: 'screenshots', label: 'Screenshots' },
  { key: 'resource_packs', label: 'Resource packs' },
  { key: 'data_packs', label: 'Data packs' },
]

const overviewQuery = useQuery({
  queryKey: computed(() => ['instance-synced-options', instance.value.id, 'overview']),
  queryFn: () => get_synced_options_overview(instance.value.id),
})

const mutation = useMutation({
  mutationFn: ({ option, enabled }: { option: SyncedOption; enabled: boolean }) =>
    set_instance_synced_option(instance.value.id, option, enabled),
  onSuccess: async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: instanceKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['instance-synced-options'] }),
    ])
  },
  onError: handleError,
})

const capabilityMap = computed(() =>
  new Map((overviewQuery.data.value?.capabilities ?? []).map((capability) => [capability.option, capability])),
)

function enabled(option: SyncedOption) {
  return instance.value.synced_options?.[option] ?? false
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="m-0 text-lg font-semibold text-contrast">{{ formatMessage(messages.title) }}</h2>
      <p class="m-0 text-secondary">{{ formatMessage(messages.description) }}</p>
    </div>
    <div v-for="item in options" :key="item.key" class="flex items-center justify-between gap-4">
      <span class="text-contrast">{{ item.label }}</span>
      <Toggle
        :model-value="enabled(item.key)"
        :disabled="mutation.isPending.value || capabilityMap.get(item.key)?.supported === false"
        :aria-label="item.label"
        @update:model-value="(value) => mutation.mutate({ option: item.key, enabled: value })"
      />
    </div>
    <p v-if="overviewQuery.data.value?.capabilities.some((item) => item.supported === false)" class="m-0 text-secondary">
      {{ formatMessage(messages.unsupported) }}
    </p>
  </div>
</template>
