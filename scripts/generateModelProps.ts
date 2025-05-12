const fs = require('fs');
const path = require('path');

const modelsDir: string = path.join(__dirname, '../src/models');
const output: Record<string, Record<string, string>> = {};

function extractProperties(content: string, modelName: string): void {
  const interfaceMatch = content.match(new RegExp(`export interface ${modelName} {([^}]*)}`, 's'));
  if (!interfaceMatch) return;

  const propsText: string = interfaceMatch[1];
  const props: Record<string, string> = {};

  const lines: string[] = propsText.split('\n').map((line: string) => line.trim()).filter((line: string) => line && !line.startsWith('//'));
  for (const line of lines) {
    const [keyPart, typePart] = line.split(':').map((part: string) => part.trim());
    if (!keyPart || !typePart) continue;

    const key: string = keyPart.replace('?', '');
    const type: string = typePart.replace(';', '').replace('?', '');
    props[key] = type;
  }

  output[modelName] = props;
}

const modelFiles: string[] = fs.readdirSync(modelsDir).filter((file: string) => file.endsWith('.ts'));
for (const file of modelFiles) {
  const filePath: string = path.join(modelsDir, file);
  const content: string = fs.readFileSync(filePath, 'utf-8');
  const modelName: string = file.replace('.ts', '').replace(/([A-Z])/g, ' $1').trim().split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  extractProperties(content, modelName);
}

const outputPath: string = path.join(__dirname, 'modelProps.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
console.log(`Generated model properties at ${outputPath}`);