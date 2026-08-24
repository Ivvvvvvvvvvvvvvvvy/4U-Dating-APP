import ts from '/workspace/thread/node_modules/typescript/lib/typescript.js';
import path from 'node:path';

function check(configPath) {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) { console.log(configPath, 'READ ERROR', ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')); return; }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(configPath));
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const errors = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error);
  console.log(`=== ${configPath} ===`);
  console.log('files:', program.getSourceFiles().length, 'diagnostics:', diagnostics.length, 'errors:', errors.length);
  for (const d of errors.slice(0, 40)) {
    const where = d.file ? `${path.relative('.', d.file.fileName)}(${d.file.getLineAndCharacterOfPosition(d.start).line + 1},${d.file.getLineAndCharacterOfPosition(d.start).character + 1})` : '';
    console.log(where, 'error TS' + d.code + ':', ts.flattenDiagnosticMessageText(d.messageText, ' '));
  }
}
check('tsconfig.app.json');
check('tsconfig.node.json');
