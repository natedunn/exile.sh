// Fails when a class name written in src/ does not compile to a Tailwind
// utility. Guards against semantic class names returning after the migration.
// Class lists are read from className="…", className={…} string parts, and
// every string literal inside cn(…) / cva(…) / *Variants(…) calls.
// Usage: node scripts/check-classnames.mjs [--list]
import { compile } from "@tailwindcss/node"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx?$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p)
  }
}
walk(path.join(root, "src"))

// Pull every string literal (static parts of templates included) out of a
// balanced-paren region or a JSX attribute value.
const literals = (code) => {
  const out = []
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g
  for (const m of code.matchAll(re)) {
    // Quoted object keys ("icon-lg": …) are variant names, not classes.
    if (/^\s*:/.test(code.slice(m.index + m[0].length))) continue
    const s = m[1] ?? m[2] ?? m[3]
    // A single-word object value (variant: "default") is a variant name.
    if (!/\s/.test(s) && /:\s*$/.test(code.slice(0, m.index))) continue
    if (m[3] !== undefined) out.push(...s.split(/\$\{[^}]*\}/))
    else out.push(s)
  }
  return out
}
const balanced = (code, openIdx) => {
  let depth = 0
  for (let i = openIdx; i < code.length; i++) {
    if (code[i] === "(") depth++
    else if (code[i] === ")" && --depth === 0) return code.slice(openIdx + 1, i)
  }
  return code.slice(openIdx + 1)
}
const classLists = new Map() // token -> first file
const seen = (tokens, file) => {
  for (const t of tokens.split(/\s+/))
    if (t && !classLists.has(t)) classLists.set(t, file)
}
for (const file of files) {
  const code = fs.readFileSync(file, "utf8")
  for (const m of code.matchAll(/className=(?:"([^"]*)"|\{)/g)) {
    if (m[1] !== undefined) seen(m[1], file)
    else {
      let depth = 0,
        i = m.index + m[0].length - 1
      for (; i < code.length; i++) {
        if (code[i] === "{") depth++
        else if (code[i] === "}" && --depth === 0) break
      }
      for (const s of literals(code.slice(m.index + m[0].length, i)))
        seen(s, file)
    }
  }
  for (const m of code.matchAll(/\b(?:cn|cva|[A-Za-z]+Variants)\(/g)) {
    for (const s of literals(balanced(code, m.index + m[0].length - 1)))
      seen(s, file)
  }
}

const css = fs
  .readFileSync(path.join(root, "src/styles.css"), "utf8")
  .replace(/@import "@fontsource[^"]*";\n/g, "")
const compiler = await compile(css, {
  base: path.join(root, "src"),
  onDependency() {},
})
const tokens = [...classLists.keys()]
const out = compiler.build(tokens)
const escape = (t) => t.replace(/[^a-zA-Z0-9_-]/g, (c) => "\\" + c)
const emitted = (t) =>
  new RegExp(
    "\\." + escape(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\w-])"
  ).test(out)
const allow = fs.existsSync("scripts/classnames.allow")
  ? new Set(
      fs
        .readFileSync("scripts/classnames.allow", "utf8")
        .split("\n")
        .filter(Boolean)
    )
  : new Set()
// cva variant keys and non-class strings inside those calls are skipped when
// they contain no class-like character run; a bare word is still checked.
const markers = /^(group|peer)(\/[\w-]+)?$/
const failing = tokens
  .filter((t) => !markers.test(t))
  .filter(
    (t) =>
      /^[-a-zA-Z0-9_:\[\]\/().%*&>+~,!@#=\\'"$?^'`{}]+$/.test(t) &&
      !/^[A-Z]/.test(t)
  )
  .filter((t) => !allow.has(t) && !emitted(t))
  .sort()
if (process.argv.includes("--list"))
  for (const t of failing)
    console.log(`${t}  (${path.relative(root, classLists.get(t))})`)
console.log(
  `${tokens.length} class tokens, ${failing.length} not recognised by Tailwind`
)
if (failing.length) process.exit(1)
