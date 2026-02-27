import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SceneContext {
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	renderer: THREE.WebGLRenderer;
	controls: OrbitControls;
	dispose: () => void;
}

export function createScene(canvas: HTMLCanvasElement): SceneContext {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x1a1a2e);

	// Camera
	const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
	camera.position.set(100, 150, 200);
	camera.lookAt(0, 0, 0);

	// Renderer
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);

	// Lights
	const ambientLight = new THREE.AmbientLight(0x404040, 2);
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
	directionalLight.position.set(100, 200, 150);
	scene.add(directionalLight);

	const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
	fillLight.position.set(-100, 50, -100);
	scene.add(fillLight);

	// Grid
	const gridHelper = new THREE.GridHelper(400, 40, 0x333366, 0x222244);
	scene.add(gridHelper);

	// Axes
	const axesHelper = new THREE.AxesHelper(50);
	scene.add(axesHelper);

	// Controls
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = true;
	controls.dampingFactor = 0.1;
	controls.target.set(0, 0, 0);

	// Animation loop
	let animationId: number;
	function animate() {
		animationId = requestAnimationFrame(animate);
		controls.update();
		renderer.render(scene, camera);
	}
	animate();

	// Resize handler
	const resizeObserver = new ResizeObserver(() => {
		const parent = canvas.parentElement;
		if (!parent) return;
		const w = parent.clientWidth;
		const h = parent.clientHeight;
		renderer.setSize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	});

	const parent = canvas.parentElement;
	if (parent) {
		resizeObserver.observe(parent);
		const w = parent.clientWidth;
		const h = parent.clientHeight;
		renderer.setSize(w, h);
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}

	function dispose() {
		cancelAnimationFrame(animationId);
		resizeObserver.disconnect();
		controls.dispose();
		renderer.dispose();
		scene.clear();
	}

	return { scene, camera, renderer, controls, dispose };
}
