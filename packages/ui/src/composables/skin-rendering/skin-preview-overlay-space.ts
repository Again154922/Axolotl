import type { SkinPreviewFitPadding } from './types'

/** The gap the nametag keeps above the model's head. */
export const NAMETAG_HEAD_OFFSET = 16
/** Distance from the model's feet down to the preview controls. */
export const PREVIEW_CONTROLS_FOOT_OFFSET = 64
/** Distance from the model's feet down to the subtitle row. */
export const SUBTITLE_CONTROLS_OFFSET = 48

/** One row of `h-10` buttons, with the gap that keeps them off the feet. */
const SUBTITLE_ROW_PX = 48
/** The same buttons once they wrap onto two lines. */
const SUBTITLE_WRAPPED_PX = 96
/** A nametag line at its largest measured font size. */
const NAMETAG_PX = 30
/** The "previewing" badge, which sits a gap above the nametag. */
const NAMETAG_BADGE_PX = 44
/** Slack that keeps the overlays clear of what they were measured against. */
const OVERLAY_GAP_PX = 8

export type SkinPreviewOverlayNeeds = {
	/** Pixels the nametag and its badge need above the model's head. */
	topPx: number
	/** Pixels the controls need below the model's feet. */
	bottomPx: number
}

export function resolveOverlayNeeds({
	nametag,
	hasNametagBadge,
	hasSubtitle,
	subtitleWrapped,
}: {
	nametag: boolean
	hasNametagBadge: boolean
	hasSubtitle: boolean
	subtitleWrapped: boolean
}): SkinPreviewOverlayNeeds {
	const nametagPx = nametag ? NAMETAG_HEAD_OFFSET + NAMETAG_PX + OVERLAY_GAP_PX : 0
	const badgePx = hasNametagBadge ? NAMETAG_BADGE_PX + NAMETAG_HEAD_OFFSET + OVERLAY_GAP_PX : 0
	const controlsPx = hasSubtitle
		? SUBTITLE_CONTROLS_OFFSET +
			(subtitleWrapped ? SUBTITLE_WRAPPED_PX : SUBTITLE_ROW_PX) +
			OVERLAY_GAP_PX
		: 0

	return { topPx: nametagPx + badgePx, bottomPx: controlsPx }
}

/**
 * The framing presets reserve room for the overlays as a share of the model, so
 * the room they leave on screen shrinks with the container. On a short window
 * the nametag ends up against the heading and the controls are squeezed to a
 * sliver. Hold the reserves to the pixels the overlays actually need instead.
 *
 * Only ever raises a reserve: a container that already affords the overlays
 * keeps the framing it has today.
 */
export function resolveOverlaySafePadding(
	padding: SkinPreviewFitPadding,
	containerHeight: number,
	{ topPx, bottomPx }: SkinPreviewOverlayNeeds,
): SkinPreviewFitPadding {
	if (containerHeight <= 1) return padding

	// The padding box is fitted into the container, so a reserve leaves
	// `fraction * containerHeight / (1 + top + bottom)` pixels on screen.
	const leavesPixels = (fraction: number, pixels: number) =>
		fraction * (containerHeight / (1 + padding.top + padding.bottom)) >= pixels

	if (leavesPixels(padding.top, topPx) && leavesPixels(padding.bottom, bottomPx)) return padding

	const needSum = topPx + bottomPx
	if (needSum >= containerHeight) {
		// Both overlays cannot fit. The model is the part that can be looked at
		// again, so keep the controls reachable and let the nametag take whatever
		// room is left.
		if (bottomPx <= 0 || bottomPx >= containerHeight) return padding

		return {
			...padding,
			bottom: Math.max(
				padding.bottom,
				(bottomPx * (1 + padding.top)) / (containerHeight - bottomPx),
			),
		}
	}

	// Solving both reserves at equality gives the box that leaves exactly the
	// requested room: the model gives up the pixels the overlays need, no more.
	const reserve = needSum / (containerHeight - needSum)
	let top = (reserve * topPx) / needSum
	let bottom = (reserve * bottomPx) / needSum

	// A reserve that is already larger than its share lifts the box, which takes
	// room back from the other side, so give that side its pixels back.
	if (padding.top > top) {
		top = padding.top
		bottom = Math.max(bottom, (bottomPx * (1 + top)) / (containerHeight - bottomPx))
	} else if (padding.bottom > bottom) {
		bottom = padding.bottom
		top = Math.max(top, (topPx * (1 + bottom)) / (containerHeight - topPx))
	}

	return { ...padding, top, bottom }
}
