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

export interface AnimatedToolpath {
	group: THREE.Group;
	animate: () => void;
	cancel: () => void;
}

/**
 * Create an animated toolpath that progressively reveals over ~2 seconds.
 */
export function createAnimatedToolpath(data: Float32Array): AnimatedToolpath {
	const group = new THREE.Group();
	group.name = 'toolpath';

	// Build a single LineSegments with per-vertex colors
	const positions: number[] = [];
	const colors: number[] = [];

	let prevX = 0, prevY = 0, prevZ = 0;

	const colorMap: Record<number, [number, number, number]> = {
		0: [1, 0.27, 0.27],   // rapid: red
		1: [0.27, 1, 0.27],   // cut: green
		2: [1, 0.67, 0],      // plunge: orange
		3: [0.27, 0.27, 1]    // retract: blue
	};

	for (let i = 0; i < data.length; i += 4) {
		const x = data[i];
		const y = data[i + 2]; // Swap Y/Z for Three.js
		const z = data[i + 1];
		const moveType = data[i + 3];

		if (i > 0) {
			const c = colorMap[moveType] ?? [1, 1, 1];
			positions.push(prevX, prevY, prevZ, x, y, z);
			colors.push(c[0], c[1], c[2], c[0], c[1], c[2]);
		}

		prevX = x;
		prevY = y;
		prevZ = z;
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

	const totalVertices = positions.length / 3;
	geometry.setDrawRange(0, 0);

	const material = new THREE.LineBasicMaterial({ vertexColors: true, linewidth: 1 });
	const lines = new THREE.LineSegments(geometry, material);
	group.add(lines);

	let animId = 0;
	let cancelled = false;

	function animate() {
		const durationMs = 2000;
		const startTime = performance.now();

		function frame() {
			if (cancelled) return;
			const elapsed = performance.now() - startTime;
			const t = Math.min(elapsed / durationMs, 1);
			const count = Math.floor(t * totalVertices);
			geometry.setDrawRange(0, count);
			if (t < 1) {
				animId = requestAnimationFrame(frame);
			}
		}

		animId = requestAnimationFrame(frame);
	}

	function cancel() {
		cancelled = true;
		if (animId) cancelAnimationFrame(animId);
	}

	return { group, animate, cancel };
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
