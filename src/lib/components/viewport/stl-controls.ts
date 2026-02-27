import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export interface StlTransform {
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

export interface StlViewer {
	mesh: THREE.Mesh;
	transformControls: TransformControls;
	setMode: (mode: TransformMode) => void;
	getTransformedVertices: () => Float32Array;
	getTransform: () => StlTransform;
	setTransform: (t: Partial<StlTransform>) => void;
	autoFlatten: () => void;
	onTransformChange: (cb: (t: StlTransform) => void) => void;
	dispose: () => void;
}

/**
 * Add an STL mesh to the scene with transform controls.
 */
export function addStlMesh(
	geometry: THREE.BufferGeometry,
	scene: THREE.Scene,
	camera: THREE.PerspectiveCamera,
	renderer: THREE.WebGLRenderer,
	orbitControls: OrbitControls
): StlViewer {
	// Create mesh
	const material = new THREE.MeshPhongMaterial({
		color: 0x6688cc,
		specular: 0x222222,
		shininess: 30,
		flatShading: true
	});
	const mesh = new THREE.Mesh(geometry, material);
	mesh.name = 'stl-model';

	// Center geometry
	geometry.computeBoundingBox();
	const bbox = geometry.boundingBox!;
	const center = new THREE.Vector3();
	bbox.getCenter(center);
	geometry.translate(-center.x, -center.y, -center.z);

	// Position on bed surface
	geometry.computeBoundingBox();
	const newBbox = geometry.boundingBox!;
	mesh.position.set(
		-newBbox.min.x,
		-newBbox.min.y,
		-newBbox.min.z
	);

	scene.add(mesh);

	// Transform controls
	const transformControls = new TransformControls(camera, renderer.domElement);
	transformControls.attach(mesh);
	transformControls.setMode('translate');
	scene.add(transformControls.getHelper());

	// Disable orbit controls while transforming
	transformControls.addEventListener('dragging-changed', (event) => {
		orbitControls.enabled = !event.value;
	});

	let changeCallbacks: Array<(t: StlTransform) => void> = [];

	function notifyTransformChange() {
		const t = getTransform();
		for (const cb of changeCallbacks) cb(t);
	}

	function onTransformChange(cb: (t: StlTransform) => void) {
		changeCallbacks.push(cb);
	}

	// Fire callback when user drags transform controls
	transformControls.addEventListener('objectChange', () => {
		notifyTransformChange();
	});

	function setMode(mode: TransformMode) {
		transformControls.setMode(mode);
	}

	function getTransform(): StlTransform {
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

	function setTransform(t: Partial<StlTransform>) {
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

	/**
	 * Auto-flatten: move the model so its bottom sits at Y=0 (Three.js Y-up = CNC Z=0 work surface).
	 */
	function autoFlatten() {
		mesh.updateMatrixWorld(true);
		const bbox = new THREE.Box3().setFromObject(mesh);
		// Shift model up so bottom is at Y=0
		mesh.position.y -= bbox.min.y;
		notifyTransformChange();
	}

	/**
	 * Extract vertices with the mesh's current world transform applied.
	 * This is what the G-code generator should use - it reflects
	 * exactly what the user sees in the viewport.
	 */
	function getTransformedVertices(): Float32Array {
		mesh.updateMatrixWorld(true);
		const worldMatrix = mesh.matrixWorld;

		const posAttr = geometry.getAttribute('position');
		const index = geometry.index;
		const tempVec = new THREE.Vector3();

		// Three.js is Y-up, CNC is Z-up. Swap Y↔Z:
		// CNC X = Three X, CNC Y = Three Z, CNC Z = Three Y
		if (index) {
			const triangleCount = index.count / 3;
			const result = new Float32Array(triangleCount * 9);
			for (let i = 0; i < triangleCount; i++) {
				for (let v = 0; v < 3; v++) {
					const idx = index.getX(i * 3 + v);
					tempVec.set(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
					tempVec.applyMatrix4(worldMatrix);
					result[i * 9 + v * 3 + 0] = tempVec.x; // CNC X = Three X
					result[i * 9 + v * 3 + 1] = tempVec.z; // CNC Y = Three Z
					result[i * 9 + v * 3 + 2] = tempVec.y; // CNC Z = Three Y
				}
			}
			return result;
		}

		// Non-indexed geometry
		const count = posAttr.count;
		const result = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) {
			tempVec.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
			tempVec.applyMatrix4(worldMatrix);
			result[i * 3 + 0] = tempVec.x; // CNC X = Three X
			result[i * 3 + 1] = tempVec.z; // CNC Y = Three Z
			result[i * 3 + 2] = tempVec.y; // CNC Z = Three Y
		}
		return result;
	}

	function dispose() {
		transformControls.detach();
		scene.remove(transformControls.getHelper());
		transformControls.dispose();
		scene.remove(mesh);
		geometry.dispose();
		material.dispose();
	}

	return { mesh, transformControls, setMode, getTransformedVertices, getTransform, setTransform, autoFlatten, onTransformChange, dispose };
}

/**
 * Remove existing STL model from scene.
 */
export function removeStlModel(scene: THREE.Scene): void {
	const existing = scene.getObjectByName('stl-model');
	if (existing) {
		scene.remove(existing);
		if (existing instanceof THREE.Mesh) {
			existing.geometry.dispose();
			(existing.material as THREE.Material).dispose();
		}
	}
}
