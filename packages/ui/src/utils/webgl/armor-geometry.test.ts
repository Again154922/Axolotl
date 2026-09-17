import assert from 'node:assert/strict'
import test from 'node:test'

import * as THREE from 'three'

import { createArmorGeometry } from './armor-geometry.ts'

function geometrySize(geometry: THREE.BufferGeometry): THREE.Vector3 {
	geometry.computeBoundingBox()
	return geometry.boundingBox!.getSize(new THREE.Vector3())
}

test('outer armor expands every side by one model pixel', () => {
	const source = new THREE.BoxGeometry(8 / 16, 12 / 16, 4 / 16)
	const size = geometrySize(createArmorGeometry(source, 'outer', 'body'))

	assert.ok(Math.abs(size.x - 10 / 16) < 1e-7)
	assert.ok(Math.abs(size.y - 14 / 16) < 1e-7)
	assert.ok(Math.abs(size.z - 6 / 16) < 1e-7)
})

test('leggings legs use the inner-model dilation with the vanilla leg reduction', () => {
	const source = new THREE.BoxGeometry(4 / 16, 12 / 16, 4 / 16)
	const size = geometrySize(createArmorGeometry(source, 'leggings', 'rightLeg'))

	assert.ok(Math.abs(size.x - 4.8 / 16) < 1e-7)
	assert.ok(Math.abs(size.y - 12.8 / 16) < 1e-7)
	assert.ok(Math.abs(size.z - 4.8 / 16) < 1e-7)
})

test('slim player arms still use the classic four-pixel armor base width', () => {
	const source = new THREE.BoxGeometry(3 / 16, 12 / 16, 4 / 16)
	const size = geometrySize(createArmorGeometry(source, 'outer', 'rightArm'))

	assert.ok(Math.abs(size.x - 6 / 16) < 1e-7)
	assert.ok(Math.abs(size.y - 14 / 16) < 1e-7)
	assert.ok(Math.abs(size.z - 6 / 16) < 1e-7)
})

test('remaps player UV height from 64x64 skins to 64x32 armor textures', () => {
	const source = new THREE.BoxGeometry(8 / 16, 8 / 16, 8 / 16)
	const sourceUv = source.getAttribute('uv') as THREE.BufferAttribute
	const expected = Array.from({ length: sourceUv.count }, (_, index) => sourceUv.getY(index) * 2)
	const armorUv = createArmorGeometry(source, 'outer', 'head').getAttribute(
		'uv',
	) as THREE.BufferAttribute

	for (let index = 0; index < armorUv.count; index++) {
		assert.ok(Math.abs(armorUv.getY(index) - expected[index]) < 1e-7)
	}
})

test('left arm reuses the right arm region of the 64x32 armor texture', () => {
	const source = new THREE.BoxGeometry(4 / 16, 12 / 16, 4 / 16)
	const sourceUv = source.getAttribute('uv') as THREE.BufferAttribute
	const expected = Array.from({ length: sourceUv.count }, (_, index) => [
		sourceUv.getX(index),
		sourceUv.getY(index) * 2,
	])
	for (let index = 0; index < sourceUv.count; index++) {
		sourceUv.setXY(index, sourceUv.getX(index) - 8 / 64, sourceUv.getY(index) + 32 / 64)
	}

	const armorUv = createArmorGeometry(source, 'outer', 'leftArm').getAttribute(
		'uv',
	) as THREE.BufferAttribute

	for (let index = 0; index < armorUv.count; index++) {
		assert.ok(Math.abs(armorUv.getX(index) - expected[index][0]) < 1e-7)
		assert.ok(Math.abs(armorUv.getY(index) - expected[index][1]) < 1e-7)
	}
})

test('left leg reuses the right leg region of the 64x32 armor texture', () => {
	const source = new THREE.BoxGeometry(4 / 16, 12 / 16, 4 / 16)
	const sourceUv = source.getAttribute('uv') as THREE.BufferAttribute
	const expected = Array.from({ length: sourceUv.count }, (_, index) => [
		sourceUv.getX(index),
		sourceUv.getY(index) * 2,
	])
	for (let index = 0; index < sourceUv.count; index++) {
		sourceUv.setXY(index, sourceUv.getX(index) + 16 / 64, sourceUv.getY(index) + 32 / 64)
	}

	const armorUv = createArmorGeometry(source, 'outer', 'leftLeg').getAttribute(
		'uv',
	) as THREE.BufferAttribute

	for (let index = 0; index < armorUv.count; index++) {
		assert.ok(Math.abs(armorUv.getX(index) - expected[index][0]) < 1e-7)
		assert.ok(Math.abs(armorUv.getY(index) - expected[index][1]) < 1e-7)
	}
})
