# Opsy Domain Notes

## Mutation format

```json
{ "kind": "create", "slug": "vpc", "type": "aws:ec2/vpc:Vpc", "inputs": { "cidrBlock": "10.0.0.0/16" } }
{ "kind": "update", "slug": "api", "inputs": { "replicas": 3 }, "removeInputPaths": ["env.STRIPE_KEY"] }
{ "kind": "delete", "slug": "vpc", "recursive": true }
{ "kind": "forget", "slug": "bucket" }
{ "kind": "forget", "slug": "provider", "targetDependents": true }
{ "kind": "import", "slug": "bucket", "type": "aws:s3/bucket:Bucket", "providerId": "my-bucket" }
```

## Cross-resource refs

Use `${slug.outputField}` inside inputs. Opsy resolves refs and executes operations in dependency order.

## Groups

Use `type:"group"` to create virtual folders. Groups auto-complete on apply and cannot be imported.

## Convenience resource commands

`create resource`, `update resource`, and `delete resource` create a one-mutation change and preview it by default.

- Preview-only responses include `suggestedNextAction: { "kind": "apply_change", "shortId": "<shortId>" }`.
- Pass `autoApply: true` or `--auto-apply` to continue into apply immediately.
- If policy blocks immediate apply: response includes `approvalRequired: true` and `reviewUrl`.
- `forget resource` still creates a one-mutation change and immediately attempts apply.
- `forget` removes Opsy-managed state only. It does not call the provider delete method.
- `targetDependents` expands from the requested forget root. Derived dependents are not standalone apply targets.
