import ts from "typescript"
import path from "node:path"

// Resolve variable-backed class lists with the TypeScript symbol table, including
// imports/re-exports. Only follow expressions used as classes, not arbitrary prose.
export function referencedClassLists(files) {
  const configPath =
    files.length && ts.findConfigFile(path.dirname(files[0]), ts.sys.fileExists)
  const options = configPath
    ? ts.parseJsonConfigFileContent(
        ts.readConfigFile(configPath, ts.sys.readFile).config,
        ts.sys,
        path.dirname(configPath)
      ).options
    : {}
  const program = ts.createProgram(files, {
    ...options,
    noResolve: true,
    noLib: true,
    types: [],
  })
  const checker = program.getTypeChecker()
  const lists = []
  const visited = new Map()
  function collect(node, referenced = false) {
    if (!node) return
    const state = referenced ? 2 : 1
    if ((visited.get(node) ?? 0) & state) return
    visited.set(node, (visited.get(node) ?? 0) | state)
    if (ts.isIdentifier(node)) {
      let symbol = checker.getSymbolAtLocation(node)
      if (symbol?.flags & ts.SymbolFlags.Alias)
        symbol = checker.getAliasedSymbol(symbol)
      for (const declaration of symbol?.declarations ?? []) {
        if (ts.isVariableDeclaration(declaration))
          collect(declaration.initializer, true)
      }
    } else if (ts.isStringLiteralLike(node)) {
      if (referenced)
        lists.push({ value: node.text, file: node.getSourceFile().fileName })
    } else if (ts.isTemplateExpression(node)) {
      if (referenced)
        lists.push({
          value: node.head.text,
          file: node.getSourceFile().fileName,
        })
      for (const span of node.templateSpans) {
        collect(span.expression, referenced)
        if (referenced)
          lists.push({
            value: span.literal.text,
            file: node.getSourceFile().fileName,
          })
      }
    } else if (ts.isConditionalExpression(node)) {
      collect(node.whenTrue, referenced)
      collect(node.whenFalse, referenced)
    } else if (ts.isBinaryExpression(node)) {
      collect(node.left, referenced)
      collect(node.right, referenced)
    } else if (ts.isCallExpression(node)) {
      for (const argument of node.arguments) collect(argument, referenced)
    } else if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        if (ts.isPropertyAssignment(property)) {
          // Single-word option values (size: "bare") aren't class lists.
          if (
            ts.isStringLiteralLike(property.initializer) &&
            !/\s/.test(property.initializer.text)
          )
            continue
          collect(property.initializer, referenced)
        }
      }
    } else if (ts.isArrayLiteralExpression(node)) {
      for (const element of node.elements) collect(element, referenced)
    } else if (
      ts.isJsxExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      collect(node.expression, referenced)
    }
  }
  for (const file of files) {
    const source = program.getSourceFile(file)
    if (!source) continue
    const visit = (node) => {
      if (ts.isJsxAttribute(node) && node.name.getText(source) === "className")
        collect(node.initializer)
      if (
        ts.isCallExpression(node) &&
        /^(cn|cva|[A-Za-z]+Variants)$/.test(node.expression.getText(source))
      )
        collect(node)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return lists
}
