import {
	AbstractWebNotificationManager,
	type NotificationPanelLocation,
	type WebNotification,
} from '@modrinth/ui'
import { type Ref, ref } from 'vue'

export class AppNotificationManager extends AbstractWebNotificationManager {
	private static readonly STORAGE_KEY = 'axolotl:active-web-notifications-v1'
	private readonly state: Ref<WebNotification[]>
	private readonly locationState: Ref<NotificationPanelLocation>

	public constructor() {
		super()
		this.state = ref<WebNotification[]>(this.loadActiveNotifications())
		this.locationState = ref<NotificationPanelLocation>('right')
		this.state.value.forEach((notification) => this.restoreNotificationTimer(notification))
		this.saveActiveNotifications()
	}

	public getNotificationLocation(): NotificationPanelLocation {
		return this.locationState.value
	}

	public setNotificationLocation(location: NotificationPanelLocation): void {
		this.locationState.value = location
	}

	public getNotifications(): WebNotification[] {
		return this.state.value
	}

	protected addNotificationToStorage(notification: WebNotification): void {
		this.state.value.unshift(notification)
		this.saveActiveNotifications()
	}

	protected removeNotificationFromStorage(id: string | number): void {
		const index = this.state.value.findIndex((n) => n.id === id)
		if (index > -1) {
			this.state.value.splice(index, 1)
			this.saveActiveNotifications()
		}
	}

	protected removeNotificationFromStorageByIndex(index: number): void {
		this.state.value.splice(index, 1)
		this.saveActiveNotifications()
	}

	protected clearAllNotificationsFromStorage(): void {
		this.state.value.splice(0)
		this.saveActiveNotifications()
	}

	public override addNotification = (notification: Partial<WebNotification>): WebNotification => {
		const result = super.addNotification(notification)
		this.saveActiveNotifications()
		return result
	}

	public override collapseNotification = (id: string | number): void => {
		super.collapseNotification(id)
		this.saveActiveNotifications()
	}

	public override expandNotification = (id: string | number): void => {
		super.expandNotification(id)
		this.saveActiveNotifications()
	}

	public override removeNotification = (id: string | number): WebNotification | undefined => {
		const notification = super.removeNotification(id)
		this.saveActiveNotifications()
		return notification
	}

	private loadActiveNotifications(): WebNotification[] {
		try {
			const value = JSON.parse(localStorage.getItem(AppNotificationManager.STORAGE_KEY) ?? '[]')
			if (!Array.isArray(value)) return []
			return value.filter((notification): notification is WebNotification => {
				return (
					notification &&
					(typeof notification.id === 'string' || typeof notification.id === 'number') &&
					typeof notification.createdAt === 'number' &&
					(notification.title === undefined || typeof notification.title === 'string')
				)
			})
		} catch {
			return []
		}
	}

	private saveActiveNotifications(): void {
		try {
			const persisted = this.state.value.map(({ timer: _timer, ...notification }) => notification)
			localStorage.setItem(AppNotificationManager.STORAGE_KEY, JSON.stringify(persisted))
		} catch {
			// Notification history remains usable when storage is unavailable.
		}
	}

	private restoreNotificationTimer(notification: WebNotification): void {
		if (notification.collapsed || notification.autoCloseMs === null) return
		const elapsed = Date.now() - (notification.createdAt ?? Date.now())
		const remaining = (notification.autoCloseMs ?? 30_000) - elapsed
		if (remaining <= 0) {
			notification.collapsed = true
			return
		}
		notification.autoCloseMs = remaining
		this.setNotificationTimer(notification)
	}
}
