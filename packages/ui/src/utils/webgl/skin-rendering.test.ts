import assert from 'node:assert/strict'
import test from 'node:test'

import * as THREE from 'three'

import {
	applyTexture,
	applyThreeDSkinLayers,
	configureSkinMaterial,
} from './skin-rendering.ts'

test('skin material preserves every non-zero 8-bit alpha value', () => {
	const material = new THREE.MeshStandardMaterial({
		alphaTest: 0.1,
		transparent: false,
	})

	configureSkinMaterial(material, true)

	assert.equal(material.transparent, true)
	assert.equal(material.depthWrite, true)
	assert.equal(material.alphaToCoverage, false)
	assert.ok(material.alphaTest > 0)
	assert.ok(material.alphaTest < 1 / 255)
})

test('binary skin material keeps the opaque depth-writing path', () => {
	const material = new THREE.MeshStandardMaterial()

	configureSkinMaterial(material, false)

	assert.equal(material.transparent, false)
	assert.equal(material.depthWrite, true)
	assert.equal(material.alphaToCoverage, true)
	assert.equal(material.alphaTest, 0.1)
})

test('skin layers render after inner parts while retaining surface depth', () => {
	const model = new THREE.Group()
	const inner = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
	inner.name = 'Body_2'
	const outer = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
	outer.name = 'Body_Layer'
	model.add(inner, outer)

	applyTexture(model, new THREE.Texture())

	assert.equal(inner.renderOrder, 0)
	assert.equal(outer.renderOrder, 1)
	assert.equal((inner.material as THREE.MeshStandardMaterial).depthWrite, true)
	assert.equal((outer.material as THREE.MeshStandardMaterial).depthWrite, true)
})

test('changing textures rebuilds voxel geometry from the original skin layer', () => {
	let pixels = new Uint8ClampedArray(64 * 64 * 4)
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
	Object.defineProperty(globalThis, 'document', {
		configurable: true,
		value: {
			createElement: () => ({
				getContext: () => ({
					drawImage: () => undefined,
					getImageData: () => ({ data: pixels }),
				}),
			}),
		},
	})

	try {
		const layer = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
		layer.name = 'Hat_Layer'
		const model = new THREE.Group()
		model.add(layer)
		const texture = new THREE.Texture()
		texture.image = {} as CanvasImageSource

		pixels[(8 * 64 + 40) * 4 + 3] = 255
		applyThreeDSkinLayers(model, texture)
		const firstVertexCount = layer.geometry.getAttribute('position').count

		pixels = new Uint8ClampedArray(64 * 64 * 4)
		pixels[(8 * 64 + 40) * 4 + 3] = 255
		pixels[(8 * 64 + 42) * 4 + 3] = 255
		applyThreeDSkinLayers(model, texture)
		const secondVertexCount = layer.geometry.getAttribute('position').count

		assert.ok(secondVertexCount > firstVertexCount)
	} finally {
		if (originalDocument) {
			Object.defineProperty(globalThis, 'document', originalDocument)
		} else {
			Reflect.deleteProperty(globalThis, 'document')
		}
	}
})
