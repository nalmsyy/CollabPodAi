import fs from "node:fs";
import path from "node:path";

const targetFile = path.resolve(
  process.cwd(),
  "node_modules/componentsjs/lib/rdf/RdfParser.js"
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, "utf8");
  if (!content.includes("options.baseIRI.replace(/ /g, '%20')")) {
    content = content.replace(
      "options.baseIRI = `file://${options.baseIRI}`;",
      "options.baseIRI = `file://${options.baseIRI}`;\n                options.baseIRI = options.baseIRI.replace(/ /g, '%20');"
    );
    fs.writeFileSync(targetFile, content, "utf8");
    console.log("[patch-componentsjs] Patched componentsjs RdfParser for Windows paths with spaces.");
  }
}

