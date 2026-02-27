import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Polyline } from '$lib/types/geometry.js';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface ObjectTransform {
	positionX: number;
	positionY: number;
	positionZ: number;
	rotationX: number;
	rotationY: number;
	rotationZ: number;
	scaleX: number;
	scaleY: number;
	scaleZ: number;
}

// Keep backward compat alias
export type StlTransform = ObjectTransform;

export interface ObjectViewer {
	objectId: string;
	mesh: THREE.Object3D;
	getTransform: () => ObjectTransform;
	setTransform: (t: Partial<ObjectTransform>) => void;
	autoFlatten: () => void;
	onTransformChange: (cb: (t: ObjectTransform) => void) => void;
	offTransformChange: (cb: (t: ObjectTransform) => void) => void;
	dispose: () => void;
}

export interface StlViewer extends ObjectViewer {
	mesh: THREE.Mesh;
	getTransformedVertices: () => Float32Array;
}

export interface SvgViewer extends ObjectViewer {
	getTransformedPolylines: () => Polyline[];
}

export interface TransformControlsManager {
	attachTo: (viewer: ObjectViewer) => void;
	detach: () => void;
	setMode: (mode: TransformMode) => void;
	getMode: () => TransformMode;
	dispose: () => void;
}

/**
 * Create a shared TransformControls manager. Only one instance exists;
 * it can be attached to any ObjectViewer's mesh.
 */
export function createTransformControlsManager(
	scene: THREE.Scene,
	camera: THREE.PerspectiveCamera,
	renderer: THREE.WebGLRenderer,
	orbitControls: OrbitControls
): TransformControlsManager {
	const tc = new TransformControls(camera, renderer.domElement);
	tc.setMode('translate');
	scene.add(tc.getHelper());

	let currentViewer: ObjectViewer | null = null;
	let mode: TransformMode = 'translate';

	tc.addEventListener('dragging-changed', (event) => {
		orbitControls.enabled = !event.value;
	});

	tc.addEventListener('objectChange', () => {
		if (currentViewer) {
			// Notify the viewer's own listeners
			const t = currentViewer.getTransform();
			(currentViewer as any)._notifyChange?.(t);
		}
	});

	function attachTo(viewer: ObjectViewer) {
		currentViewer = viewer;
		tc.attach(viewer.mesh as THREE.Object3D);
		tc.setMode(mode);
	}

	function detach() {
		currentViewer = null;
		tc.detach();
	}

	function setMode(m: TransformMode) {
		mode = m;
		tc.setMode(m);
	}

	function getMode() {
		return mode;
	}

	function dispose() {
		tc.detach();
		scene.remove(tc.getHelper());
		tc.dispose();
	}

	return { attachTo, detach, setMode, getMode, dispose };
}

/**
 * Add an STL mesh to the scene. Returns an StlViewer (implements ObjectViewer).
 */
export function addStlMesh(
	geometry: THREE.BufferGeometry,
	objectId: string,
	scene: THREE.Scene
): StlViewer {
	const material = new THREE.MeshPhongMaterial({
		color: 0x6688cc,
		specular: 0x222222,
		shininess: 30,
		flatShading: true
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = 'object-' + objectId;

	// Center geometry
	geometry.computeBoundingBox();
	const bbox = geometry.boundingBox!;
	const center = new THREE.Vector3();
	bbox.getCenter(center);
	geometry.translate(-center.x, -center.y, -center.z);

	// Position on bed surface
	geometry.computeBoundingBox();
	const newBbox = geometry.boundingBox!;
	mesh.position.set(-newBbox.min.x, -newBbox.min.y, -newBbox.min.z);

	scene.add(mesh);

	let changeCallbacks: Array<(t: ObjectTransform) => void> = [];

	function notifyTransformChange() {
		const t = getTransform();
		for (const cb of changeCallbacks) cb(t);
	}

	function onTransformChange(cb: (t: ObjectTransform) => void) {
		changeCallbacks.push(cb);
	}

	function offTransformChange(cb: (t: ObjectTransform) => void) {
		changeCallbacks = changeCallbacks.filter((c) => c !== cb);
	}

	function getTransform(): ObjectTransform {
		return {
			positionX: mesh.position.x,
			positionY: mesh.position.y,
			positionZ: mesh.position.z,
			rotationX: THREE.MathUtils.radToDeg(mesh.rotation.x),
			rotationY: THREE.MathUtils.radToDeg(mesh.rotation.y),
			rotationZ: THREE.MathUtils.radToDeg(mesh.rotation.z),
			scaleX: mesh.scale.x,
			scaleY: mesh.scale.y,
			scaleZ: mesh.scale.z
		};
	}

	function setTransform(t: Partial<ObjectTransform>) {
		if (t.positionX !== undefined) mesh.position.x = t.positionX;
		if (t.positionY !== undefined) mesh.position.y = t.positionY;
		if (t.positionZ !== undefined) mesh.position.z = t.positionZ;
		if (t.rotationX !== undefined) mesh.rotation.x = THREE.MathUtils.degToRad(t.rotationX);
		if (t.rotationY !== undefined) mesh.rotation.y = THREE.MathUtils.degToRad(t.rotationY);
		if (t.rotationZ !== undefined) mesh.rotation.z = THREE.MathUtils.degToRad(t.rotationZ);
		if (t.scaleX !== undefined) mesh.scale.x = t.scaleX;
		if (t.scaleY !== undefined) mesh.scale.y = t.scaleY;
		if (t.scaleZ !== undefined) mesh.scale.z = t.scaleZ;
		notifyTransformChange();
	}

	function autoFlatten() {
		mesh.updateMatrixWorld(true);
		const box = new THREE.Box3().setFromObject(mesh);
		mesh.position.y -= box.min.y;
		notifyTransformChange();
	}

	function getTransformedVertices(): Float32Array {
		mesh.updateMatrixWorld(true);
		const worldMatrix = mesh.matrixWorld;
		const posAttr = geometry.getAttribute('position');
		const index = geometry.index;
		const tempVec = new THREE.Vector3();

		if (index) {
			const triangleCount = index.count / 3;
			const result = new Float32Array(triangleCount * 9);
			for (let i = 0; i < triangleCount; i++) {
				for (let v = 0; v < 3; v++) {
					const idx = index.getX(i * 3 + v);
					tempVec.set(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
					tempVec.applyMatrix4(worldMatrix);
					result[i * 9 + v * 3 + 0] = tempVec.x;
					result[i * 9 + v * 3 + 1] = tempVec.z;
					result[i * 9 + v * 3 + 2] = tempVec.y;
				}
			}
			return result;
		}

		const count = posAttr.count;
		const result = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			tempVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
			tempVec.applyMatrix4(worldMatrix);
			result[i * 3 + 0] = tempVec.x;
			result[i * 3 + 1] = tempVec.z;
			result[i * 3 + 2] = tempVec.y;
		}
		return result;
	}

	function dispose() {
		scene.remove(mesh);
		geometry.dispose();
		material.dispose();
	}

	const viewer: StlViewer = {
		objectId,
		mesh,
		getTransform,
		setTransform,
		autoFlatten,
		onTransformChange,
		offTransformChange,
		getTransformedVertices,
		dispose
	};

	// Expose for TransformControlsManager - set after viewer is created
	(viewer as any)._notifyChange = notifyTransformChange;

	return viewer;
}
