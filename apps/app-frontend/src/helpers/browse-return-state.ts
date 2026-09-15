import { createPinia, getActivePinia, setActivePinia } from 'pinia'

import {
	type BrowseReturnSnapshot,
	upgradeProjectPath,
	useNavigationReturnStore,
} from '../store/navigation-return.ts'

function store() {
	if (!getActivePinia()) {
		setActivePinia(createPinia())
	}
	return useNavigationReturnStore()
}

export type { BrowseReturnSnapshot }

export function saveBrowseReturnSnapshot<T>(snapshot: BrowseReturnSnapshot<T>): void {
	store().saveBrowseReturnSnapshot(snapshot)
}

export function consumeBrowseReturnSnapshot<T>(url: string): BrowseReturnSnapshot<T> | null {
	return store().consumeBrowseReturnSnapshot<T>(url)
}

export function hasBrowseReturnSnapshot(url: string): boolean {
	return store().hasBrowseReturnSnapshot(url)
}

export function clearBrowseReturnSnapshot(): void {
	store().clearBrowseReturnSnapshot()
}

export function isBrowseReturnSourcePath(path: string): boolean {
	return path === '/downloads' || path.startsWith('/project/') || path.startsWith('/instance/')
}

export function prepareBrowseReturnNavigation(url: string, sourcePath: string): boolean {
	return store().prepareBrowseReturnNavigation(url, sourcePath)
}

export function isBrowseReturnNavigation(url: string): boolean {
	return store().isBrowseReturnNavigation(url)
}

export function completeBrowseReturnNavigation(url: string): void {
	store().completeBrowseReturnNavigation(url)
}

export { upgradeProjectPath }
