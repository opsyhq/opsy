# Thinking Blocks

A Thinking Block is a reusable unit of product thinking.

It takes an input, reasons about it with a mix of code and AI, validates the
result, and turns the accepted result into a durable artifact that the product
can use again.

Think of it as:

```txt
function + AI agent + validation + memory + artifact + trace
```

or, more plainly:

> A Thinking Block is a named capability that knows how to produce one kind of
> useful product knowledge.

In Opsy, examples are:

- Find the right logo for a provider or resource.
- Curate fields from a provider schema.
- Generate relationship rules between resources.
- Generate create, update, delete, list, sensor, and command flows.

Outside Opsy, the same idea could power:

- Calorie counting from non-curated meal data.
- Airport walking-time maps from messy terminal data.
- Travel rule extraction from fare documents.
- Product catalog enrichment.
- Contract clause extraction.

The point is not "call an LLM." The point is to make AI-generated product
knowledge reusable, inspectable, invalidatable, and safe enough to build on.

## The Core Idea

Most AI calls are disposable:

```txt
prompt -> model -> response
```

That is fine for chat. It is weak for product systems.

Product systems need answers to questions like:

- What exact input produced this output?
- Did we already compute this?
- Which model calls happened?
- How many candidate outputs were produced?
- Did a judge or validator reject anything?
- Which version of the thinking produced the current product state?
- Can we invalidate this result and regenerate it?
- Can many callers reuse the same result without each hand-rolling cache logic?

A Thinking Block answers those questions by making the AI work itself a product
primitive.

```txt
input
  -> identity
  -> existing artifact, if one is valid
  -> generate
  -> validate / judge
  -> retry with feedback, if needed
  -> record telemetry
  -> expose artifact to the product
```

## Non-Technical Explanation

Imagine your product has a specialist sitting behind the scenes.

You can ask:

> "Given this cloud resource schema, decide which fields matter for the create
> form."

The specialist does not improvise from scratch every time. It follows a known
playbook:

- Recognize what exact thing is being asked.
- Reuse the previous accepted answer when it still applies.
- If there is no accepted answer, generate one.
- Check the answer.
- Ask a judge when quality is fuzzy.
- Try again when the judge gives useful feedback.
- Save the accepted answer.
- Keep receipts for every step.

That specialist is a Thinking Block.

The saved answer is an artifact.

The receipts are the artifact, run, model call, validation result, and current
artifact phase.

## Why This Exists

AI in products usually starts as scattered calls:

```ts
await generateObject(...)
await generateText(...)
await callModel(...)
```

That works until the same pattern appears everywhere:

- Build the prompt.
- Pick the model.
- Remember inputs.
- Store outputs.
- Avoid regenerating.
- Retry.
- Judge.
- Repair.
- Debug failures.
- Track token usage.
- Show progress.
- Invalidate stale results.

If every feature hand-rolls that loop, the product becomes hard to reason about.

Thinking Blocks make that loop explicit and reusable.

## What A Thinking Block Owns

A Thinking Block should own the full thinking lifecycle:

- The block name and version.
- The input contract.
- The identity of the thing being produced.
- The AI agent or model configuration used to produce it.
- Prompt construction.
- Retry policy.
- Validation and judge steps.
- Artifact commit and read projection.
- Artifact lifecycle.
- Model-call telemetry.
- Validation telemetry.
- Rejection and failure records.
- Invalidation and audit history.

The caller should not have to know how many prompts, model calls, retries,
judges, or repair attempts happen inside.

The caller should be able to say:

```ts
const logo = await logoThinkingBlock.get(input)
const fieldMetadata = await resourceFieldMetadataBlock.get(input)
const flow = await createFlowThinkingBlock.get(input)
```

That is the shape: ask for the capability, not the plumbing.

## What The App Owns

The application still owns product meaning.

For Opsy, the app owns concepts like:

- Provider.
- Resource type.
- Resource schema.
- Logo.
- Field metadata.
- Relationship rule.
- Create flow.
- Review status.
- User edits.

The Thinking Block runtime should not know what a provider schema is. It should
only know how to run a named block, identify an artifact, validate output, and
record what happened.

Domain-specific helpers belong outside the generic package.

