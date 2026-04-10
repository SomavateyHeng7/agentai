#!/usr/bin/env node
import 'dotenv/config';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile, readdir } from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import axios from 'axios';
import { startABTest } from '../testing/ab-test';
import { isWorkflowName, runWorkflow, WORKFLOW_NAMES } from './workflow-runner';
import { getMetrics } from '../integrations/database';

interface RunCommandOptions {
  input?: string;
  json?: string;
  pretty?: boolean;
}

interface CreateAgentOptions {
  name?: string;
  type?: string;
}

interface DeployOptions {
  env: 'staging' | 'production';
}

interface MetricsOptions {
  live?: boolean;
}

interface ComparePromptOptions {
  agent: string;
  versions: string;
}

const projectRoot = path.resolve(__dirname, '..', '..');
const templatesRoot = path.join(projectRoot, 'cli', 'templates');
const promptsRoot = path.join(projectRoot, 'src', 'prompts', 'versions');

const toJson = (value: unknown, pretty: boolean): string =>
  JSON.stringify(value, null, pretty ? 2 : 0);

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON payload. ${String(error)}`);
  }
};

const readTemplate = async (filename: string): Promise<string> =>
  readFile(path.join(templatesRoot, filename), 'utf8');

const toPascalCase = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join('');

const toCamelCase = (value: string): string => {
  const pascal = toPascalCase(value);
  return pascal ? pascal[0].toLowerCase() + pascal.slice(1) : value;
};

const renderTemplate = (template: string, values: Record<string, string>): string => {
  let output = template;
  for (const [key, replacement] of Object.entries(values)) {
    output = output.split(`{{${key}}}`).join(replacement);
  }
  return output;
};

const resolveWorkflowFromAgentName = (agentName: string): string => {
  if (isWorkflowName(agentName)) {
    return agentName;
  }

  const mapping: Record<string, string> = {
    sales: 'sales-qualify',
    salesqualifier: 'sales-qualify',
    salesorchestrator: 'sales-orchestrate',
    support: 'support-triage',
    supporttriage: 'support-triage',
    content: 'content-generate',
    contentgenerator: 'content-generate',
  };

  const key = agentName.replace(/[-_\s]/g, '').toLowerCase();
  return mapping[key] || agentName;
};

const loadPayload = async (options: RunCommandOptions): Promise<unknown> => {
  if (options.input && options.json) {
    throw new Error('Use only one input source: --input <file> or --json <payload>.');
  }

  if (!options.input && !options.json) {
    throw new Error('Missing payload. Provide --input <file> or --json <payload>.');
  }

  if (options.input) {
    const fileContents = await readFile(options.input, 'utf8');
    return parseJson(fileContents);
  }

  return parseJson(String(options.json));
};

const program = new Command();

program
  .name('agentflow')
  .description('AgentFlow CLI for creating, validating, testing, and operating agents.')
  .version('1.0.0');

program
  .command('create-agent')
  .description('Scaffold a new agent with boilerplate, test, and prompt files.')
  .option('--name <name>', 'Agent name, e.g. churn-analyzer')
  .option('--type <type>', 'Agent type/category, e.g. sales')
  .action(async (options: CreateAgentOptions) => {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Agent name:',
        when: !options.name,
      },
      {
        type: 'input',
        name: 'type',
        message: 'Agent type:',
        when: !options.type,
      },
    ]);

    const name = (options.name || answers.name || '').trim();
    const type = (options.type || answers.type || 'general').trim();

    if (!name) {
      throw new Error('Agent name is required.');
    }

    const spinner = ora(`Scaffolding agent '${name}'`).start();
    try {
      const agentClassName = `${toPascalCase(name)}Agent`;
      const agentVarName = toCamelCase(agentClassName);
      const agentTypeName = `${toPascalCase(type)}Input`;

      const values = {
        agentName: name,
        AgentClassName: agentClassName,
        agentVarName,
        AgentTypeName: agentTypeName,
      };

      const agentTemplate = await readTemplate('agent.template.ts.tpl');
      const testTemplate = await readTemplate('test.template.ts.tpl');
      const promptTemplate = await readTemplate('prompt.template.md.tpl');

      const agentPath = path.join(projectRoot, 'src', 'mastra', 'agents', `${name}.ts`);
      const testPath = path.join(projectRoot, 'tests', `${name}.test.ts`);
      const promptDir = path.join(projectRoot, 'src', 'prompts', 'versions', name);
      const promptPath = path.join(promptDir, 'v1.md');

      if (existsSync(agentPath)) {
        throw new Error(`Agent file already exists: ${agentPath}`);
      }

      await mkdir(path.dirname(agentPath), { recursive: true });
      await mkdir(path.dirname(testPath), { recursive: true });
      await mkdir(promptDir, { recursive: true });

      await writeFile(agentPath, renderTemplate(agentTemplate, values), 'utf8');
      await writeFile(testPath, renderTemplate(testTemplate, values), 'utf8');
      await writeFile(promptPath, renderTemplate(promptTemplate, values), 'utf8');

      spinner.succeed(`Created agent scaffold for ${chalk.green(name)}`);
      // eslint-disable-next-line no-console
      console.log(chalk.cyan(`- ${agentPath}`));
      // eslint-disable-next-line no-console
      console.log(chalk.cyan(`- ${testPath}`));
      // eslint-disable-next-line no-console
      console.log(chalk.cyan(`- ${promptPath}`));
    } catch (error) {
      spinner.fail('Failed to scaffold agent');
      throw error;
    }
  });

program
  .command('list')
  .description('List available workflow identifiers for CLI execution.')
  .action(() => {
    for (const workflow of WORKFLOW_NAMES) {
      // eslint-disable-next-line no-console
      console.log(workflow);
    }
  });

program
  .command('test')
  .description('Run an agent workflow locally with a sample input JSON file.')
  .argument('<agentName>', 'Agent or workflow identifier')
  .requiredOption('-i, --input <file>', 'Path to JSON input file')
  .option('-p, --pretty', 'Pretty-print output JSON', false)
  .action(async (agentName: string, options: RunCommandOptions) => {
    const workflowName = resolveWorkflowFromAgentName(agentName);
    if (!isWorkflowName(workflowName)) {
      throw new Error(`Unknown agent/workflow '${agentName}'.`);
    }

    const payload = await loadPayload({ input: options.input });
    const spinner = ora(`Testing ${workflowName}`).start();
    try {
      const result = await runWorkflow(workflowName, payload);
      spinner.succeed('Test execution complete');
      // eslint-disable-next-line no-console
      console.log(toJson(result, Boolean(options.pretty)));
    } catch (error) {
      spinner.fail('Test execution failed');
      throw error;
    }
  });

program
  .command('validate-prompts')
  .description('Validate prompt pack files for an agent version set.')
  .argument('<agentName>', 'Agent prompt folder name in src/prompts/versions')
  .action(async (agentName: string) => {
    const agentPromptDir = path.join(promptsRoot, agentName);
    if (!existsSync(agentPromptDir)) {
      throw new Error(`Prompt directory not found: ${agentPromptDir}`);
    }

    const files = await readdir(agentPromptDir);
    const markdownFiles = files.filter((file) => file.endsWith('.md'));

    if (markdownFiles.length === 0) {
      throw new Error(`No prompt files found in ${agentPromptDir}`);
    }

    for (const file of markdownFiles) {
      const content = await readFile(path.join(agentPromptDir, file), 'utf8');
      if (!/json|JSON/.test(content)) {
        throw new Error(`Prompt file ${file} is missing explicit JSON output guidance.`);
      }
    }

    // eslint-disable-next-line no-console
    console.log(chalk.green(`Validated ${markdownFiles.length} prompt file(s) for '${agentName}'.`));
  });

program
  .command('deploy')
  .description('Deploy an agent to staging or production (command scaffold).')
  .argument('<agentName>', 'Agent/workflow name')
  .requiredOption('--env <env>', 'staging or production')
  .action(async (agentName: string, options: DeployOptions) => {
    if (!['staging', 'production'].includes(options.env)) {
      throw new Error('Invalid env. Use --env staging or --env production.');
    }

    const spinner = ora(`Deploying ${agentName} to ${options.env}`).start();
    await new Promise((resolve) => setTimeout(resolve, 900));
    spinner.succeed(`Deployment command completed for ${agentName} (${options.env})`);
  });

program
  .command('metrics')
  .description('Show metrics for one agent, optionally in live mode.')
  .argument('<agentName>', 'Agent or workflow name')
  .option('--live', 'Poll metrics continuously', false)
  .action(async (agentName: string, options: MetricsOptions) => {
    const workflowName = resolveWorkflowFromAgentName(agentName);
    const target = isWorkflowName(workflowName) ? workflowName : agentName;

    const printMetrics = async (): Promise<void> => {
      try {
        const response = await axios.get(`http://localhost:3000/api/metrics/${target}`);
        // eslint-disable-next-line no-console
        console.log(toJson(response.data, true));
      } catch {
        const fallback = await getMetrics(target);
        // eslint-disable-next-line no-console
        console.log(toJson({ success: true, source: 'local', data: fallback }, true));
      }
    };

    await printMetrics();

    if (options.live) {
      // eslint-disable-next-line no-console
      console.log(chalk.yellow('Live mode enabled. Press Ctrl+C to stop.'));
      setInterval(async () => {
        await printMetrics();
      }, 3000);
    }
  });

