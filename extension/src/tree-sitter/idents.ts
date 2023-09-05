import Parser = require('web-tree-sitter');
import type { QueryCapture, QueryMatch } from 'web-tree-sitter';
import { getLanguage } from '.';

/**
 * Used for getting the right autocomplete suggestions when typing an identifier
 * 
 * @param node - The node tree to check in
 * @param coords - The mouse coordinates
 */
export function getIdentContext(node: Parser.SyntaxNode, { column, row }: Parser.Point) {
  let nodeAtPos: Parser.SyntaxNode = node.descendantForPosition({ column, row });
  while ((nodeAtPos.type === "identifier" || nodeAtPos.type === 'index') && nodeAtPos.parent) {
    nodeAtPos = nodeAtPos.parent;
  }

  if (nodeAtPos.type === 'type') return 'type';
  if (nodeAtPos.type === 'call_indirect') return 'table';

  const { text } = nodeAtPos;
  if (text.startsWith('local.')) return 'local';
  if (text.startsWith('global.')) return 'global';
  if (text.startsWith('call')) return 'func';
  if (text.startsWith('br')) return 'branch';

  return null;
}

const queries = [
  [
    'func_import',
    `(module_field_import 
      (name) (name)
      (import_desc
        (import_desc_func_type
          (identifier) @ident
          (func_type (func_type_params (func_type_params_many
            (value_type)* @param_type
          )))?
          (func_type (func_type_results
            (value_type)* @result_type
          ))?
        )? 
      )
    )`
  ],
  [
    'type',
    `(module_field_type
      (identifier) @ident 
      (type_field 
        (func_type (func_type_params) @params)*
        (func_type (func_type_results) @result)*
      )
    )`
  ],
  [
    'func',
    `(module_field_func identifier: (identifier)? @ident
      (func_type_params
        [
          (func_type_params_one
            (identifier) @params_ident  
            (value_type) @params_type
          )
          (func_type_params_many
            (value_type)+ @params_type
          )
        ]  
      )*
      (func_type_results (value_type) @result_type)? 
      (func_locals
        [
          (func_locals_one
            (identifier) @locals_ident  
            (value_type) @locals_type
          )
          (func_locals_many
            (value_type)+ @locals_type
          )
        ] 
      )*
      (instr_list)? @instructions
    )`
  ],
  [
    'global',
    `(module_field_global identifier: (identifier)? @ident (global_type) @global_type)`
  ],
  [
    'table',
    `(module_field_table identifier: (identifier) @ident 
      (table_fields_type (table_type
        (limits) @limits
        (ref_type) @ref_type
      )) 
    )`
  ],
] as const;

const identQueryString = queries.map(([_, pattern]) => pattern).join('\n');
const queryList = queries.map(([name]) => name);

export function getAllIdentsFromTree(tree: Parser.Tree) {
  const funcQuery = getLanguage().query(identQueryString);
  const queryMatches = funcQuery.matches(tree.rootNode);
  return getAllIdentsFromMatch(queryMatches);
}

function getFuncIdents(captures: QueryCapture[], funcIndex = 0) {
  const params = [];
  const localTypes = [];
  const localIdentMap = new Map();

  for (const { name, node } of captures) {
    if (name === "params_type" || name === "locals_type") {
      const type = node.text;
      localTypes.push(type);
      if (name === "params_type") params.push(type);
    } else if (name === "params_ident" || name === "locals_ident") {
      const ident = node.text,
        index = localTypes.length;
      localIdentMap.set(ident, index);
      localIdentMap.set(index, ident);
    }
  }

  const ident =
    captures[0]?.name === "ident" ? captures[0].node.text : funcIndex;

  const result = captures.find(({ name }) => name === "result_type")?.node.text;

  const labels = [];
  const labelIdentMap: Map<string, number> & Map<number, string> = new Map();
  {
    const instructionText = captures.find(({ name }) => name === "instructions")
      ?.node.text;
    if (instructionText) {
      const labelRegexMatch = instructionText.matchAll(
        /\(\s*(block|loop)\s+(\$\S+)?/g
      );
      for (const { 1: type, 2: ident } of labelRegexMatch) {
        if (ident) {
          labelIdentMap.set(ident, labels.length);
          labelIdentMap.set(labels.length, ident);
        }
        labels.push(type);
      }
    }
  }

  return {
    ident,
    params,
    localTypes,
    localIdentMap,
    result,
    labels,
    labelIdentMap,
  };
}

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

function getAllIdentsFromMatch(queryMatches: QueryMatch[]) {
  // TODO: support type declaration
  const funcs: Idents['funcs'] = [];
  const globals: Idents['globals'] = [];
  const tables: Idents['tables'] = [];

  try {
    for (const { captures, pattern } of queryMatches) {
      const queryName = queryList[pattern];

      if (queryName === "func") {
        funcs.push(getFuncIdents(captures, funcs.length));
        continue;
      }

      if (queryName === "global") {
        const ident =
          captures.find(({ name }) => name === "ident")?.node.text ??
          globals.length;
        const type = captures.find(({ name }) => name === "global_type")?.node
          .text ?? 'UNKNOWN';

        globals.push({ ident, type });
        continue;
      }

      if (queryName === "func_import") {
        const params = [];
        let result;
        for (const { name, node } of captures) {
          if (name === "param_type") {
            params.push(node.text);
          } else if (name === "result_type") {
            result = node.text;
          }
        }

        const ident =
          captures.find(({ name }) => name === "ident")?.node.text ??
          funcs.length;
        funcs.push({ ident, params, result });
        continue;
      }

      if (queryName === "table") {
        const ident = captures.find(({ name }) => name === "ident")?.node.text ?? tables.length;
        const limits = captures.find(({ name }) => name === "limits")?.node
          .text;
        const type = captures.find(({ name }) => name === "ref_type")?.node
          .text;

        tables.push({ ident, limits, type });
        continue;
      }
    }
  } catch (e) {
    // A parsing error should not halt our language server
    console.error(e);
  }

  return { funcs, globals, tables } as Idents;
}