```txt
@opsy/thinking-blocks
  generic runtime

apps/api/src/thinking-blocks
  Opsy store, routes, identity helpers

apps/api/src/resources/types
  resource type metadata blocks

apps/api/src/capabilities
  relationship rule discovery block and artifact adapter
```

## Mental Model

A Thinking Block is close to a pure function, but the body can think.

```txt
output = block.get(input)
```

Like a function:

- It has a name.
- It has input.
- It has output.
- It should be reusable.

Unlike a normal function:

- It may call a model.
- It may be probabilistic.
- It may need a judge.
- It may retry.
- It may create a durable artifact.
- It needs traceability.

Like a cache:

- The same identity can reuse existing output.

Unlike a basic cache:

- The output is product state, not just an optimization.
- It has versions, lineage, validation, rejection, and audit history.

Like an agent:

- It can use tools and multiple model steps.

Unlike a generic agent:

- It is not an open-ended conversation.
- It has a typed product output.
- It has a stable identity.
- It has lifecycle and invalidation.

## `get` vs `generate`

The normal product operation is `get`.

```ts
const result = await block.get(input)
```

`get` means:

> Give me the current accepted artifact for this input, generating it if needed.

`generate` means:

```ts
const result = await block.generate(input)
```

> Force a new run and produce a new artifact.

This distinction matters because most product callers do not want "call an LLM."
They want "give me the logo" or "give me the curated fields."

## Artifact Lifecycle

A Thinking Block produces artifacts.

Artifacts can be:

- `pending`: the block is working.
- `ready`: output passed and is usable.
- `rejected`: the block ran correctly, but validation rejected the output.
- `failed`: something broke, such as provider, database, schema, or runtime error.
- `superseded`: a newer artifact replaced this one.

Rejected is not failed.

Rejected means the block did its job and decided the output was not good enough.
Failed means the system could not complete the work.

That distinction is important for product quality, retries, and debugging.

## Validation

Validation is part of the block, not something every caller should remember to
run.

There are two broad kinds:

```ts
check("has-fields", ...)
judge("quality", ...)
```

`check` is deterministic code.

Examples:

- Output has at least one field.
- Candidate relationship paths exist in the schema.
- Logo name exists in the icon manifest.
- Generated flow has required steps.

`judge` is model-based validation.

Examples:

- Are these field labels useful for a human create form?
- Are these relationship rules semantically plausible?
- Does this generated flow actually satisfy the requested operation?

Validators can produce feedback. Feedback becomes input to the next attempt.

```txt
generate -> judge rejects -> generate with feedback -> judge accepts
```

## Identity

Identity defines what "the same work" means.

For a logo block, identity might be:

```txt
provider + resource type
```

For a field curation block, identity might be:

```txt
provider + resource kind + resource type + schema hash
```

For a meal nutrition block, identity might be:

```txt
photo hash
```

Identity is not business logic by itself. It is the block's cache and artifact
boundary.

Good identity is stable and product-shaped.

Bad identity includes request ids, timestamps, UI state, or random caller
details.

## Artifact Adapters

The generic runtime should not know where product state lives.

That is what an artifact adapter is for.

The Thinking Block runtime says:

> This artifact was accepted.

The adapter says:

> Here is how accepted output becomes product state in this app.

For example:

- Logo block writes to a logo mapping table or returns JSON directly.
- Resource field metadata can be read directly from accepted artifacts.
- Relationship discovery can be read directly from accepted artifacts.
- Flow generation writes to generated flow definitions.

The adapter is also how cache hits stay honest. On `get`, the runtime finds a
ready artifact, then asks the adapter to read the current product output for
that artifact. If the product rows are missing or stale, the adapter returns
`null` and the block regenerates.

## Telemetry

Thinking Blocks should make telemetry automatic.

Useful questions should be answerable without adding one-off logging to every
feature:

- How many times did this block run?
- Which inputs are producing rejections?
- Which model was used?
- How many model calls did one artifact need?
- How many outputs were produced?
- Which validators failed?
- What feedback caused a retry?
- What phase is the current artifact in?
- Which artifact is currently active?
- Which artifact superseded it?

This is why Thinking Blocks are more than wrappers. The telemetry is attached to
the product capability, not scattered across model calls.

## Difference From A Tool-Calling Agent

A tool-calling agent is a way to execute reasoning.

A Thinking Block is a way to productize reasoning.

