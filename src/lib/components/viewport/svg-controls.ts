import * as THREE from 'three';
import type { Polyline, Point2D } from '$lib/types/geometry.js';
import type { ObjectTransform, SvgViewer } from './stl-controls.js';

/**
 * Add SVG polylines to the scene as THREE.Line objects on the Y=0 plane.
 * CNC coordinate mapping: SVG X -> Three X, SVG Y -> Three Z (negated for screen-Y-down).
 * Lines sit on the bed surface (Three Y = 0).
 */
export function addSvgMesh(
	polylines: Polyline[],
	objectId: string,
	scene: THREE.Scene
): SvgViewer {
	const group = new THREE.Group();
	group.name = 'object-' + objectId;

	const material = new THREE.LineBasicMaterial({ color: 0x00ff88 });

	for (const pl of polylines) {
		if (pl.points.length < 2) continue;
		const pts = pl.points.map((p) => new THREE.Vector3(p.x, 0, -p.y));
		if (pl.closed && pts.length > 1) {
			pts.push(pts[0].clone());
		}
		const geom = new THREE.BufferGeometry().setFromPoints(pts);
		const line = new THREE.Line(geom, material);
		group.add(line);
	}

	// Transparent bounding plane for raycasting
	const box = new THREE.Box3().setFromObject(group);
	if (!box.isEmpty()) {
		const size = new THREE.Vector3();
		box.getSize(size);
		const center = new THREE.Vector3();
		box.getCenter(center);

		const planeGeo = new THREE.PlaneGeometry(
			Math.max(size.x, 1),
			Math.max(size.z, 1)
		);
		const planeMat = new THREE.MeshBasicMaterial({
			visible: false,
			side: THREE.DoubleSide
		});
		const planeMesh = new THREE.Mesh(planeGeo, planeMat);
		planeMesh.rotation.x = -Math.PI / 2;
		planeMesh.position.set(center.x, 0, center.z);
		planeMesh.name = 'hitplane-' + objectId;
		group.add(planeMesh);
	}

	scene.add(group);

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
			positionX: group.position.x,
			positionY: group.position.y,
			positionZ: group.position.z,
			rotationX: THREE.MathUtils.radToDeg(group.rotation.x),
			rotationY: THREE.MathUtils.radToDeg(group.rotation.y),
			rotationZ: THREE.MathUtils.radToDeg(group.rotation.z),
			scaleX: group.scale.x,
			scaleY: group.scale.y,
			scaleZ: group.scale.z
		};
	}

	function setTransform(t: Partial<ObjectTransform>) {
		if (t.positionX !== undefined) group.position.x = t.positionX;
		if (t.positionY !== undefined) group.position.y = t.positionY;
		if (t.positionZ !== undefined) group.position.z = t.positionZ;
		if (t.rotationX !== undefined) group.rotation.x = THREE.MathUtils.degToRad(t.rotationX);
		if (t.rotationY !== undefined) group.rotation.y = THREE.MathUtils.degToRad(t.rotationY);
		if (t.rotationZ !== undefined) group.rotation.z = THREE.MathUtils.degToRad(t.rotationZ);
		if (t.scaleX !== undefined) group.scale.x = t.scaleX;
		if (t.scaleY !== undefined) group.scale.y = t.scaleY;
		if (t.scaleZ !== undefined) group.scale.z = t.scaleZ;
		notifyTransformChange();
	}

	function autoFlatten() {
		// SVG is already on Y=0 plane, just reset Y position
		group.position.y = 0;
		notifyTransformChange();
	}

	/**
	 * Return polylines transformed by the group's world matrix.
	 * Maps back from Three coords (X, 0, Z) to CNC 2D (X, -Z).
	 */
	function getTransformedPolylines(): Polyline[] {
		group.updateMatrixWorld(true);
		const worldMatrix = group.matrixWorld;
		const tempVec = new THREE.Vector3();

		return polylines.map((pl) => {
			const transformed: Point2D[] = pl.points.map((p) => {
				tempVec.set(p.x, 0, -p.y);
				tempVec.applyMatrix4(worldMatrix);
				return { x: tempVec.x, y: -tempVec.z };
			});
			return { points: transformed, closed: pl.closed };
		});
	}

	function dispose() {
		group.traverse((child) => {
			if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
				child.geometry.dispose();
				if (child.material instanceof THREE.Material) {
					child.material.dispose();
				}
			}
		});
		scene.remove(group);
	}

	const viewer: SvgViewer = {
		objectId,
		mesh: group,
		getTransform,
		setTransform,
		autoFlatten,
		onTransformChange,
		offTransformChange,
		getTransformedPolylines,
		dispose
	};

	(viewer as any)._notifyChange = notifyTransformChange;

	return viewer;
}