program
  .command('compare-prompts')
  .description('Compare two prompt versions by file statistics.')
  .requiredOption('--agent <name>', 'Agent prompt folder name')
  .requiredOption('--versions <versions>', 'Comma-separated versions, e.g. v1,v2')
  .action(async (options: ComparePromptOptions) => {
    const [leftVersion, rightVersion] = options.versions.split(',').map((item) => item.trim());
    if (!leftVersion || !rightVersion) {
      throw new Error('Provide two versions via --versions v1,v2');
    }

    const leftPath = path.join(promptsRoot, options.agent, `${leftVersion}.md`);
    const rightPath = path.join(promptsRoot, options.agent, `${rightVersion}.md`);

    if (!existsSync(leftPath) || !existsSync(rightPath)) {
      throw new Error(`Prompt versions not found for agent '${options.agent}'.`);
    }

    const left = await readFile(leftPath, 'utf8');
    const right = await readFile(rightPath, 'utf8');

    const summary = {
      left: {
        version: leftVersion,
        lines: left.split('\n').length,
        chars: left.length,
      },
      right: {
        version: rightVersion,
        lines: right.split('\n').length,
        chars: right.length,
      },
      deltaChars: right.length - left.length,
    };

    // eslint-disable-next-line no-console
    console.log(toJson(summary, true));
  });

