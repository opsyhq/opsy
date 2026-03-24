import { Command } from "commander";
import {
  findObserveCommandHelp,
  getUnsupportedObserveProviderMessage,
  renderObserveProviderHelp,
  renderObserveSupportedProviders,
} from "../catalog";
import { ApiRequestError, apiRequest } from "../client";
import { getApiUrl, getToken } from "../config";
import { formatTable, output } from "../output";

type GlobalFlags = {
  token?: string;
  apiUrl?: string;
  json?: boolean;
  quiet?: boolean;
};

type ObserveDeps = {
  apiRequest: typeof apiRequest;
  getToken: typeof getToken;
  getApiUrl: typeof getApiUrl;
  log: (message?: string) => void;
  error: (message?: string) => void;
  exit: (code: number) => never;
};

const defaultDeps: ObserveDeps = {
  apiRequest,
  getToken,
  getApiUrl,
  log: (message?: string) => console.log(message),
  error: (message?: string) => console.error(message),
  exit: (code: number) => process.exit(code),
};

function getRootFlags(command: Command): GlobalFlags {
  let current = command;
  while (current.parent) current = current.parent;
  return current.opts<GlobalFlags>();
}

function buildQuery(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

function isQueryTimeoutDetails(value: unknown): value is {
  kind: "query_timeout";
  queryId?: string;
  status?: string;
  retryHint?: string;
} {
  return Boolean(
    value &&
    typeof value === "object" &&
    "kind" in value &&
    (value as { kind?: unknown }).kind === "query_timeout",
  );
}

function handleCliError(error: unknown, deps: ObserveDeps, flags?: GlobalFlags): never {
  if (flags?.json && error instanceof ApiRequestError) {
    output(error.body, flags);
    return deps.exit(1);
  }

  deps.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof ApiRequestError && isQueryTimeoutDetails(error.details)) {
    if (error.details.queryId) deps.error(`Query ID: ${error.details.queryId}`);
    if (error.details.status) deps.error(`Last status: ${error.details.status}`);
    if (error.details.retryHint) deps.error(`Retry hint: ${error.details.retryHint}`);
  }
  return deps.exit(1);
}

