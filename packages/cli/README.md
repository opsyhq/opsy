# @opsyhq/opsy

Opsy CLI — a unified, provider-agnostic command-line interface for cloud, built
for humans and AI agents. One consistent `opsy <noun> <action> [name] [flags]`
grammar across AWS, Cloudflare, GCP, and more, plus `opsy deploy` / `opsy plan`
for the daily loop.

## Install

```bash
npm install -g @opsyhq/opsy
opsy --version
```

## Authenticate

```bash
opsy auth login     # opens your browser — approve, and you're in
opsy auth status    # check the current session
opsy auth logout
```

For CI or headless environments, set an API key and skip the browser:

```bash
export OPSY_API_KEY=opsy_key_...
opsy project list
```

## Usage

`opsy --help` lists every command, and `opsy <command> --help` shows that
command's flags. That built-in help is always authoritative for the version
you have installed — the examples below are a starting point, not a full
reference.

The grammar is noun-centric: `opsy <noun> <action> [name] [flags]`. The nouns
split by ownership:

- **`registry`** (alias `reg`) — the server's provider catalog: list providers,
  browse types and schemas, and emit everything needed to connect a provider.
- **`integration`** (alias `int`) — project-scoped credentials for providers.
  CRUD only; for "what does this provider need" see `registry connect`.
- **`resource`** (alias `res`) — managed cloud resources in a project.
- **`project`** (alias `proj`), **`operation`** (alias `op`), **`changeset`**
  (alias `cs`) round out the surface.

Two hot-path verbs are promoted to the top level: `opsy plan` validates the
active changeset and `opsy deploy` applies it.

A typical session:

```bash
# 1. create a project and link it to this directory
opsy project create my-app
opsy link my-app

# 2. ask the registry what AWS needs — schemas + minted helpers + skeleton
opsy registry connect aws -F json > setup.json

# 3. add a provider integration with the filled-in credentials
opsy integration create aws-prod --provider aws \
  --credentials @aws-prod.creds.json --config '{"region":"us-east-1"}'

# 4. browse types and inspect schema before creating a resource
opsy registry types aws --search bucket
opsy registry schema aws aws_s3_bucket

# 5. create a resource — the provider is inferred from the type token
opsy resource create my-bucket --type aws_s3_bucket --set bucket=my-app-bucket

# 6. inspect things
opsy resource list
opsy resource get my-bucket --detail
opsy operation list
```

Each mutation creates one operation; the CLI streams its status and prints the
terminal result. Stage related changes and roll them out together: `opsy plan`
validates the active changeset and `opsy deploy` applies it (`opsy changeset
--help` covers staging, status, and discard; `opsy cs` is the alias).

### Multiple integrations for one provider

Integrations are project-scoped and one per provider is marked default. The
default integration is what every resource for that provider routes through
unless you override it. Add another with a distinct slug (e.g. per region) and
point a single command at it with `--integration <slug>`:

```bash
opsy integration create aws-west --provider aws \
  --credentials '{"access_key":"AKIA…","secret_key":"…"}' \
  --config '{"region":"us-west-2"}'

opsy resource create bucket-west --type aws_s3_bucket \
  --set bucket=my-west-bucket --integration aws-west
```

`--integration <slug>` is accepted by `resource create`, `resource import`, and
`resource query`. To flip the project-wide default permanently, promote one
with `opsy integration update <slug> --default`.

Credentials and config are JSON (or `@file`) and validated by the provider at
plan time, so an invalid value surfaces on the first plan with the provider's
own error message. The same shape works for Cloudflare, GCP, Azure, and others.

### Connecting a provider (agent-drivable)

`opsy registry connect <provider>` is the one-shot answer to "how do I connect
this provider": it ships the credential and config JSON Schemas, the credential
modes, any onboarding metadata, the helpers it mints (e.g. assume-role external
id), and a ready-to-paste `credentials` skeleton — exactly what you need for
`--credentials` and `--config`. For static-credential providers this is the
whole flow: read the skeleton, fill the fields, `opsy integration create`.

For assume-role providers (e.g. AWS), the same command mints the artifacts for
the trust handshake in one shot:

```bash
# 1. mint the external id + trust policy (non-idempotent: fresh id per call)
opsy registry connect aws -F json > setup.json

# 2. create the IAM role out-of-band from the emitted trust policy
#    (.document) — Opsy holds no credentials in your account, so this step
#    is yours to run with your own AWS access. (.cloudformation.launchUrl is
#    a one-click alternative.)

# 3. register the integration with the SAME external id from step 1
opsy integration create aws-prod --provider aws \
  --credentials "$(jq -c '.credentials + {role_arn:"arn:aws:iam::…:role/…"}' setup.json)"
```

The external id ties the role's trust policy to this integration; reuse the one
from `registry connect` — re-running mints a new id that won't match the role.

### Machine-readable output

Every command that produces structured output supports `-F json` (or
`--format json`):

```bash
opsy project get my-app --format json
opsy project list -F json | jq '.projects[0].slug'
```

[`docs/cli-json.md`](docs/cli-json.md) is the contract for scripts and agents:
the JSON envelope each command emits, the exit-code taxonomy (branch on `$?`),
and how errors are reported.

## Project context

Most commands resolve a project. Commands pick it from, in order:

| Source | How to set it |
|---|---|
| `--project <slug>` flag | per-command override (recommended for agents/CI) |
| `OPSY_PROJECT` env (non-empty) | per-shell / CI override |
| `.opsy/project.json` link file | `opsy link <slug>` — walks up from cwd, like `git` |
| profile `project` | `opsy config set-project <slug>` (back-compat) |
| _(none)_ | error: pass `--project`, `opsy link`, or `config set-project` |

`opsy link [slug]` writes `.opsy/project.json` in the current directory (omit
the slug to pick interactively) and also writes a self-executing
`.opsy/.gitignore` (`*`), so the link never lands in version control. `opsy
unlink` removes the nearest link; `opsy status` prints the resolved
project/apiUrl/orgId and the source each value came from (and warns when a link
shadows your profile project). The upward walk means a link at a repo root
applies to every subdirectory.

```bash
opsy link my-app          # this dir → my-app
opsy status               # show resolved context + sources
opsy status -F json | jq .project
opsy unlink               # drop the nearest link
```

## Configuration

```bash
opsy config set-project my-app   # profile default project (back-compat)
opsy config view                 # show active profile, API URL, project
opsy config clear                # reset
```

| Variable | Default | Description |
|---|---|---|
| `OPSY_API_KEY` | -- | API key for CI/headless (skips browser login) |
| `OPSY_API_URL` | `https://api.opsy.sh` | API endpoint override |
| `OPSY_PROJECT` | -- | Override the active project |
| `NO_COLOR` | -- | Disable colored output (any value) |
| `FORCE_COLOR` | -- | Force colored output on non-TTY (set to non-`0`) |

Project precedence is the table under [Project context](#project-context); for
API URL and org id it is environment variable > link file > config profile >
built-in default.

## Links

- Homepage: <https://opsy.sh>
- Issues: <https://github.com/opsyhq/opsy/issues>

License: Apache-2.0
