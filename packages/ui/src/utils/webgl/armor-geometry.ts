import * as THREE from 'three'

export type ArmorGeometryLayer = 'outer' | 'leggings'
export type ArmorBodyPart = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg'

const MODEL_PIXEL_SIZE = 1 / 16
const OUTER_ARMOR_DILATION = MODEL_PIXEL_SIZE
const LEGGINGS_ARMOR_DILATION = MODEL_PIXEL_SIZE / 2
const LEG_DEFORMATION_REDUCTION = MODEL_PIXEL_SIZE / 10
const CLASSIC_ARM_WIDTH = 4 * MODEL_PIXEL_SIZE

function isArm(bodyPart: ArmorBodyPart): boolean {
	return bodyPart === 'rightArm' || bodyPart === 'leftArm'
}

function isLeg(bodyPart: ArmorBodyPart): boolean {
	return bodyPart === 'rightLeg' || bodyPart === 'leftLeg'
}

function remapArmorUv(uv: THREE.BufferAttribute, bodyPart: ArmorBodyPart): void {
	for (let index = 0; index < uv.count; index++) {
		let u = uv.getX(index)
		let v = uv.getY(index)

		// Vanilla armor textures are 64x32. The left arm and leg reuse the right
		// limb regions, while player skins store their left-limb pixels in the
		// lower half of a 64x64 texture.
		if (bodyPart === 'leftArm') {
			u += 8 / 64
			v -= 32 / 64
		} else if (bodyPart === 'leftLeg') {
			u -= 16 / 64
			v -= 32 / 64
		}

		uv.setXY(index, u, v * 2)
	}
	uv.needsUpdate = true
}

export function createArmorGeometry(
	source: THREE.BufferGeometry,
	layer: ArmorGeometryLayer,
	bodyPart: ArmorBodyPart,
): THREE.BufferGeometry {
	const geometry = source.clone()
	const position = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
	if (!position) throw new Error('Armor source geometry has no position attribute')

	const bounds = new THREE.Box3().setFromBufferAttribute(position)
	const center = bounds.getCenter(new THREE.Vector3())
	const sourceSize = bounds.getSize(new THREE.Vector3())
	let dilation = layer === 'leggings' ? LEGGINGS_ARMOR_DILATION : OUTER_ARMOR_DILATION
	if (isLeg(bodyPart)) dilation -= LEG_DEFORMATION_REDUCTION
	const baseSize = sourceSize.clone()
	if (isArm(bodyPart)) baseSize.x = Math.max(baseSize.x, CLASSIC_ARM_WIDTH)

	const targetSize = baseSize.addScalar(dilation * 2)
	const scale = new THREE.Vector3(
		targetSize.x / sourceSize.x,
		targetSize.y / sourceSize.y,
		targetSize.z / sourceSize.z,
	)
	const vertex = new THREE.Vector3()
	for (let index = 0; index < position.count; index++) {
		vertex.fromBufferAttribute(position, index).sub(center).multiply(scale).add(center)
		position.setXYZ(index, vertex.x, vertex.y, vertex.z)
	}
	position.needsUpdate = true

	const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined
	if (uv) remapArmorUv(uv, bodyPart)

	geometry.computeBoundingBox()
	geometry.computeBoundingSphere()
	return geometry
}