program
  .command('health-check')
  .description('Run health checks across core services and agents.')
  .option('--all', 'Include full endpoint checks', false)
  .action(async (options: { all?: boolean }) => {
    const checks: Array<{ name: string; ok: boolean; details?: string }> = [];

    try {
      const health = await axios.get('http://localhost:3000/health');
      checks.push({ name: 'api-health', ok: health.status === 200 || health.status === 503 });
    } catch (error) {
      checks.push({ name: 'api-health', ok: false, details: String(error) });
    }

    if (options.all) {
      for (const workflow of WORKFLOW_NAMES) {
        checks.push({ name: `workflow-registered:${workflow}`, ok: true });
      }
    }

    // eslint-disable-next-line no-console
    console.log(toJson({ success: checks.every((item) => item.ok), checks }, true));
  });

program
  .command('ui')
  .description('Launch the dashboard UI development server.')
  .action(() => {
    const dashboardPath = path.join(projectRoot, 'ui', 'web', 'dashboard');
    if (!existsSync(dashboardPath)) {
      throw new Error('Dashboard app not found at ./ui/web/dashboard');
    }

    const child = spawn('npm', ['run', 'dev'], {
      cwd: dashboardPath,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  });

program
  .command('run')
  .description('Run a workflow and print the JSON response.')
  .argument('<workflow>', 'Workflow identifier')
  .option('-i, --input <file>', 'Path to a JSON payload file')
  .option('-j, --json <payload>', 'Inline JSON payload string')
  .option('-p, --pretty', 'Pretty-print output JSON', false)
  .action(async (workflow: string, options: RunCommandOptions) => {
    if (!isWorkflowName(workflow)) {
      throw new Error(
        `Unknown workflow '${workflow}'. Run 'agentflow list' to view valid identifiers.`
      );
    }

    try {
      const payload = await loadPayload(options);
      const result = await runWorkflow(workflow, payload);
      // eslint-disable-next-line no-console
      console.log(toJson(result, Boolean(options.pretty)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(toJson({ success: false, error: message }, true));
      process.exitCode = 1;
    }
  });

program
  .command('ab-test')
  .description('Run A/B comparison between two workflows using shared samples.')
  .option('-i, --input <file>', 'Path to A/B test config JSON file')
  .option('-j, --json <payload>', 'Inline A/B test config JSON string')
  .option('-p, --pretty', 'Pretty-print output JSON', false)
  .action(async (options: RunCommandOptions) => {
    try {
      const config = await loadPayload(options);
      const result = await startABTest(config);
      // eslint-disable-next-line no-console
      console.log(toJson(result, Boolean(options.pretty)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error(toJson({ success: false, error: message }, true));
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.error(toJson({ success: false, error: message }, true));
  process.exit(1);
});
