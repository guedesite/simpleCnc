import * as THREE from 'three';

/**
 * Create a stock/bed visualization.
 */
export function createStockMesh(width: number, height: number, thickness: number): THREE.Group {
	const group = new THREE.Group();
	group.name = 'stock';

	// Stock body
	const geometry = new THREE.BoxGeometry(width, thickness, height);
	const material = new THREE.MeshPhongMaterial({
		color: 0x8B7355,
		transparent: true,
		opacity: 0.4,
		side: THREE.DoubleSide
	});
	const mesh = new THREE.Mesh(geometry, material);
	// Stock extends from Y=0 (bed) to Y=thickness (raw material top)
	mesh.position.set(width / 2, thickness / 2, height / 2);
	group.add(mesh);

	// Wireframe
	const wireGeom = new THREE.EdgesGeometry(geometry);
	const wireMat = new THREE.LineBasicMaterial({ color: 0xaa8866 });
	const wireframe = new THREE.LineSegments(wireGeom, wireMat);
	wireframe.position.copy(mesh.position);
	group.add(wireframe);

	// Stock top surface grid
	const gridSize = Math.max(width, height);
	const divisions = Math.ceil(gridSize / 10);
	const surfaceGrid = new THREE.GridHelper(gridSize, divisions, 0x554433, 0x443322);
	surfaceGrid.position.set(width / 2, thickness + 0.01, height / 2);
	group.add(surfaceGrid);

	return group;
}

/**
 * Create a visual origin marker (crosshair + ring) at world (0, 0, 0).
 */
export function createOriginMarker(): THREE.Group {
	const group = new THREE.Group();
	group.name = 'origin-marker';

	const armLen = 8;
	const yPos = 0.02; // Slightly above bed to avoid z-fighting

	// Crosshair arms
	const crossMat = new THREE.LineBasicMaterial({ color: 0xff3333 });
	const xPts = [new THREE.Vector3(-armLen, yPos, 0), new THREE.Vector3(armLen, yPos, 0)];
	const zPts = [new THREE.Vector3(0, yPos, -armLen), new THREE.Vector3(0, yPos, armLen)];
	const xGeom = new THREE.BufferGeometry().setFromPoints(xPts);
	const zGeom = new THREE.BufferGeometry().setFromPoints(zPts);
	group.add(new THREE.Line(xGeom, crossMat));
	group.add(new THREE.Line(zGeom, crossMat));

	// Ring
	const ringGeom = new THREE.RingGeometry(3, 3.5, 32);
	const ringMat = new THREE.MeshBasicMaterial({ color: 0x00aaff, side: THREE.DoubleSide });
	const ring = new THREE.Mesh(ringGeom, ringMat);
	ring.rotation.x = -Math.PI / 2;
	ring.position.y = yPos;
	group.add(ring);

	return group;
}

/**
 * Update stock dimensions.
 */
export function updateStockMesh(group: THREE.Group, width: number, height: number, thickness: number): void {
	// Remove old children
	while (group.children.length > 0) {
		const child = group.children[0];
		group.remove(child);
		if (child instanceof THREE.Mesh) {
			child.geometry.dispose();
			(child.material as THREE.Material).dispose();
		}
	}

	// Recreate
	const newGroup = createStockMesh(width, height, thickness);
	for (const child of [...newGroup.children]) {
		newGroup.remove(child);
		group.add(child);
	}
}
