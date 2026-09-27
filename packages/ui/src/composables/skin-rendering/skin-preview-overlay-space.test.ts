import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveOverlayNeeds, resolveOverlaySafePadding } from './skin-preview-overlay-space.ts'
import type { SkinPreviewFitPadding } from './types.ts'

const PAGE_PADDING: SkinPreviewFitPadding = { top: 0.2, right: 0.14, bottom: 0.3, left: 0.14 }

function roomFor(padding: SkinPreviewFitPadding, containerHeight: number, side: 'top' | 'bottom') {
	return (padding[side] * containerHeight) / (1 + padding.top + padding.bottom)
}

test('asks for the overlays that are on screen', () => {
	assert.deepEqual(
		resolveOverlayNeeds({
			nametag: false,
			hasNametagBadge: false,
			hasSubtitle: false,
			subtitleWrapped: false,
		}),
		{ topPx: 0, bottomPx: 0 },
	)

	const named = resolveOverlayNeeds({
		nametag: true,
		hasNametagBadge: false,
		hasSubtitle: true,
		subtitleWrapped: false,
	})
	assert.ok(named.topPx > 0)
	assert.ok(named.bottomPx > named.topPx)

	// The badge sits above the nametag, and wrapped buttons need a second row.
	const both = resolveOverlayNeeds({
		nametag: true,
		hasNametagBadge: true,
		hasSubtitle: true,
		subtitleWrapped: true,
	})
	assert.ok(both.topPx > named.topPx)
	assert.ok(both.bottomPx > named.bottomPx)
})

test('leaves the framing alone when the container affords the overlays', () => {
	const needs = resolveOverlayNeeds({
		nametag: true,
		hasNametagBadge: false,
		hasSubtitle: true,
		subtitleWrapped: false,
	})

	assert.deepEqual(resolveOverlaySafePadding(PAGE_PADDING, 800, needs), PAGE_PADDING)
})

test('leaves the framing alone when there is nothing to reserve for', () => {
	assert.deepEqual(
		resolveOverlaySafePadding(PAGE_PADDING, 200, { topPx: 0, bottomPx: 0 }),
		PAGE_PADDING,
	)
})

test('keeps the controls usable on a short container', () => {
	const needs = resolveOverlayNeeds({
		nametag: false,
		hasNametagBadge: false,
		hasSubtitle: true,
		subtitleWrapped: false,
	})
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 400, needs)

	assert.ok(roomFor(padding, 400, 'bottom') >= needs.bottomPx - 0.5)
	// The reserves the overlays do not need keep the preset they were framed with.
	assert.equal(padding.top, PAGE_PADDING.top)
	assert.equal(padding.left, PAGE_PADDING.left)
	assert.equal(padding.right, PAGE_PADDING.right)
})

test('keeps both the nametag and the controls usable on a short container', () => {
	const needs = resolveOverlayNeeds({
		nametag: true,
		hasNametagBadge: false,
		hasSubtitle: true,
		subtitleWrapped: false,
	})
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 400, needs)

	assert.ok(roomFor(padding, 400, 'top') >= needs.topPx - 0.5)
	assert.ok(roomFor(padding, 400, 'bottom') >= needs.bottomPx - 0.5)
})

test('never lowers a preset reserve', () => {
	const generous: SkinPreviewFitPadding = { top: 0.5, right: 0.2, bottom: 0.6, left: 0.2 }
	const padding = resolveOverlaySafePadding(generous, 400, { topPx: 40, bottomPx: 96 })

	assert.ok(padding.top >= generous.top)
	assert.ok(padding.bottom >= generous.bottom)
	assert.ok(roomFor(padding, 400, 'top') >= 40 - 0.5)
	assert.ok(roomFor(padding, 400, 'bottom') >= 96 - 0.5)
})

test('keeps the controls reachable when both overlays cannot fit', () => {
	const needs = resolveOverlayNeeds({
		nametag: true,
		hasNametagBadge: true,
		hasSubtitle: true,
		subtitleWrapped: true,
	})
	const padding = resolveOverlaySafePadding(PAGE_PADDING, 240, needs)

	// The model can be looked at again, so the controls win the room here.
	assert.ok(roomFor(padding, 240, 'bottom') >= needs.bottomPx - 0.5)
	assert.ok(padding.top >= PAGE_PADDING.top)
})

test('asks for nothing when even the controls cannot fit', () => {
	assert.deepEqual(
		resolveOverlaySafePadding(PAGE_PADDING, 100, { topPx: 60, bottomPx: 120 }),
		PAGE_PADDING,
	)
	assert.deepEqual(
		resolveOverlaySafePadding(PAGE_PADDING, 1, { topPx: 10, bottomPx: 10 }),
		PAGE_PADDING,
	)
})
