// Runs the code examples on this site against the published SDKs, so a page
// that documents a signature the SDK no longer has fails here instead of in a
// reader's terminal.
//
// Four modes, assigned per page in config.json:
//
//   run-node / run-python  A page whose blocks form a complete program when
//                          concatenated in document order. The quickstart is
//                          written that way and connects to `memory://`, so it
//                          needs no credentials: the program is executed.
//   cli                    The CLI page. Its fence titles name real input files
//                          (`schema.yaml`, `seed.ndjson`), so those are written
//                          to disk, then every `infino …` line in the named
//                          section is run through a shell, quoting and all.
//   typecheck-program      A complete program that cannot run here (the hosted
//                          quickstart needs an API key; the table guide calls
//                          `gc`, which needs durable storage). Compiled, not run.
//   typecheck-fragments    A guide whose blocks assume a table defined elsewhere
//                          on the page. Imports are hoisted, each block gets its
//                          own scope on top of a prelude, and the result is
//                          compiled — enough to catch a removed argument or a
//                          renamed type without pretending the fragment runs.
//   typecheck-rust         The same idea for Rust, compiled with `cargo check` in a
//                          scratch crate that depends on the published engine.
//                          Every fragment uses `?`, so they are assembled inside
//                          one `fn main() -> Result<…>`; `use` lines are hoisted
//                          and deduplicated, since Rust rejects a repeated import.
//   sql-functions          The SQL pages' blocks carry deliberate placeholders (an
//                          elided query vector, an illustrative join table), so
//                          they cannot be executed as written. What is checkable
//                          is that every search function they name still exists
//                          with that shape, so each one is exercised against a
//                          fixture table with real arguments. A function the docs
//                          introduce with no smoke query fails, rather than
//                          silently going unchecked.
//   typecheck-python       The same idea for Python, checked with pyright against
//                          the installed package's stubs. Python has no block
//                          scope and rebinding a name is legal, so the blocks are
//                          concatenated onto a prelude as they are.
//
// The SDKs install at their latest published versions, because that is what the
// install instructions on these pages resolve to. A new SDK release that breaks
// an example therefore fails this check, which is the point of running it on a
// schedule as well as on pull requests.

import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS_ROOT = resolve(HERE, "..", "..");
const CONFIG = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
const PYTHON_SETTING = process.env.DOCS_EXAMPLES_PYTHON ?? CONFIG.python;
// The examples run in a scratch directory, so a relative interpreter path has to
// be resolved here rather than left for the child process to look up.
const PYTHON = PYTHON_SETTING.includes("/") ? resolve(HERE, PYTHON_SETTING) : PYTHON_SETTING;
const TIMEOUT_MS = 300_000;

// The workflow splits the lanes across two jobs: the Rust ones compile the
// engine and belong on their own, cached runner.
const only = (process.env.DOCS_EXAMPLES_ONLY_MODES ?? "").split(",").filter(Boolean);
const skip = (process.env.DOCS_EXAMPLES_SKIP_MODES ?? "").split(",").filter(Boolean);
const wanted = (mode) =>
  (only.length === 0 || only.includes(mode)) && !skip.includes(mode);


const read = (page) => readFileSync(join(DOCS_ROOT, page), "utf8");

/** Every fenced block on a page, in document order. */
function blocks(pageText) {
  const found = [];
  const fence = /^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm;
  let m;
  while ((m = fence.exec(pageText)) !== null) {
    found.push({ lang: m[1], meta: m[2].trim(), body: m[3] });
  }
  return found;
}

/** The slice of a page under `## <heading>`, up to the next `## `. */
function section(pageText, heading) {
  const start = pageText.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`section "${heading}" not found`);
  const rest = pageText.slice(start + 3);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

const langBlocks = (page, lang) => {
  const found = blocks(read(page)).filter((b) => b.lang === lang);
  if (found.length === 0) throw new Error(`no ${lang} blocks in ${page}`);
  return found;
};

