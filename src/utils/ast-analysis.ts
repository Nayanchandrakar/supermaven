import * as TreeSitter from 'web-tree-sitter';

const DECLARATION_NODE_TYPES = new Set([
    'function_declaration',
    'function_definition',
    'function_item',
    'class_declaration',
    'class_definition',
    'lexical_declaration',
    'variable_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'struct_item',
    'trait_item',
    'type_item',
    'type_declaration',
    'decorated_definition',
    'export_statement',
    'assignment',
]);

const DIRECT_NAME_TYPES = new Set([
    'function_declaration',
    'function_definition',
    'function_item',
    'class_declaration',
    'class_definition',
    'interface_declaration',
    'type_alias_declaration',
    'enum_declaration',
    'struct_item',
    'trait_item',
    'type_item',
]);

const DECLARATOR_TYPES = new Set([
    'lexical_declaration',
    'variable_declaration',
]);

function containsPosition(node: TreeSitter.Node, row: number, column: number): boolean {
    const start = node.startPosition;
    const end = node.endPosition;

    if (row < start.row || row > end.row) {
        return false;
    }
    if (row === start.row && column < start.column) {
        return false;
    }
    if (row === end.row && column >= end.column) {
        return false;
    }
    return true;
}

function nodeSpan(node: TreeSitter.Node): number {
    return node.endIndex - node.startIndex;
}

export function findStatementEnd(
    tree: TreeSitter.Tree,
    cursor: { row: number, column: number },
): { endLine: number; endChar: number } | null {
    const root = tree.rootNode;
    const cursorRow = cursor.row;
    const cursorColumn = cursor.column;

    let bestNode: TreeSitter.Node | null = null;

    function findSmallest(node: TreeSitter.Node): void {
        if (containsPosition(node, cursorRow, cursorColumn)) {
            if (!bestNode || nodeSpan(node) <= nodeSpan(bestNode)) {
                bestNode = node;
            }

            for (let i = 0; i < node.namedChildCount; i++) {
                const child = node.namedChild(i)
                if (child) {
                    findSmallest(child);
                }
            }
        }
    }

    findSmallest(root);

    if (!bestNode) return null;

    let current: TreeSitter.Node = bestNode;

    while (current.parent && current.parent !== root) {
        const parentType = current.parent.type;
        current = current.parent;

        if (parentType === 'expression_statement' ||
            parentType === 'return_statement' ||
            parentType === 'variable_declaration' ||
            parentType === 'lexical_declaration' ||
            parentType === 'assignment_statement' ||
            parentType === 'if_statement' ||
            parentType === 'for_statement' ||
            parentType === 'while_statement') {
            break;
        }
    }

    return {
        endLine: current.endPosition.row,
        endChar: current.endPosition.column,
    }
}


export function extractDeclaredNames(tree: TreeSitter.Tree): Set<string> {
    const names = new Set<string>();
    const root = tree.rootNode;

    for (let i = 0; i < root.namedChildCount; i++) {
        const child = root.namedChild(i);
        if (child) {
            extractNameFromNode(child, names);
        }
    }

    return names;
}

function extractNameFromNode(node: TreeSitter.Node, names: Set<string>): void {
    const type = node.type;

    if (!DECLARATION_NODE_TYPES.has(type)) {
        return;
    }

    // Direct name field (function_declaration, class_declaration, etc.)
    if (DIRECT_NAME_TYPES.has(type)) {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
            names.add(nameNode.text);
        }
        return;
    }

    // Declarator-based (lexical_declaration, variable_declaration)
    if (DECLARATOR_TYPES.has(type)) {
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child && (child.type === 'variable_declarator' || child.type === 'init_declarator')) {
                const nameNode = child.childForFieldName('name');
                if (nameNode) {
                    names.add(nameNode.text);
                }
            }
        }
        return;
    }

    // Go type_declaration: spec child has name
    if (type === 'type_declaration') {
        for (let i = 0; i < node.namedChildCount; i++) {
            const spec = node.namedChild(i);
            if (spec && spec.type === 'type_spec') {
                const nameNode = spec.childForFieldName('name');
                if (nameNode) {
                    names.add(nameNode.text);
                }
            }
        }
        return;
    }

    // export_statement: recurse into child declaration
    if (type === 'export_statement') {
        const declaration = node.childForFieldName('declaration');
        if (declaration) {
            extractNameFromNode(declaration, names);
        } else {
            // Some exports wrap the declaration as a named child without a field name
            for (let i = 0; i < node.namedChildCount; i++) {
                const child = node.namedChild(i);
                if (child && DECLARATION_NODE_TYPES.has(child.type)) {
                    extractNameFromNode(child, names);
                }
            }
        }
        return;
    }

    // decorated_definition (Python): recurse into child definition
    if (type === 'decorated_definition') {
        const definition = node.childForFieldName('definition');
        if (definition) {
            extractNameFromNode(definition, names);
        } else {
            for (let i = 0; i < node.namedChildCount; i++) {
                const child = node.namedChild(i);
                if (child && DECLARATION_NODE_TYPES.has(child.type)) {
                    extractNameFromNode(child, names);
                }
            }
        }
        return;
    }

    // assignment (Python top-level): left side identifier
    if (type === 'assignment') {
        const left = node.childForFieldName('left');
        if (left && left.type === 'identifier') {
            names.add(left.text);
        }
        return;
    }
}

