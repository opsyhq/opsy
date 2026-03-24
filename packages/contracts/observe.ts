export type ObserveProviderId = "aws";

export type ObserveProviderSummary = {
  id: ObserveProviderId;
  label: string;
};

export const OBSERVE_PROVIDERS: ObserveProviderSummary[] = [
  { id: "aws", label: "AWS" },
];

export function getUnsupportedObserveProviderMessage(provider: string): string {
  return `Observe is not implemented for "${provider}". Use "observe" to list supported providers.`;
}

export type ObserveCommandHelpEntry = {
  path: string[];
  synopsis: string;
  purpose: string;
  examples: string[];
  notes?: string[];
};

export type ObserveProviderHelpCatalog = {
  provider: ObserveProviderId;
  title: string;
  intro: string;
  notes: string[];
  commands: ObserveCommandHelpEntry[];
};

const OBSERVE_TIME_NOTES = [
  "Time values accept ISO timestamps or relative durations like 30s, 15m, 1h, or 7d.",
  "JSON-typed options use raw AWS-like JSON arrays for --dimensions and --queries.",
];

export const OBSERVE_AWS_HELP_CATALOG: ObserveProviderHelpCatalog = {
  provider: "aws",
  title: "AWS CloudWatch observe commands",
  intro: "Read-only CloudWatch logs, metrics, and alarms for an environment or explicit AWS profile.",
  notes: OBSERVE_TIME_NOTES,
  commands: [
    {
      path: ["logs", "groups"],
      synopsis: "observe aws logs groups --workspace <workspace> --env <env> [--profile <profileId>] [--region <aws-region>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]",
      purpose: "List CloudWatch log groups.",
      examples: [
        "observe aws logs groups --workspace acme --env prod",
        "observe aws logs groups --workspace acme --env prod --name-prefix /aws/lambda/",
      ],
    },
    {
      path: ["logs", "tail"],
      synopsis: "observe aws logs tail --workspace <workspace> --env <env> --log-group <name> [--profile <profileId>] [--region <aws-region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>]",
      purpose: "Fetch a bounded one-shot view of recent log events, newest first.",
      examples: [
        "observe aws logs tail --workspace acme --env prod --log-group /aws/lambda/payments",
        "observe aws logs tail --workspace acme --env prod --log-group /aws/ecs/app --since 1h --filter-pattern ERROR",
      ],
      notes: ["Default --since is 15m."],
    },
    {
      path: ["logs", "events"],
      synopsis: "observe aws logs events --workspace <workspace> --env <env> --log-group <name> [--profile <profileId>] [--region <aws-region>] [--log-stream <name>] [--filter-pattern <pattern>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]",
      purpose: "Retrieve filtered log events in chronological order.",
      examples: [
        "observe aws logs events --workspace acme --env prod --log-group /aws/lambda/payments --since 30m",
        "observe aws logs events --workspace acme --env prod --log-group /aws/ecs/app --log-stream ecs/app/123",
      ],
    },
    {
      path: ["logs", "query"],
      synopsis: "observe aws logs query --workspace <workspace> --env <env> --log-groups <csv> --query-string <text> [--profile <profileId>] [--region <aws-region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--timeout-seconds <n>]",
      purpose: "Run a CloudWatch Logs Insights query and poll until completion.",
      examples: [
        "observe aws logs query --workspace acme --env prod --log-groups /aws/lambda/payments --query-string 'fields @timestamp, @message | sort @timestamp desc | limit 20'",
        "observe aws logs query --workspace acme --env prod --log-groups /aws/lambda/a,/aws/lambda/b --since 2h --query-string 'stats count() by bin(5m)'",
      ],
      notes: ["Default --since is 1h. Default --timeout-seconds is 15."],
    },
    {
      path: ["metrics", "list"],
      synopsis: "observe aws metrics list --workspace <workspace> --env <env> [--profile <profileId>] [--region <aws-region>] [--namespace <name>] [--metric-name <name>] [--dimensions <json-array>] [--recently-active <PT3H>] [--next-token <token>]",
      purpose: "List CloudWatch metric descriptors and dimension sets.",
      examples: [
        "observe aws metrics list --workspace acme --env prod --namespace AWS/Lambda",
        "observe aws metrics list --workspace acme --env prod --namespace AWS/EC2 --metric-name CPUUtilization",
      ],
    },
    {
      path: ["metrics", "query"],
      synopsis: "observe aws metrics query --workspace <workspace> --env <env> --queries <json-array> [--profile <profileId>] [--region <aws-region>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--scan-by <TimestampDescending|TimestampAscending>] [--max-datapoints <n>]",
      purpose: "Run CloudWatch GetMetricData queries and return raw datapoints.",
      examples: [
        "observe aws metrics query --workspace acme --env prod --queries '[{\"Id\":\"cpu\",\"MetricStat\":{\"Metric\":{\"Namespace\":\"AWS/EC2\",\"MetricName\":\"CPUUtilization\",\"Dimensions\":[{\"Name\":\"InstanceId\",\"Value\":\"i-123\"}]},\"Period\":300,\"Stat\":\"Average\"}}]'",
        "observe aws metrics query --workspace acme --env prod --queries '[{\"Id\":\"errors\",\"Expression\":\"SUM(METRICS())\"}]' --since 6h",
      ],
      notes: ["Default --since is 1h. Default --until is now."],
    },
    {
      path: ["alarms", "list"],
      synopsis: "observe aws alarms list --workspace <workspace> --env <env> [--profile <profileId>] [--region <aws-region>] [--state <OK|ALARM|INSUFFICIENT_DATA>] [--type <metric|composite|all>] [--name-prefix <prefix>] [--limit <n>] [--next-token <token>]",
      purpose: "List CloudWatch metric and composite alarms.",
      examples: [
        "observe aws alarms list --workspace acme --env prod",
        "observe aws alarms list --workspace acme --env prod --state ALARM --type metric",
      ],
      notes: ["Default --type is all."],
    },
    {
      path: ["alarms", "detail"],
      synopsis: "observe aws alarms detail --workspace <workspace> --env <env> --alarm-name <name> [--profile <profileId>] [--region <aws-region>]",
      purpose: "Fetch the full current config and state for one alarm.",
      examples: [
        "observe aws alarms detail --workspace acme --env prod --alarm-name HighCPU",
        "observe aws alarms detail --workspace acme --env prod --alarm-name CompositeLatencyAlarm",
      ],
    },
    {
      path: ["alarms", "history"],
      synopsis: "observe aws alarms history --workspace <workspace> --env <env> --alarm-name <name> [--profile <profileId>] [--region <aws-region>] [--history-item-type <ConfigurationUpdate|StateUpdate|Action>] [--since <duration-or-iso>] [--until <duration-or-iso>] [--limit <n>] [--next-token <token>]",
      purpose: "List CloudWatch alarm history entries.",
      examples: [
        "observe aws alarms history --workspace acme --env prod --alarm-name HighCPU",
        "observe aws alarms history --workspace acme --env prod --alarm-name HighCPU --history-item-type StateUpdate --since 7d",
      ],
      notes: ["Default --since is 24h."],
    },
  ],
};