/** Split a block at its top-level declarations, one statement per entry. */
function topLevelStatements(code) {
  const out = [];
  for (const line of code.split("\n")) {
    if (/^(const|let|var)\s/.test(line) || out.length === 0) out.push(line);
    else out[out.length - 1] += `\n${line}`;
  }
  return out.filter((s) => s.trim());
}

/** Separate a block's import lines from the rest of it. */
function splitImports(body) {
  const imports = [];
  const rest = [];
  for (const line of body.split("\n")) {
    (/^\s*import\s/.test(line) ? imports : rest).push(line);
  }
  return { imports, rest: rest.join("\n") };
}

/** A scratch directory whose files can resolve the harness's dependencies. */
function workdir(label) {
  const dir = mkdtempSync(join(tmpdir(), `docs-examples-${label.replace(/\W+/g, "-")}-`));
  try {
    symlinkSync(join(HERE, "node_modules"), join(dir, "node_modules"));
  } catch {
    /* only the node lanes need it */
  }
  return dir;
}

const failures = [];
const ok = (what) => console.log(`  ok    ${what}`);
function fail(what, err) {
  console.log(`  FAIL  ${what}`);
  for (const stream of [err.stdout, err.stderr]) {
    const text = String(stream ?? "").trimEnd();
    if (text) console.log(text.replace(/^/gm, "        "));
  }
  if (!err.stdout && !err.stderr) console.log(`        ${err.message}`);
  failures.push(what);
}

/** Concatenate a page's blocks for one language and execute the result. */
function runProgram(page, lang, command, extension) {
  const parts = langBlocks(page, lang).map((b) => b.body);
  const dir = workdir(`${page}-${lang}`);
  const file = join(dir, `example.${extension}`);
  writeFileSync(file, dedupeImports(parts.join("\n")));
  const what = `run ${page} (${lang}, ${parts.length} blocks)`;
  try {
    execFileSync(command, [file], { cwd: dir, stdio: "pipe", timeout: TIMEOUT_MS });
    ok(what);
  } catch (err) {
    fail(what, err);
  }
}

