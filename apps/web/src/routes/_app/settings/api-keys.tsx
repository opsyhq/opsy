import { useMutation, useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/EmptyState"
import { TableSkeleton } from "@/components/TableSkeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { authClient } from "@/lib/auth"
import { relativeTime } from "@/lib/utils"
import {
	apiKeysQueryOptions,
	createApiKeyMutationOptions,
	deleteApiKeyMutationOptions,
} from "./-apiKeyReactQuery"

export const Route = createFileRoute("/_app/settings/api-keys")({
	loader: ({ context }) =>
		context.queryClient.ensureQueryData(apiKeysQueryOptions()),
	component: ApiKeysPage,
	pendingComponent: () => <TableSkeleton />,
})

function ApiKeysPage() {
	const { data: org } = authClient.useActiveOrganization()
	const [newName, setNewName] = useState("")
	const [revealedKey, setRevealedKey] = useState<string | null>(null)

	const { data: keys } = useSuspenseQuery(apiKeysQueryOptions())

	const createKey = useMutation({
		...createApiKeyMutationOptions({ organizationId: org?.id }),
		onSuccess: (data) => {
			setNewName("")
			setRevealedKey(data?.key ?? null)
			toast.success("API key created")
		},
	})

	const deleteKey = useMutation({
		...deleteApiKeyMutationOptions(),
		onSuccess: () => toast.success("API key deleted"),
	})

	function handleCreate(e: React.FormEvent) {
		e.preventDefault()
		createKey.mutate(newName)
	}

	return (
		<div className="flex w-full max-w-3xl flex-col gap-6 p-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
				<p className="text-sm text-muted-foreground">
					Manage API keys for programmatic access.
				</p>
			</div>

			<form onSubmit={handleCreate} className="flex gap-2">
				<Input
					placeholder="Key name"
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					required
					className="max-w-xs"
				/>
				<Button type="submit" disabled={createKey.isPending} size="sm">
					<Plus />
					{createKey.isPending ? "Creating..." : "Create"}
				</Button>
			</form>

			{revealedKey && (
				<Alert className="border-yellow-500/50 bg-yellow-50">
					<KeyRound className="text-yellow-600" />
					<AlertTitle>Copy this key now — it won't be shown again</AlertTitle>
					<AlertDescription>
						<code className="block break-all rounded bg-yellow-100 px-2 py-1 font-mono text-xs">
							{revealedKey}
						</code>
						<div className="mt-2 flex gap-2">
							<Button
								variant="outline"
								size="xs"
								onClick={() => {
									navigator.clipboard.writeText(revealedKey)
									toast.success("Copied to clipboard")
								}}
							>
								<Copy />
								Copy
							</Button>
							<Button
								variant="ghost"
								size="xs"
								onClick={() => setRevealedKey(null)}
							>
								Dismiss
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			)}

			{keys.length === 0 && (
				<EmptyState
					icon={KeyRound}
					title="No API keys yet"
					description="Create a key to get started with the API."
				/>
			)}
			{keys.length > 0 && (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Prefix</TableHead>
							<TableHead>Created</TableHead>
							<TableHead>Last used</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{keys.map((k) => (
							<TableRow key={k.id}>
								<TableCell className="font-medium">{k.name ?? "—"}</TableCell>
								<TableCell className="font-mono text-xs">
									{k.start ?? k.prefix ?? "—"}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{k.createdAt ? relativeTime(k.createdAt) : "—"}
								</TableCell>
								<TableCell className="text-xs text-muted-foreground">
									{k.lastRequest ? relativeTime(k.lastRequest) : "—"}
								</TableCell>
								<TableCell>
									<Button
										variant="ghost"
										size="icon-xs"
										onClick={() => deleteKey.mutate(k.id)}
										disabled={deleteKey.isPending}
									>
										<Trash2 className="text-muted-foreground" />
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</div>
	)
}
