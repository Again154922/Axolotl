import assert from 'node:assert/strict'
import test from 'node:test'

import {
	clampNametagTop,
	keepsControlsVisible,
	MAX_OVERLAY_RESERVE,
	NAMETAG_MIN_TOP_PX,
	resolveOverlayNeeds,
	resolveOverlaySafePadding,
} from './skin-preview-overlay-space.ts'
import type { SkinPreviewFitPadding } from './types.ts'

const PAGE_PADDING: SkinPreviewFitPadding = { top: 0.2, right: 0.14, bottom: 0.3, left: 0.14 }

function roomFor(padding: SkinPreviewFitPadding, containerHeight: number, side: 'top' | 'bottom') {
	return (padding[side] * containerHeight) / (1 + padding.top + padding.bottom)
}

const NAMED = resolveOverlayNeeds({
	nametag: true,
	hasNametagBadge: false,
	hasSubtitle: true,
	subtitleWrapped: false,
})

const WRAPPED_WITH_BADGE = resolveOverlayNeeds({
	nametag: true,
	hasNametagBadge: true,
	hasSubtitle: true,
	subtitleWrapped: true,
})

test('asks for the overlays that are on screen', () => {
	assert.deepEqual(
		resolveOverlayNeeds({
			nametag: false,
			hasNametagBadge: false,
			hasSubtitle: false,
			subtitleWrapped: false,
		}),
		{ topPx: 0, bottomPx: 0, subtitleRowPx: 0 },
	)

	assert.ok(NAMED.topPx > 0)
	assert.ok(NAMED.bottomPx > NAMED.topPx)
	assert.equal(NAMED.subtitleRowPx, 40)

	// The badge sits above the nametag, and wrapped buttons need a second row.
	assert.ok(WRAPPED_WITH_BADGE.topPx > NAMED.topPx)
	assert.ok(WRAPPED_WITH_BADGE.bottomPx > NAMED.bottomPx)
	assert.ok(WRAPPED_WITH_BADGE.subtitleRowPx > NAMED.subtitleRowPx)
})

test('leaves the framing alone when the container affords the overlays', () => {
	assert.deepEqual(resolveOverlaySafePadding(PAGE_PADDING, 800, NAMED), PAGE_PADDING)
})

test('leaves the framing alone when there is nothing to reserve for', () => {
	assert.deepEqual(
		resolveOverlaySafePadding(PAGE_PADDING, 200, { topPx: 0, bottomPx: 0, subtitleRowPx: 0 }),
		PAGE_PADDING,
	)
})

test('keeps the controls usable on a short container', () => {
	const needs = { ...NAMED, topPx: 0 }
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 400, needs)

	assert.ok(roomFor(padding, 400, 'bottom') >= needs.bottomPx - 0.5)
	// The reserves the overlays do not need keep the preset they were framed with.
	assert.equal(padding.top, PAGE_PADDING.top)
	assert.equal(padding.left, PAGE_PADDING.left)
	assert.equal(padding.right, PAGE_PADDING.right)
})

test('keeps both the nametag and the controls usable on a short container', () => {
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 400, NAMED)

	assert.ok(roomFor(padding, 400, 'top') >= NAMED.topPx - 0.5)
	assert.ok(roomFor(padding, 400, 'bottom') >= NAMED.bottomPx - 0.5)
})

test('never lowers a preset reserve', () => {
	const generous: SkinPreviewFitPadding = { top: 0.5, right: 0.2, bottom: 0.6, left: 0.2 }
	const padding = resolveOverlaySafePadding(generous, 400, {
		topPx: 40,
		bottomPx: 96,
		subtitleRowPx: 40,
	})

	assert.ok(padding.top >= generous.top)
	assert.ok(padding.bottom >= generous.bottom)
	assert.ok(roomFor(padding, 400, 'top') >= 40 - 0.5)
	assert.ok(roomFor(padding, 400, 'bottom') >= 96 - 0.5)
})

test('keeps the reserves inside what the camera can fit', () => {
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 240, WRAPPED_WITH_BADGE)

	// The camera fits `height * (1 - top - bottom)`, so reserves that together
	// reach the whole frame would leave it nothing to fit and the model would
	// vanish from the preview entirely.
	assert.ok(padding.top + padding.bottom <= MAX_OVERLAY_RESERVE + 1e-9)
	assert.ok(padding.top >= PAGE_PADDING.top)
	assert.ok(padding.bottom >= PAGE_PADDING.bottom)
})

test('hands the controls to the placement fallback once the framing cannot hold them', () => {
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 240, WRAPPED_WITH_BADGE)
	const modelHeight = 240 / (1 + padding.top + padding.bottom)
	const fittedTop = 240 - padding.bottom * modelHeight + 48

	assert.equal(keepsControlsVisible(fittedTop, 240, WRAPPED_WITH_BADGE), false)
	assert.equal(keepsControlsVisible(100, 400, WRAPPED_WITH_BADGE), true)

	// The row fits above the bottom inset, and one pixel lower it does not.
	assert.equal(keepsControlsVisible(400 - 16 - NAMED.subtitleRowPx, 400, NAMED), true)
	assert.equal(keepsControlsVisible(400 - 16 - NAMED.subtitleRowPx + 1, 400, NAMED), false)
})

test('asks for nothing when even the controls cannot fit', () => {
	assert.deepEqual(
		resolveOverlaySafePadding(PAGE_PADDING, 100, {
			topPx: 60,
			bottomPx: 120,
			subtitleRowPx: 40,
		}),
		PAGE_PADDING,
	)
	assert.deepEqual(
		resolveOverlaySafePadding(PAGE_PADDING, 1, { topPx: 10, bottomPx: 10, subtitleRowPx: 10 }),
		PAGE_PADDING,
	)
})

test('keeps the nametag inside the preview', () => {
	assert.equal(clampNametagTop(-12), NAMETAG_MIN_TOP_PX)
	assert.equal(clampNametagTop(2), NAMETAG_MIN_TOP_PX)
	assert.equal(clampNametagTop(40), 40)
})
