import { z } from 'zod';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { moduleSpecSchema } from '../src/moduleSpec';

const scriptDir = import.meta.dirname ?? __dirname;
const packageRoot = resolve(scriptDir, '..');
const generatedDir = resolve(packageRoot, 'generated');
const moduleSchemaDir = resolve(generatedDir, 'module_schema');
const uvCacheDir = resolve(packageRoot, '.cache', 'uv');
mkdirSync(moduleSchemaDir, { recursive: true });
mkdirSync(uvCacheDir, { recursive: true });

// Step 1: Generate JSON Schema using Zod 4 native method
const jsonSchema = z.toJSONSchema(moduleSpecSchema, { target: 'draft-2020-12' });

const schemaPath = resolve(generatedDir, 'schema.json');
writeFileSync(schemaPath, JSON.stringify(jsonSchema, null, 2) + '\n');
console.log(`✓ JSON Schema written to ${schemaPath}`);

// Step 1b: Create a Pydantic-compatible JSON Schema (remove pattern from uuid fields)
function cleanForPydantic(schema: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(schema);
  const props = clone.properties as Record<string, Record<string, unknown>> | undefined;
  if (props) {
    for (const prop of Object.values(props)) {
      if (prop.format === 'uuid' && prop.pattern) {
        delete prop.pattern;
      }
    }
  }
  return clone;
}
const pydanticSchema = cleanForPydantic(jsonSchema as Record<string, unknown>);
const pydanticSchemaPath = resolve(generatedDir, 'schema-pydantic.json');
writeFileSync(pydanticSchemaPath, JSON.stringify(pydanticSchema, null, 2) + '\n');

function patchGeneratedPydanticModelFile(filePath: string): void {
  const baseConfigBlock = `ConfigDict(
        extra='forbid',
    )`;
  const patchedConfigBlock = `ConfigDict(
        extra='forbid',
        populate_by_name=True,
        alias_generator=to_camel,
    )`;

  let content = readFileSync(filePath, 'utf8');

  if (!content.includes('from pydantic.alias_generators import to_camel')) {
    content = content.replace(
      "from pydantic import AwareDatetime, BaseModel, ConfigDict, Field\n",
      "from pydantic import AwareDatetime, BaseModel, ConfigDict, Field\nfrom pydantic.alias_generators import to_camel\n"
    );
  }

  if (!content.includes('populate_by_name=True')) {
    content = content.split(baseConfigBlock).join(patchedConfigBlock);
  }

  if (!content.includes('populate_by_name=True') || !content.includes('alias_generator=to_camel')) {
    throw new Error('Failed to patch generated Pydantic model config with alias_generator/populate_by_name');
  }

  writeFileSync(filePath, content);
}

// Step 2: Generate Pydantic models from JSON Schema
const modelsPath = resolve(moduleSchemaDir, 'models.py');
const legacyModelsPath = resolve(generatedDir, 'models.py');
const backendDir = resolve(packageRoot, '../../apps/backend');
const localDatamodelCodegenPath = resolve(backendDir, '.venv/bin/datamodel-codegen');
const codegenArgs = [
  '--input',
  pydanticSchemaPath,
  '--output',
  modelsPath,
  '--input-file-type',
  'jsonschema',
  '--output-model-type',
  'pydantic_v2.BaseModel',
  '--use-standard-collections',
  '--use-union-operator',
  '--target-python-version',
  '3.12',
  '--use-schema-description',
  '--snake-case-field',
  '--field-constraints',
];

try {
  const uvResult = spawnSync(
    'uv',
    [
      'run',
      '--extra',
      'dev',
      'datamodel-codegen',
      ...codegenArgs,
    ],
    {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        UV_CACHE_DIR: process.env.UV_CACHE_DIR ?? uvCacheDir,
      },
    }
  );

  let codegenStatus = uvResult.status;

  if (uvResult.error) {
    codegenStatus = null;
  }

  if (codegenStatus !== 0) {
    if (!existsSync(localDatamodelCodegenPath)) {
      if (uvResult.error) {
        throw uvResult.error;
      }
      throw new Error(`datamodel-codegen (uv run) exited with status ${uvResult.status ?? 'unknown'}`);
    }

    console.warn('! uv run failed; falling back to apps/backend/.venv/bin/datamodel-codegen');
    const fallbackResult = spawnSync(localDatamodelCodegenPath, codegenArgs, {
      cwd: backendDir,
      stdio: 'inherit',
    });

    if (fallbackResult.error) {
      throw fallbackResult.error;
    }

    if (fallbackResult.status !== 0) {
      throw new Error(`datamodel-codegen fallback exited with status ${fallbackResult.status ?? 'unknown'}`);
    }
  }

  patchGeneratedPydanticModelFile(modelsPath);
  copyFileSync(modelsPath, legacyModelsPath);

  console.log(`✓ Pydantic models written to ${modelsPath}`);
  console.log(`✓ Legacy model mirror written to ${legacyModelsPath}`);
} catch (error) {
  console.error('✗ Failed to generate Pydantic models. Is datamodel-code-generator installed?');
  console.error('  Run: cd apps/backend && uv sync --extra dev');
  if (error instanceof Error) {
    console.error(`  Details: ${error.message}`);
  }
  process.exit(1);
}

// Step 3: Generate __init__.py for module_schema package
const initContent = `# Auto-generated by schema generation pipeline — do not edit manually
from module_schema.models import *  # noqa: F401,F403
`;
writeFileSync(resolve(moduleSchemaDir, '__init__.py'), initContent);

// Step 4: Generate pyproject.toml for the module_schema package
const pyprojectContent = `# Auto-generated by schema generation pipeline — do not edit manually
[project]
name = "module-schema"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["pydantic>=2.12.0"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
`;
writeFileSync(resolve(generatedDir, 'pyproject.toml'), pyprojectContent);

console.log('✓ Python package files generated (module_schema/__init__.py, pyproject.toml)');
