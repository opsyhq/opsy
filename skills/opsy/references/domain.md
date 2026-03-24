# Opsy Domain Notes

## Mutation format

```json
{ "kind": "create", "slug": "vpc", "type": "aws:ec2/vpc:Vpc", "inputs": { "cidrBlock": "10.0.0.0/16" } }
{ "kind": "update", "slug": "api", "inputs": { "replicas": 3 }, "removeInputPaths": ["env.STRIPE_KEY"] }
{ "kind": "delete", "slug": "vpc", "recursive": true }
{ "kind": "import", "slug": "bucket", "type": "aws:s3/bucket:Bucket", "cloudId": "my-bucket" }
```

## Cross-resource refs

Use `${slug.outputField}` inside inputs. Opsy resolves refs and executes operations in dependency order.

## Groups

Use `type:"group"` to create virtual folders. Groups auto-complete on apply, cannot be imported, and cannot be forgotten.

## Convenience resource commands

`create resource`, `update resource`, and `delete resource` create a one-mutation change and immediately attempt apply.

- If policy allows apply: response includes the applied change result.
- If policy blocks apply: response includes `approvalRequired: true` and `reviewUrl`.
