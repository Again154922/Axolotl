import { createPinia, getActivePinia, setActivePinia } from 'pinia'

import type { UpgradeFlowSnapshot } from '../pages/instance/upgrade/flow.ts'
import {
	cloneUpgradeFlowSnapshot,
	upgradeProjectPath,
	useNavigationReturnStore,
} from '../store/navigation-return.ts'

function store() {
	if (!getActivePinia()) {
		setActivePinia(createPinia())
	}
	return useNavigationReturnStore()
}

export function parkUpgradeFlow(snapshot: UpgradeFlowSnapshot) {
	store().parkUpgradeFlow(snapshot)
}

export function peekUpgradeFlow(instanceId?: string): UpgradeFlowSnapshot | null {
	return store().peekUpgradeFlow(instanceId)
}

export function consumeUpgradeFlow(
	instanceId: string,
	returnFullPath: string,
): UpgradeFlowSnapshot | null {
	return store().consumeUpgradeFlow(instanceId, returnFullPath)
}

export function restoreUpgradeFlow(
	instanceId: string,
	returnFullPath: string,
	hydrate: (snapshot: UpgradeFlowSnapshot) => void,
): UpgradeFlowSnapshot | null {
	return store().restoreUpgradeFlow(instanceId, returnFullPath, hydrate)
}

export function clearUpgradeFlow() {
	store().clearUpgradeFlow()
}

export { cloneUpgradeFlowSnapshot, upgradeProjectPath }