/** Pages repeat an import per snippet so each is copy-pasteable; keep the first. */
function dedupeImports(source) {
  const seen = new Set();
  return source
    .split("\n")
    .filter((line) => {
      if (!/^\s*import\s/.test(line)) return true;
      const key = line.trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join("\n");
}

/** Write the CLI page's named input files, then run its documented commands. */
function runCli(page, heading) {
  const text = section(read(page), heading);
  const dir = workdir(page);
  for (const b of blocks(text)) {
    // A fence title that looks like a filename is an input file, not a snippet.
    if (/^[\w.-]+\.(yaml|yml|json|ndjson|csv)$/.test(b.meta)) {
      writeFileSync(join(dir, b.meta), b.body);
    }
  }
  const commands = blocks(text)
    .filter((b) => b.lang === "bash")
    .flatMap((b) => b.body.split("\n"))
    .map((line) => line.trim())
    .filter((line) => line.startsWith("infino "));
  if (commands.length === 0) throw new Error(`no infino commands in ${page} § ${heading}`);
  for (const line of commands) {
    const what = `cli ${line}`;
    try {
      // Through a shell, so the documented quoting is what gets exercised.
      execFileSync("bash", ["-c", line], { cwd: dir, stdio: "pipe", timeout: TIMEOUT_MS });
      ok(what);
    } catch (err) {
      fail(what, err);
    }
  }
}

/** Compile a page's TypeScript: as one program, or as prelude + scoped blocks. */
function typecheckNode(page, { fragments, alternatives }) {
  const found = langBlocks(page, "typescript");
  let source;
  if (fragments) {
    const imports = [];
    const scoped = found.map((b, i) => {
      const split = splitImports(b.body);
      // The prelude owns the SDK import; a fragment's own copy of it would
      // redeclare those names here. Third-party imports are kept.
      imports.push(...split.imports.filter((l) => !l.includes("@infino-ai/infino")));
      // A menu block declares the same name once per alternative it presents
      // (three ways to call `connect`, say), which cannot compile as one unit.
      // Scope each top-level statement instead, so every alternative is still
      // checked. Only for pages flagged as menus: elsewhere a later statement
      // legitimately uses an earlier one's binding.
      const scopes = alternatives ? topLevelStatements(split.rest) : [split.rest];
      return scopes.map((code) => `// ${page} block ${i + 1}\n{\n${code}\n}`).join("\n");
    });
    source = [
      ...new Set(imports.map((l) => l.trim())),
      readFileSync(join(HERE, CONFIG.nodePrelude), "utf8"),
      ...scoped,
    ].join("\n");
  } else {
    source = dedupeImports(found.map((b) => b.body).join("\n"));
  }
  const dir = workdir(`${page}-tsc`);
  const file = join(dir, "example.ts");
  writeFileSync(file, `${source}\n`);
  writeFileSync(join(dir, "shims.d.ts"), readFileSync(join(HERE, CONFIG.nodeShims), "utf8"));
  const what = `typecheck ${page} (${found.length} blocks, ${fragments ? "fragments" : "program"})`;
  try {
    execFileSync(
      join(HERE, "node_modules", ".bin", "tsc"),
      [
        "--noEmit",
        "--target", "es2022",
        "--module", "es2022",
        "--moduleResolution", "bundler",
        "--skipLibCheck",
        "shims.d.ts",
        "example.ts",
      ],
      { cwd: dir, stdio: "pipe", timeout: TIMEOUT_MS },
    );
    ok(what);
  } catch (err) {
    fail(what, err);
  }
}

/** Type-check a page's Python against the installed package's stubs. */
function typecheckPython(page, { fragments }) {
  const found = langBlocks(page, "python");
  const dir = workdir(`${page}-pyright`);
  const prelude = fragments ? `${readFileSync(join(HERE, CONFIG.pythonPrelude), "utf8")}\n` : "";
  writeFileSync(join(dir, "example.py"), `${prelude}${found.map((b) => b.body).join("\n")}\n`);
  // Stubs stand in for third-party packages an example imports to illustrate a
  // workflow; a missing `infino` would still be reported, which is the point.
  writeFileSync(
    join(dir, "pyrightconfig.json"),
    JSON.stringify(
      {
        include: ["example.py"],
        stubPath: join(HERE, CONFIG.pythonStubs),
        typeCheckingMode: "basic",
        reportMissingModuleSource: "none",
        // Stacking page code on a prelude rebinds names by construction (a page
        // that defines its own `embed` shadows the prelude's), and a page's
        // later block routinely rebinds an earlier one. Neither is drift.
        reportRedeclaration: "none",
      },
      null,
      2,
    ),
  );
  const what = `typecheck ${page} (${found.length} blocks, python ${fragments ? "fragments" : "program"})`;
  try {
    execFileSync(
      join(HERE, "node_modules", ".bin", "pyright"),
      ["--pythonpath", PYTHON, "--outputjson", "example.py"],
      { cwd: dir, stdio: "pipe", timeout: TIMEOUT_MS },
    );
    ok(what);
  } catch (err) {
    // pyright's json output is far more readable than its exit status.
    let summary = String(err.stdout ?? "");
    try {
      const report = JSON.parse(summary);
      summary = report.generalDiagnostics
        .filter((d) => d.severity === "error")
        .map((d) => `example.py(${d.range.start.line + 1}): ${d.message.split("\n")[0]}`)
        .join("\n");
    } catch {
      /* fall back to the raw output */
    }
    fail(what, { stdout: summary, stderr: "" });
  }
}

/** Compile a page's Rust in a scratch crate against the published engine. */
function typecheckRust(page, { fragments }) {
  const found = langBlocks(page, "rust");
  const uses = [];
  const bodies = found.map((b, i) => {
    // A fragment keeps its own `use` lines, which is legal inside a block and
    // avoids two blocks importing the same name by different paths (`use
    // infino::BoolMode` and `use infino::{VectorFilter, BoolMode}`) colliding at
    // file scope. A program's blocks share one scope, so its imports are
    // hoisted and deduplicated instead.
    if (!fragments) {
      const rest = [];
      for (const line of b.body.split("\n")) {
        if (/^\s*use\s/.test(line)) uses.push(line.trim());
        else rest.push(line);
      }
      return `    // ${page} block ${i + 1}\n${rest.join("\n")}`;
    }
    return `    // ${page} block ${i + 1}\n    {\n${b.body}\n    }`;
  });
  const prelude = fragments ? readFileSync(join(HERE, CONFIG.rustPrelude), "utf8") : "";
  const src = [
    "#![allow(unused_variables, unused_imports, unused_mut, dead_code, unreachable_code)]",
    ...new Set(uses),
    "",
    "fn main() -> Result<(), Box<dyn std::error::Error>> {",
    prelude,
    ...bodies,
    "    Ok(())",
    "}",
  ].join("\n");

  // The entrypoint is generated per page and not tracked, so on a fresh clone
  // its directory does not exist yet.
  const dir = resolve(HERE, CONFIG.rustProject, "src");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "main.rs"), `${src}\n`);
  const what = `typecheck ${page} (${found.length} blocks, rust ${fragments ? "fragments" : "program"})`;
  try {
    execFileSync("cargo", ["check", "--quiet"], {
      cwd: resolve(HERE, CONFIG.rustProject),
      stdio: "pipe",
      timeout: 1_800_000,
    });
    ok(what);
  } catch (err) {
    fail(what, err);
  }
}