function parseJsonArray(value: string, flag: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${flag} must be valid JSON.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${flag} must be a JSON array.`);
  }
  return parsed;
}

function applyCatalogHelp(command: Command, path: string[]) {
  const entry = findObserveCommandHelp("aws", path);
  if (!entry) return;
  command.description(entry.purpose);
  const notes = entry.notes?.length ? `\nNotes:\n${entry.notes.map((note) => `  ${note}`).join("\n")}` : "";
  const examples = entry.examples.length ? `\nExamples:\n${entry.examples.map((example) => `  ${example}`).join("\n")}` : "";
  command.addHelpText("after", `\n${entry.synopsis}${notes}${examples}`);
}

function printLogEvents(
  deps: ObserveDeps,
  events: Array<{ timestamp: string; logStreamName: string | null; message: string }>,
) {
  if (!events.length) {
    deps.log("No log events found.");
    return;
  }
  deps.log(events.map((event) => `[${event.timestamp}] ${event.logStreamName ?? "-"} ${event.message}`).join("\n"));
}

export function createObserveCommand(deps: ObserveDeps = defaultDeps) {
  const observeCmd = new Command("observe")
    .description("Provider-scoped logs, metrics, and alarms")
    .argument("[provider]")
    .argument("[args...]");

  observeCmd.action((provider?: string) => {
    if (!provider) {
      deps.log(renderObserveSupportedProviders());
      deps.log('Use "opsy observe aws --help" for AWS observe commands.');
      return;
    }

    deps.error(`Error: ${getUnsupportedObserveProviderMessage(provider)}`);
    deps.exit(1);
  });

  const awsCmd = new Command("aws")
    .description("Observe AWS CloudWatch logs, metrics, and alarms");
  awsCmd.addHelpText("after", `\n${renderObserveProviderHelp("aws")}`);
  awsCmd.action(function () {
    deps.log(this.helpInformation());
  });

  const logsCmd = new Command("logs").description("CloudWatch Logs commands");
  logsCmd.action(function () {
    deps.log(this.helpInformation());
  });

  const groupsCmd = new Command("groups")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--name-prefix <prefix>", "Filter by log group name prefix")
    .option("--limit <n>", "Page size")
    .option("--next-token <token>", "Pagination token")
    .action(async function (this: Command, opts: {
      project: string;
      env: string;
      profile?: string;
      region?: string;
      namePrefix?: string;
      limit?: string;
      nextToken?: string;
    }) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/groups${buildQuery({
        profileId: opts.profile,
        region: opts.region,
        namePrefix: opts.namePrefix,
        limit: opts.limit,
        nextToken: opts.nextToken,
      })}`;

      try {
        const data = await deps.apiRequest<any>(path, { token, apiUrl });
        if (flags.json) return output(data, flags);
        if (!data.items.length) {
          deps.log("No log groups found.");
          return;
        }
        deps.log(formatTable(
          ["NAME", "RETENTION", "STORED BYTES", "CLASS"],
          data.items.map((group: any) => [
            group.name,
            group.retentionInDays == null ? "-" : String(group.retentionInDays),
            group.storedBytes == null ? "-" : String(group.storedBytes),
            group.logGroupClass ?? "-",
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(groupsCmd, ["logs", "groups"]);
  logsCmd.addCommand(groupsCmd);

  const tailCmd = new Command("tail")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--log-group <name>", "Log group name")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--log-stream <name>", "Filter to one log stream")
    .option("--filter-pattern <pattern>", "CloudWatch Logs filter pattern")
    .option("--since <duration-or-iso>", "Range start")
    .option("--until <duration-or-iso>", "Range end")
    .option("--limit <n>", "Maximum events")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/tail${buildQuery({
        profileId: opts.profile,
        region: opts.region,
        logGroup: opts.logGroup,
        logStream: opts.logStream,
        filterPattern: opts.filterPattern,
        since: opts.since,
        until: opts.until,
        limit: opts.limit,
      })}`;

      try {
        const data = await deps.apiRequest<any>(path, { token, apiUrl });
        if (flags.json) return output(data, flags);
        printLogEvents(deps, data.events);
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(tailCmd, ["logs", "tail"]);
  logsCmd.addCommand(tailCmd);

  const eventsCmd = new Command("events")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--log-group <name>", "Log group name")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--log-stream <name>", "Filter to one log stream")
    .option("--filter-pattern <pattern>", "CloudWatch Logs filter pattern")
    .option("--since <duration-or-iso>", "Range start")
    .option("--until <duration-or-iso>", "Range end")
    .option("--limit <n>", "Maximum events")
    .option("--next-token <token>", "Pagination token")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/events${buildQuery({
        profileId: opts.profile,
        region: opts.region,
        logGroup: opts.logGroup,
        logStream: opts.logStream,
        filterPattern: opts.filterPattern,
        since: opts.since,
        until: opts.until,
        limit: opts.limit,
        nextToken: opts.nextToken,
      })}`;

      try {
        const data = await deps.apiRequest<any>(path, { token, apiUrl });
        if (flags.json) return output(data, flags);
        printLogEvents(deps, data.events);
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(eventsCmd, ["logs", "events"]);
  logsCmd.addCommand(eventsCmd);

  const queryCmd = new Command("query")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--log-groups <csv>", "Comma-separated log groups")
    .requiredOption("--query-string <text>", "Logs Insights query")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--since <duration-or-iso>", "Range start")
    .option("--until <duration-or-iso>", "Range end")
    .option("--limit <n>", "Maximum rows")
    .option("--timeout-seconds <n>", "Polling timeout")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const data = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/observe/aws/logs/query`,
          {
            method: "POST",
            body: {
              profileId: opts.profile,
              region: opts.region,
              logGroups: String(opts.logGroups).split(",").map((entry: string) => entry.trim()).filter(Boolean),
              queryString: opts.queryString,
              since: opts.since,
              until: opts.until,
              limit: opts.limit ? Number(opts.limit) : undefined,
              timeoutSeconds: opts.timeoutSeconds ? Number(opts.timeoutSeconds) : undefined,
            },
            token,
            apiUrl,
          },
        );
        if (flags.json) return output(data, flags);
        if (!data.rows.length) {
          deps.log(`Query completed with status ${data.status} and returned no rows.`);
          return;
        }
        const columns: string[] = Array.from(new Set(data.rows.flatMap((row: Record<string, unknown>) => Object.keys(row))));
        deps.log(formatTable(
          columns,
          data.rows.map((row: Record<string, unknown>) => columns.map((column) => String(row[column] ?? ""))),
        ));
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(queryCmd, ["logs", "query"]);
  logsCmd.addCommand(queryCmd);
  awsCmd.addCommand(logsCmd);

  const metricsCmd = new Command("metrics").description("CloudWatch metrics commands");
  metricsCmd.action(function () {
    deps.log(this.helpInformation());
  });

  const metricsListCmd = new Command("list")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--namespace <name>", "Metric namespace")
    .option("--metric-name <name>", "Metric name")
    .option("--dimensions <json-array>", "JSON array of AWS dimension filters")
    .option("--recently-active <PT3H>", "Recently active window")
    .option("--next-token <token>", "Pagination token")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        if (opts.dimensions) parseJsonArray(opts.dimensions, "--dimensions");
        const data = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/observe/aws/metrics${buildQuery({
            profileId: opts.profile,
            region: opts.region,
            namespace: opts.namespace,
            metricName: opts.metricName,
            dimensions: opts.dimensions,
            recentlyActive: opts.recentlyActive,
            nextToken: opts.nextToken,
          })}`,
          { token, apiUrl },
        );
        if (flags.json) return output(data, flags);
        if (!data.items.length) {
          deps.log("No metrics found.");
          return;
        }
        deps.log(formatTable(
          ["NAMESPACE", "METRIC", "DIMENSIONS"],
          data.items.map((metric: any) => [
            metric.namespace,
            metric.metricName,
            metric.dimensions.map((dimension: any) => `${dimension.name}=${dimension.value ?? "*"}`).join(", "),
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(metricsListCmd, ["metrics", "list"]);
  metricsCmd.addCommand(metricsListCmd);

  const metricsQueryCmd = new Command("query")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--queries <json-array>", "JSON array of MetricDataQueries")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--since <duration-or-iso>", "Range start")
    .option("--until <duration-or-iso>", "Range end")
    .option("--scan-by <mode>", "TimestampDescending or TimestampAscending")
    .option("--max-datapoints <n>", "Maximum datapoints")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);

      try {
        const queries = parseJsonArray(opts.queries, "--queries");
        const data = await deps.apiRequest<any>(
          `/projects/${opts.project}/environments/${opts.env}/observe/aws/metrics/query`,
          {
            method: "POST",
            body: {
              profileId: opts.profile,
              region: opts.region,
              queries,
              since: opts.since,
              until: opts.until,
              scanBy: opts.scanBy,
              maxDatapoints: opts.maxDatapoints ? Number(opts.maxDatapoints) : undefined,
            },
            token,
            apiUrl,
          },
        );
        if (flags.json) return output(data, flags);
        deps.log(formatTable(
          ["ID", "LABEL", "STATUS", "POINTS"],
          data.results.map((series: any) => [
            series.id,
            series.label ?? "-",
            series.statusCode ?? "-",
            String(series.values.length),
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(metricsQueryCmd, ["metrics", "query"]);
  metricsCmd.addCommand(metricsQueryCmd);
  awsCmd.addCommand(metricsCmd);

  const alarmsCmd = new Command("alarms").description("CloudWatch alarms commands");
  alarmsCmd.action(function () {
    deps.log(this.helpInformation());
  });

  const alarmsListCmd = new Command("list")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--state <state>", "OK, ALARM, or INSUFFICIENT_DATA")
    .option("--type <type>", "metric, composite, or all", "all")
    .option("--name-prefix <prefix>", "Alarm name prefix")
    .option("--limit <n>", "Page size")
    .option("--next-token <token>", "Pagination token")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/alarms${buildQuery({
        profileId: opts.profile,
        region: opts.region,
        state: opts.state,
        type: opts.type,
        namePrefix: opts.namePrefix,
        limit: opts.limit,
        nextToken: opts.nextToken,
      })}`;

      try {
        const data = await deps.apiRequest<any>(path, { token, apiUrl });
        if (flags.json) return output(data, flags);
        if (!data.items.length) {
          deps.log("No alarms found.");
          return;
        }
        deps.log(formatTable(
          ["NAME", "TYPE", "STATE", "UPDATED"],
          data.items.map((alarm: any) => [
            alarm.name,
            alarm.type,
            alarm.stateValue,
            alarm.stateUpdatedAt ?? "-",
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(alarmsListCmd, ["alarms", "list"]);
  alarmsCmd.addCommand(alarmsListCmd);

  const alarmsDetailCmd = new Command("detail")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--alarm-name <name>", "Alarm name")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/alarms/detail${buildQuery({
        profileId: opts.profile,
        region: opts.region,
        alarmName: opts.alarmName,
      })}`;

      try {
        const data = await deps.apiRequest<any>(path, { token, apiUrl });
        output(data, flags);
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(alarmsDetailCmd, ["alarms", "detail"]);
  alarmsCmd.addCommand(alarmsDetailCmd);

  const alarmsHistoryCmd = new Command("history")
    .requiredOption("--project <slug>", "Project slug")
    .requiredOption("--env <slug>", "Environment slug")
    .requiredOption("--alarm-name <name>", "Alarm name")
    .option("--profile <profileId>", "Use a specific AWS provider profile")
    .option("--region <aws-region>", "Override the AWS region")
    .option("--history-item-type <type>", "ConfigurationUpdate, StateUpdate, or Action")
    .option("--since <duration-or-iso>", "Range start")
    .option("--until <duration-or-iso>", "Range end")
    .option("--limit <n>", "Page size")
    .option("--next-token <token>", "Pagination token")
    .action(async function (this: Command, opts: any) {
      const flags = getRootFlags(this);
      const token = deps.getToken(flags);
      const apiUrl = deps.getApiUrl(flags);
      const path = `/projects/${opts.project}/environments/${opts.env}/observe/aws/alarms/history${buildQuery({
        profileId: opts.profile,
        region: opts.region,
        alarmName: opts.alarmName,
        historyItemType: opts.historyItemType,
        since: opts.since,
        until: opts.until,
        limit: opts.limit,
        nextToken: opts.nextToken,
      })}`;

      try {
        const data = await deps.apiRequest<any>(path, { token, apiUrl });
        if (flags.json) return output(data, flags);
        if (!data.items.length) {
          deps.log("No alarm history found.");
          return;
        }
        deps.log(formatTable(
          ["TIMESTAMP", "TYPE", "SUMMARY"],
          data.items.map((item: any) => [
            item.timestamp,
            item.type,
            item.summary ?? "-",
          ]),
        ));
      } catch (error) {
        handleCliError(error, deps, flags);
      }
    });
  applyCatalogHelp(alarmsHistoryCmd, ["alarms", "history"]);
  alarmsCmd.addCommand(alarmsHistoryCmd);
  awsCmd.addCommand(alarmsCmd);

  observeCmd.addCommand(awsCmd);
  return observeCmd;
}

export const observeCmd = createObserveCommand();
