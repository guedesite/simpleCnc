import * as THREE from 'three';

const COLORS = {
	rapid: 0xff4444,    // Red for rapid moves
	cut: 0x44ff44,      // Green for cutting
	plunge: 0xffaa00,   // Orange for plunge
	retract: 0x4444ff   // Blue for retract
};

/**
 * Create toolpath visualization from Float32Array data.
 * Format: [x, y, z, moveType, ...]
 * moveType: 0=rapid, 1=cut, 2=plunge, 3=retract
 */
export function createToolpathLines(data: Float32Array): THREE.Group {
	const group = new THREE.Group();
	group.name = 'toolpath';

	// Sort points by move type for batching
	const rapidPoints: number[] = [];
	const cutPoints: number[] = [];
	const plungePoints: number[] = [];
	const retractPoints: number[] = [];

	let prevX = 0, prevY = 0, prevZ = 0;

	for (let i = 0; i < data.length; i += 4) {
		const x = data[i];
		const y = data[i + 2]; // Swap Y/Z for Three.js coord system
		const z = data[i + 1];
		const moveType = data[i + 3];

		if (i > 0) {
			const target = moveType === 0 ? rapidPoints
				: moveType === 1 ? cutPoints
				: moveType === 2 ? plungePoints
				: retractPoints;

			target.push(prevX, prevY, prevZ, x, y, z);
		}

		prevX = x;
		prevY = y;
		prevZ = z;
	}

	// Create line geometries
	addLineSegments(group, rapidPoints, COLORS.rapid, true);
	addLineSegments(group, cutPoints, COLORS.cut, false);
	addLineSegments(group, plungePoints, COLORS.plunge, false);
	addLineSegments(group, retractPoints, COLORS.retract, true);

	return group;
}

function addLineSegments(group: THREE.Group, points: number[], color: number, dashed: boolean): void {
	if (points.length === 0) return;

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

	let material: THREE.Material;
	if (dashed) {
		material = new THREE.LineDashedMaterial({
			color,
			dashSize: 2,
			gapSize: 1,
			linewidth: 1
		});
	} else {
		material = new THREE.LineBasicMaterial({ color, linewidth: 1 });
	}

	const lines = new THREE.LineSegments(geometry, material);
	if (dashed) {
		lines.computeLineDistances();
	}
	group.add(lines);
}

/**
 * Remove existing toolpath from scene.
 */
export function removeToolpath(scene: THREE.Scene): void {
	const existing = scene.getObjectByName('toolpath');
	if (existing) {
		scene.remove(existing);
		existing.traverse((obj) => {
			if (obj instanceof THREE.LineSegments) {
				obj.geometry.dispose();
				(obj.material as THREE.Material).dispose();
			}
		});
	}
}
