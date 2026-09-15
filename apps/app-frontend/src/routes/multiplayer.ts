import './meta'

import type { RouteRecordRaw } from 'vue-router'

export const multiplayerRoutes: RouteRecordRaw[] = [
	{
		path: '/multiplayer',
		name: 'Multiplayer',
		component: () => import('@/pages/Multiplayer.vue'),
		meta: {
			breadcrumb: [{ name: 'Multiplayer' }],
			discordActivity: 'Idling...',
			pageTransitionGroup: 'multiplayer',
		},
		children: [
			{
				path: '',
				redirect: { name: 'MultiplayerServers' },
			},
			{
				path: 'servers',
				name: 'MultiplayerServers',
				component: () => import('@/components/multiplayer/servers/ServersOverview.vue'),
			},
			{
				path: 'servers/:id',
				name: 'MultiplayerServerDetail',
				component: () => import('@/components/multiplayer/servers/ServerDetail.vue'),
			},
			{
				path: 'servers/:id/studio',
				name: 'MultiplayerServerFileStudio',
				component: () => import('@/components/multiplayer/servers/ServerFileStudio.vue'),
				meta: {
					renderMode: 'fixed',
					breadcrumb: [{ name: 'Multiplayer', link: '/multiplayer/servers' }, { name: 'Studio' }],
				},
			},
			{
				path: 'rooms',
				name: 'MultiplayerRooms',
				component: () => import('@/components/multiplayer/MultiplayerRooms.vue'),
			},
		],
	},
]
