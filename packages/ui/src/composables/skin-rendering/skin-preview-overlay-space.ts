import type { SkinPreviewFitPadding } from './types'

/** The gap the nametag keeps above the model's head. */
export const NAMETAG_HEAD_OFFSET = 16
/** Distance from the model's feet down to the preview controls. */
export const PREVIEW_CONTROLS_FOOT_OFFSET = 64
/** Distance from the model's feet down to the subtitle row. */
export const SUBTITLE_CONTROLS_OFFSET = 48
/** Smallest gap the nametag keeps from the top of the preview. */
export const NAMETAG_MIN_TOP_PX = 8
/** Inset the subtitle keeps from the bottom of the preview. */
export const SUBTITLE_BOTTOM_INSET_PX = 16
/** One row of `h-10` buttons. */
export const SUBTITLE_ROW_PX = 40
/** The same buttons once they wrap onto two lines. */
export const SUBTITLE_WRAPPED_PX = 88
/** Smallest height the preview controls need to stay usable. */
export const PREVIEW_CONTROLS_MIN_PX = 40

const SUBTITLE_GAP_PX = 8
/** A nametag line at its largest measured font size. */
const NAMETAG_PX = 30
/** The "previewing" badge, which sits a gap above the nametag. */
const NAMETAG_BADGE_PX = 44
/** Slack that keeps the overlays clear of what they were measured against. */
const OVERLAY_GAP_PX = 8

/**
 * The camera fits the model into `height * (1 - top - bottom)`, so reserves that
 * together reach the whole frame stop it from fitting anything at all. The
 * presets stay under half the frame; a reserve raised for the overlays may use
 * this much of it and no more.
 */
export const MAX_OVERLAY_RESERVE = 0.8

export type SkinPreviewOverlayNeeds = {
	/** Pixels the nametag and its badge need above the model's head. */
	topPx: number
	/** Pixels the controls need below the model's feet. */
	bottomPx: number
	/** Height of the subtitle row itself, without the offsets around it. */
	subtitleRowPx: number
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
	const subtitleRowPx = hasSubtitle ? (subtitleWrapped ? SUBTITLE_WRAPPED_PX : SUBTITLE_ROW_PX) : 0
	const controlsPx = hasSubtitle
		? SUBTITLE_CONTROLS_OFFSET + subtitleRowPx + SUBTITLE_GAP_PX + SUBTITLE_BOTTOM_INSET_PX
		: 0

	return { topPx: nametagPx + badgePx, bottomPx: controlsPx, subtitleRowPx }
}

/**
 * The framing presets reserve room for the overlays as a share of the model, so
 * the room they leave on screen shrinks with the container: on a short window
 * the nametag ends up against the heading and the controls are squeezed to a
 * sliver. Hold the reserves to the pixels the overlays need instead, within what
 * the camera can still fit.
 *
 * Only ever raises a reserve, and never past `MAX_OVERLAY_RESERVE` together: a
 * container with room to spare keeps the framing it has today, and a container
 * without it is left to the placement fallbacks rather than a camera that cannot
 * fit the model at all.
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

	if (leavesPixels(padding.top, topPx) && leavesPixels(padding.bottom, bottomPx)) {
		return padding
	}

	const needSum = topPx + bottomPx
	let top: number
	let bottom: number

	if (needSum >= containerHeight) {
		// Both overlays cannot fit: give the controls what they need, since the
		// model is the part that can be looked at again.
		if (bottomPx <= 0 || bottomPx >= containerHeight) return padding

		top = padding.top
		bottom = Math.max(padding.bottom, (bottomPx * (1 + padding.top)) / (containerHeight - bottomPx))
	} else {
		// Solving both reserves at equality gives the box that leaves exactly the
		// requested room: the model gives up the pixels the overlays need, no more.
		const reserve = needSum / (containerHeight - needSum)
		top = (reserve * topPx) / needSum
		bottom = (reserve * bottomPx) / needSum

		// A reserve that is already larger than its share lifts the box, which takes
		// room back from the other side, so give that side its pixels back.
		if (padding.top > top) {
			top = padding.top
			bottom = Math.max(bottom, (bottomPx * (1 + top)) / (containerHeight - bottomPx))
		} else if (padding.bottom > bottom) {
			bottom = padding.bottom
			top = Math.max(top, (topPx * (1 + bottom)) / (containerHeight - topPx))
		}
	}

	return { ...padding, ...boundReserves(padding, top, bottom) }
}

/**
 * Keeps the added reserve within what the camera can fit, taking it off the part
 * that was added for the overlays rather than off the presets.
 */
function boundReserves(padding: SkinPreviewFitPadding, top: number, bottom: number) {
	const added = Math.max(top - padding.top, 0) + Math.max(bottom - padding.bottom, 0)
	const overflow = top + bottom - MAX_OVERLAY_RESERVE

	if (added <= 0 || overflow <= 0) return { top, bottom }

	const keep = Math.max(0, 1 - overflow / added)

	return {
		top: padding.top + Math.max(top - padding.top, 0) * keep,
		bottom: padding.bottom + Math.max(bottom - padding.bottom, 0) * keep,
	}
}

/**
 * Whether the fitted subtitle position still leaves the buttons their own height
 * above the bottom inset. When it does not, the caller anchors them to the
 * bottom instead of letting the container clip them.
 */
export function keepsControlsVisible(
	fittedTopPx: number,
	containerHeight: number,
	{ subtitleRowPx }: SkinPreviewOverlayNeeds,
): boolean {
	return containerHeight - fittedTopPx - SUBTITLE_BOTTOM_INSET_PX >= subtitleRowPx
}

/** Keeps the nametag inside the preview instead of over the heading above it. */
export function clampNametagTop(topPx: number): number {
	return Math.max(topPx, NAMETAG_MIN_TOP_PX)
}