/** Every `FROM fn(` name used in a page's SQL blocks. */
function sqlFunctionsUsed(page) {
  const names = new Set();
  for (const b of blocks(read(page)).filter((b) => b.lang === "sql")) {
    for (const m of b.body.matchAll(/\b(?:FROM|JOIN)\s+([a-z_][a-z0-9_]*)\s*\(/gi)) {
      names.add(m[1].toLowerCase());
    }
  }
  return [...names];
}

/** A local table the SQL smoke queries can run against. */
function sqlFixture() {
  const dir = workdir("sql-fixture");
  writeFileSync(
    join(dir, "schema.yaml"),
    [
      // large_utf8 because an FTS column has to be, and doc_id is indexed below.
      "- { name: doc_id, type: large_utf8 }",
      "- { name: source, type: utf8 }",
      "- { name: body, type: large_utf8 }",
      '- { name: embedding, type: "fixed_size_list<float32,16>" }',
      "",
    ].join("\n"),
  );
  const vector = Array(16).fill(0).map((_, i) => (i === 0 ? 1 : 0));
  writeFileSync(
    join(dir, "seed.ndjson"),
    `${JSON.stringify({ doc_id: "42", source: "help-center", body: "object storage and search", embedding: vector })}\n`,
  );
  execFileSync(
    "bash",
    [
      "-c",
      // doc_id is full-text indexed too: token_match and exact_match read the
        // FTS index, so the column they are given has to be one.
        "infino create-table docs --uri file://./data --schema schema.yaml " +
        "--fts body --fts doc_id --vector embedding:16:cosine --file seed.ndjson",
    ],
    { cwd: dir, stdio: "pipe", timeout: TIMEOUT_MS },
  );
  return dir;
}

function sqlChecks(pages) {
  const used = [...new Set(pages.flatMap(sqlFunctionsUsed))].sort();
  let dir;
  try {
    dir = sqlFixture();
  } catch (err) {
    fail("sql fixture", err);
    return;
  }
  for (const name of used) {
    const query = CONFIG.sqlFunctions[name];
    if (query === undefined) {
      fail(`sql ${name}`, {
        message:
          `the docs use ${name}() but config.json has no smoke query for it. ` +
          "Add one, or map it to null if it cannot be exercised here.",
      });
      continue;
    }
    if (query === null) {
      console.log(`  skip  sql ${name} (documented, not exercised here)`);
      continue;
    }
    try {
      execFileSync("bash", ["-c", `infino query ${JSON.stringify(query)} --uri file://./data`], {
        cwd: dir,
        stdio: "pipe",
        timeout: TIMEOUT_MS,
      });
      ok(`sql ${name}()`);
    } catch (err) {
      fail(`sql ${name}()`, err);
    }
  }
}

/** What the run covered, and what it did not. */
function coverage() {
  const modeLang = {
    "run-node": "typescript",
    "run-python": "python",
    "typecheck-program": "typescript",
    "typecheck-fragments": "typescript",
    "typecheck-python": "python",
    "typecheck-python-program": "python",
    "sql-functions": "sql",
    "typecheck-rust": "rust",
    "typecheck-rust-program": "rust",
    cli: "bash",
  };
  const checkedPairs = new Set(
    CONFIG.checks.filter((c) => wanted(c.mode)).map((c) => `${c.page}:${modeLang[c.mode]}`),
  );
  const gaps = [];
  let checked = 0;
  let total = 0;
  for (const page of pagesWithCode()) {
    const counts = {};
    for (const b of blocks(read(page))) counts[b.lang] = (counts[b.lang] ?? 0) + 1;
    for (const [lang, n] of Object.entries(counts)) {
      if (!["typescript", "python", "rust", "sql"].includes(lang)) continue;
      total += n;
      if (checkedPairs.has(`${page}:${lang}`)) checked += n;
      else gaps.push(`${page} (${lang}, ${n})`);
    }
  }
  // Say when a run covered only some lanes, so its number is not mistaken for
  // the whole picture: the workflow splits Rust into its own job, and 64/91 plus
  // 27/91 is full coverage across the two.
  const filter =
    only.length > 0
      ? ` (this run: ${only.join(", ")} only)`
      : skip.length > 0
        ? ` (this run: all lanes except ${skip.join(", ")})`
        : "";
  console.log(`\nCoverage: ${checked}/${total} code blocks checked${filter}.`);
  if (gaps.length > 0) {
    console.log("Not checked by any lane:");
    for (const g of gaps.sort()) console.log(`  ${g}`);
  }
}

function pagesWithCode() {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "snippets" || name.startsWith(".")) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".mdx")) out.push(relative(DOCS_ROOT, full));
    }
  };
  walk(DOCS_ROOT);
  return out.sort();
}

