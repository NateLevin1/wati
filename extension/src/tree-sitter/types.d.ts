

export interface Idents {
  funcs: {
    ident: string | number;
    params: string[];
    result: string | undefined;
    localTypes?: string[];
    localIdentMap?: Map<any, any>;
    labels?: string[];
    labelIdentMap?: Map<string, number> & Map<number, string>;
  }[];
  globals: {
    ident: string | number,
    type: string,
  }[];
  tables: {
    ident: string | number,
    limits?: string,
    type?: string,
  }[];
}