The agent answers:

> How does the model think and act during this run?

The Thinking Block answers:

> What reusable product artifact is this run supposed to produce, how do we know
> it is valid, how do we reuse it, and how do we inspect its history?

So a Thinking Block may contain an agent. It is not the same thing as an agent.

## Difference From A Workflow

A workflow coordinates steps.

A Thinking Block defines a reusable thinking capability.

Workflows are usually about process:

```txt
do A, then B, then C
```

Thinking Blocks are about product knowledge:

```txt
given this input, produce and maintain this artifact
```

A workflow may call a Thinking Block. A Thinking Block may internally have
multiple generation and validation steps. They solve different problems.

## Example Shape

```ts
const logoThinkingBlock = new ThinkingBlock({
  name: "logo-finder",
  agent: logoAgent,
  store: thinkingBlockStore,
  input: logoInputSchema,
  version: "v1",
  instructions: "Find the canonical product logo for the supplied provider resource.",
  identity: (input) => `${input.provider}:${input.resourceType}`,
  prepareCall: ({ input }) => ({ prompt: buildLogoPrompt(input) }),
  validators: [
    check("known-logo", {
      validate: ({ output }) =>
        isKnownLogo(output.logo)
          ? { success: true }
          : {
              success: false,
              feedback: {
                reason: "unknown_logo",
                logo: output.logo,
              },
            },
    }),
  ],
  artifact: logoArtifact(),
})

const result = await logoThinkingBlock.get({
  provider: "aws",
  resourceType: "aws_s3_bucket",
})
```

The caller does not pass a model, prompt, telemetry record, cache key, retry
loop, or judge wiring. Those are block internals.

`prepareCall` is the only dynamic call-building hook. Reusable system text lives
on `instructions`; `prepareCall` returns `{ prompt, options?: unknown }` or
`{ messages, options?: unknown }`, where `options` is only for real agent call
options such as dynamic tools.

## Example: Resource Type Curation

The resource type curation block answers:

> Given a provider schema for a resource type, what should Opsy know in order to
> render a good create form?

It may produce:

- Human-friendly resource name.
- Icon.
- Display tier.
- Help text.

Many parts of the product can ask for those artifacts. They should not each call
an LLM or know how curation works.

```ts
const fieldMetadata = await resourceFieldMetadataBlock.get(input)
```

## Example: Relationship Rule Discovery

The relationship rule discovery block answers:

> Given one resource schema and provider context, what reusable relationship
> rules can we infer?

It may:

- Generate candidate rules.
- Validate paths against schemas.
- Ask a judge whether rules are semantically plausible.
- Retry with judge feedback.
- Commit accepted rules into the relationship rule table.
- Record validator results, rejection state, and judge feedback.

The caller gets a `ThinkingBlockResult` with the accepted `output` and
`artifactId`. The block owns the reasoning trail.

## When To Use A Thinking Block

Use one when the output is:

- Reusable.
- Generated or assisted by AI.
- Important to product behavior.
- Worth validating.
- Worth caching or versioning.
- Worth inspecting later.
- Something multiple callers may need.

Good candidates:

- Logo resolution.
- Field curation.
- Relationship discovery.
- Flow generation.
- Entity extraction that becomes product data.
- Classification used by product behavior.
- Summaries that become durable records.

Poor candidates:

- One-off chat completions.
- Cheap deterministic transforms.
- Temporary UI copy.
- Model calls whose output is never reused.
- Internal helpers that do not produce product knowledge.

## Design Principles

- The block owns model generation. Callers should not pass prompts and model
  options every time.
- The block owns validation. Callers should not remember quality gates.
- The block owns artifact lifecycle. Product code should not hand-roll pending,
  ready, rejected, failed, and superseded state everywhere.
- The block owns telemetry. Model-call records should be attached to the
  capability that produced them.
- The app owns domain semantics. Generic Thinking Blocks should not know what an
  Opsy provider schema is.
- Identity should be product-shaped, not request-shaped.
- `get` should feel like asking for a capability result, not calling a model.
- Rejection is a valid outcome. Failure is an operational problem.
- The artifact is not just cache. It is the durable output of thinking.

## One-Sentence Definition

A Thinking Block is a typed, observable, reusable product capability that uses
AI and code to produce a durable artifact.

That is the whole thing.