export function getObserveProviderHelpCatalog(provider: string): ObserveProviderHelpCatalog | null {
  if (provider === "aws") return OBSERVE_AWS_HELP_CATALOG;
  return null;
}

export function findObserveCommandHelp(
  provider: string,
  path: string[],
): ObserveCommandHelpEntry | undefined {
  const catalog = getObserveProviderHelpCatalog(provider);
  return catalog?.commands.find((entry) => entry.path.join(" ") === path.join(" "));
}

export function renderObserveSupportedProviders(): string {
  return `Supported observe providers:\n${OBSERVE_PROVIDERS.map((provider) => `  ${provider.id}`).join("\n")}`;
}

export function renderObserveProviderHelp(provider: string): string {
  const catalog = getObserveProviderHelpCatalog(provider);
  if (!catalog) return getUnsupportedObserveProviderMessage(provider);

  const sections = catalog.commands.map((entry) => {
    const notes = entry.notes?.length
      ? `\n  Notes: ${entry.notes.join(" ")}`
      : "";
    const examples = entry.examples.map((example) => `  Example: ${example}`).join("\n");
    return `${entry.synopsis}\n  ${entry.purpose}${notes}\n${examples}`;
  });

  return `${catalog.title}\n  ${catalog.intro}\n\nNotes:\n${catalog.notes.map((note) => `  - ${note}`).join("\n")}\n\n${sections.join("\n\n")}`;
}

