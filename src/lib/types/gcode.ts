export enum GCodeCommandType {
	RapidMove = 'G0',
	LinearMove = 'G1',
	AbsoluteMode = 'G90',
	MetricUnits = 'G21',
	SpindleOn = 'M3',
	SpindleOff = 'M5',
	ProgramEnd = 'M2',
	Comment = ';'
}

export interface GCodeCommand {
	type: GCodeCommandType;
	x?: number;
	y?: number;
	z?: number;
	f?: number;
	s?: number;
	comment?: string;
}
