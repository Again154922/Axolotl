import './meta'

import { createRouter, createWebHistory } from 'vue-router'

import { useNavigationReturnStore } from '@/store/navigation-return'

import { discoverRoutes } from './discover'
import { headlessDemoRoutes } from './headless-demo'
import { homeRoutes } from './home'
import { instanceRoutes } from './instance'
import { labRoutes } from './lab'
import { libraryRoutes } from './library'
import { multiplayerRoutes } from './multiplayer'
import { utilityRoutes } from './utility'

/**
 * Application router. Domain tables live in sibling modules; URLs and most
 * names match the legacy `routes.js` table (names are PascalCase).
 */
export default createRouter({
	history: createWebHistory(),
	routes: [
		...homeRoutes,
		...utilityRoutes,
		...discoverRoutes,
		...multiplayerRoutes,
		...labRoutes,
		...libraryRoutes,
		...instanceRoutes,
		...headlessDemoRoutes,
	],
	linkActiveClass: 'router-link-active',
	linkExactActiveClass: 'router-link-exact-active',
	beforeEach(to, from) {
		const navReturn = useNavigationReturnStore()
		const parkedUpgrade = navReturn.peekUpgradeFlow()
		if (
			parkedUpgrade &&
			!to.path.startsWith('/project/') &&
			!to.fullPath.startsWith(parkedUpgrade.returnFullPath)
		) {
			navReturn.clearUpgradeFlow()
		}
		if (to.path.startsWith('/browse/')) {
			navReturn.prepareBrowseReturnNavigation(to.fullPath, from.path)
		}
	},
	scrollBehavior(to, from) {
		const navReturn = useNavigationReturnStore()
		if (
			to.path.startsWith('/browse/') &&
			(navReturn.isBrowseReturnNavigation(to.fullPath) ||
				navReturn.hasBrowseReturnSnapshot(to.fullPath))
		) {
			return false
		}
		if (to.path === from.path) return
		// Sometimes Vue's scroll behavior is not working as expected, so we need to manually scroll to top (especially on Linux)
		document.querySelector('.app-viewport')?.scrollTo(0, 0)
		return {
			el: '.app-viewport',
			top: 0,
		}
	},
})
