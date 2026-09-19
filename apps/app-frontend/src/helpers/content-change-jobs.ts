import type { ContentItem } from '@modrinth/ui'

import type { InstallJobSnapshot } from './install.ts'

const activeStatuses = new Set(['queued', 'running', 'canceling', 'waiting_for_user'])

export function activeContentChangeJobs(
	jobs: InstallJobSnapshot[],
	instanceId: string,
): InstallJobSnapshot[] {
	return jobs.filter(
		(job) =>
			job.kind === 'change_content' &&
			(job.instance_id ?? job.target.instance_id ?? null) === instanceId &&
			activeStatuses.has(job.status),
	)
}

export function contentItemStableId(item: ContentItem): string | null {
	return item.instanceEntryId ?? item.instanceMemberId ?? item.instanceFileId ?? null
}

export function contentChangeAffectsItem(job: InstallJobSnapshot, item: ContentItem): boolean {
	const change = job.content_change
	if (!change) return false
	if (change.intent.type === 'update_all_user_added' && change.content_ids.length === 0) {
		return item.instanceOwnershipKind === 'user_added'
	}
	const contentId = contentItemStableId(item)
	return contentId != null && change.content_ids.includes(contentId)
}

export function hasActiveContentChange(jobs: InstallJobSnapshot[], item: ContentItem): boolean {
	return jobs.some((job) => contentChangeAffectsItem(job, item))
}