const sqlPages = CONFIG.checks
  .filter((c) => c.mode === "sql-functions" && wanted(c.mode))
  .map((c) => c.page);
if (sqlPages.length > 0) {
  console.log(`\n${sqlPages.join(", ")}  [sql-functions]`);
  sqlChecks(sqlPages);
}

for (const entry of CONFIG.checks) {
  if (entry.mode === "sql-functions") continue;
  if (!wanted(entry.mode)) continue;
  console.log(`\n${entry.page}  [${entry.mode}]`);
  try {
    switch (entry.mode) {
      case "run-node":
        runProgram(entry.page, "typescript", process.execPath, "mjs");
        break;
      case "run-python":
        runProgram(entry.page, "python", PYTHON, "py");
        break;
      case "cli":
        runCli(entry.page, entry.section);
        break;
      case "typecheck-program":
        typecheckNode(entry.page, { fragments: false });
        break;
      case "typecheck-fragments":
        typecheckNode(entry.page, { fragments: true, alternatives: entry.alternatives === true });
        break;
      case "typecheck-python":
        typecheckPython(entry.page, { fragments: true });
        break;
      case "typecheck-python-program":
        typecheckPython(entry.page, { fragments: false });
        break;
      case "typecheck-rust":
        typecheckRust(entry.page, { fragments: true });
        break;
      case "typecheck-rust-program":
        typecheckRust(entry.page, { fragments: false });
        break;
      default:
        throw new Error(`unknown mode ${entry.mode}`);
    }
  } catch (err) {
    fail(`${entry.mode} ${entry.page}`, err);
  }
}

coverage();

console.log(
  failures.length === 0
    ? "\nAll example checks passed."
    : `\n${failures.length} check(s) failed:\n  ${failures.join("\n  ")}\n\n` +
        "If the published SDK moved, the pages need updating, not this harness.",
);
process.exit(failures.length === 0 ? 0 : 1);
