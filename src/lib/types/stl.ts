export interface ZMapConfig {
	/** Resolution: distance between grid points in mm */
	resolution: number;
	/** Grid width in points */
	gridWidth: number;
	/** Grid height in points */
	gridHeight: number;
	/** Physical width in mm */
	physicalWidth: number;
	/** Physical height in mm */
	physicalHeight: number;
}

export interface HeightMap {
	config: ZMapConfig;
	/** 1D array of Z values, row-major order [y * gridWidth + x] */
	data: Float32Array;
}

export interface Triangle {
	v0: { x: number; y: number; z: number };
	v1: { x: number; y: number; z: number };
	v2: { x: number; y: number; z: number };
}