export type ObserveTimeWindow = {
  startTime: string;
  endTime: string;
};

export type ObserveAwsLogGroup = {
  name: string;
  arn: string | null;
  creationTime: string | null;
  retentionInDays: number | null;
  storedBytes: number | null;
  metricFilterCount: number | null;
  logGroupClass: string | null;
};

export type ObserveAwsLogGroupsResponse = {
  provider: "aws";
  region: string;
  namePrefix: string | null;
  items: ObserveAwsLogGroup[];
  nextToken: string | null;
};

export type ObserveAwsLogEvent = {
  eventId: string | null;
  timestamp: string;
  ingestionTime: string | null;
  logStreamName: string | null;
  message: string;
};

export type ObserveAwsLogEventsResponse = {
  provider: "aws";
  region: string;
  logGroup: string;
  logStream: string | null;
  filterPattern: string | null;
  timeWindow: ObserveTimeWindow;
  events: ObserveAwsLogEvent[];
  nextToken: string | null;
};

export type ObserveAwsLogTailResponse = ObserveAwsLogEventsResponse & {
  summary: {
    count: number;
    newestEventTime: string | null;
    oldestEventTime: string | null;
  };
};

export type ObserveAwsLogQueryRow = Record<string, string | null>;

export type ObserveAwsLogQueryStatistics = {
  recordsMatched: number | null;
  recordsScanned: number | null;
  estimatedRecordsSkipped: number | null;
  bytesScanned: number | null;
  estimatedBytesSkipped: number | null;
  logGroupsScanned: number | null;
};

export type ObserveAwsLogsQueryResponse = {
  provider: "aws";
  region: string;
  queryId: string;
  status: string;
  logGroups: string[];
  timeWindow: ObserveTimeWindow;
  rows: ObserveAwsLogQueryRow[];
  statistics: ObserveAwsLogQueryStatistics;
};

export type ObserveAwsMetricDimension = {
  name: string;
  value: string | null;
};

export type ObserveAwsMetricDescriptor = {
  namespace: string;
  metricName: string;
  dimensions: ObserveAwsMetricDimension[];
};

export type ObserveAwsMetricsListResponse = {
  provider: "aws";
  region: string;
  items: ObserveAwsMetricDescriptor[];
  nextToken: string | null;
};

export type ObserveAwsMetricMessage = {
  code: string | null;
  value: string;
};

export type ObserveAwsMetricSeries = {
  id: string;
  label: string | null;
  statusCode: string | null;
  timestamps: string[];
  values: number[];
  messages: ObserveAwsMetricMessage[];
};

export type ObserveAwsMetricsQueryResponse = {
  provider: "aws";
  region: string;
  timeWindow: ObserveTimeWindow;
  results: ObserveAwsMetricSeries[];
  messages: ObserveAwsMetricMessage[];
  nextToken: string | null;
};

export type ObserveAwsAlarmType = "metric" | "composite";

export type ObserveAwsAlarmSummary = {
  name: string;
  arn: string | null;
  type: ObserveAwsAlarmType;
  stateValue: string;
  stateReason: string | null;
  stateUpdatedAt: string | null;
  description: string | null;
  actionsEnabled: boolean;
  namespace: string | null;
  metricName: string | null;
};

export type ObserveAwsAlarmsListResponse = {
  provider: "aws";
  region: string;
  items: ObserveAwsAlarmSummary[];
  nextToken: string | null;
};

export type ObserveAwsAlarmDetail = ObserveAwsAlarmSummary & {
  configuration: Record<string, unknown>;
  stateReasonData: string | null;
  okActions: string[];
  alarmActions: string[];
  insufficientDataActions: string[];
  dimensions: ObserveAwsMetricDimension[];
  metrics: unknown[];
  alarmRule: string | null;
};

export type ObserveAwsAlarmDetailResponse = {
  provider: "aws";
  region: string;
  alarm: ObserveAwsAlarmDetail;
};

export type ObserveAwsAlarmHistoryEntry = {
  timestamp: string;
  type: string;
  summary: string | null;
  data: string | null;
};

export type ObserveAwsAlarmHistoryResponse = {
  provider: "aws";
  region: string;
  alarmName: string;
  timeWindow: ObserveTimeWindow;
  items: ObserveAwsAlarmHistoryEntry[];
  nextToken: string | null;
};
