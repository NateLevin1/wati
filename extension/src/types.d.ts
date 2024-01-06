export interface IFileVariables {
	[key: string]: VariablesInFile;
}

export interface VariablesInFile {
	globals: VariableByName;
	functions: { [key: string]: FunctionDescriptor };
}

export interface FunctionDescriptor {
	// includes the $
	name: string;
	parameters: Variable[];
	returnType: VariableType;
	locals: VariableByName;
	blocks: BlockByName;
}

export interface VariableByName {
	// includes the $
	[key: string]: Variable;
}

export interface Variable {
	type: VariableType;
	isMutable?: boolean;
	name: string | void; // includes the $, is undefined if no name (just indexed)
	initialValue?: string;
}

export type VariableType = "i32" | "i64" | "f32" | "f64" | "unknown" | null;

export interface Block {
	type: string;
	label: string; // only blocks with labels are stored
	lineNum: number;
}

export interface BlockByName {
	// includes the $
	[key: string]: Block;
}
