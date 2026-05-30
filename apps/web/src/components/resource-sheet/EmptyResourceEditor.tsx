import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { useRef } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { renderTaggedError } from "@/errors/error-toast"
import {
	type ChangeSetItem,
	changesRecord,
	updateChangeSetItemMutationOptions,
} from "@/lib/changeSetReactQuery"
import { queryClient } from "@/lib/query"
import {
	type EmptyResourceForm,
	emptyResourceFormSchema,
	slugifyName,
} from "./shared"

export function EmptyResourceEditor({
	projectSlug,
	changeSetId,
	stagedItem,
	onClose,
}: {
	projectSlug: string
	changeSetId?: string | null
	stagedItem: ChangeSetItem
	onClose: () => void
}) {
	const initialChanges = changesRecord(stagedItem)
	const form = useForm<EmptyResourceForm>({
		resolver: zodResolver(emptyResourceFormSchema),
		defaultValues: {
			slug: typeof initialChanges.slug === "string" ? initialChanges.slug : "",
			displayName:
				typeof initialChanges.displayName === "string"
					? initialChanges.displayName
					: "",
		},
		mode: "onChange",
	})
	const slugTouchedRef = useRef(false)
	const updateMutation = useMutation({
		...updateChangeSetItemMutationOptions({
			projectSlug,
			id: changeSetId ?? "",
			queryClient,
		}),
		onSuccess: () => {
			toast.success("Resource updated")
			onClose()
		},
		onError: (e) => renderTaggedError(toast, e),
	})

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit((data) => {
					const changes = {
						slug: data.slug,
						displayName: data.displayName?.trim() || undefined,
					}
					if (stagedItem.kind === "create_resource") {
						updateMutation.mutate({
							itemId: stagedItem.id,
							body: { kind: "create_resource", changes },
						})
						return
					}
					if (stagedItem.kind === "import_resource") {
						updateMutation.mutate({
							itemId: stagedItem.id,
							body: { kind: "import_resource", changes },
						})
					}
				})}
				className="flex h-full flex-col"
			>
				<header className="flex flex-col gap-1.5 px-4 pb-4">
					<h2 className="font-semibold text-foreground">Empty resource</h2>
					<p className="text-sm text-muted-foreground">
						Configure this resource before applying changes.
					</p>
				</header>

				<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
					<FormField
						control={form.control}
						name="displayName"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Name</FormLabel>
								<FormControl>
									<Input
										placeholder="Engineering"
										{...field}
										onChange={(e) => {
											const next = e.target.value
											field.onChange(next)
											if (!slugTouchedRef.current) {
												form.setValue("slug", slugifyName(next), {
													shouldValidate: true,
												})
											}
										}}
									/>
								</FormControl>
								<FormDescription className="text-xs text-muted-foreground/70">
									Optional friendly label for the canvas node.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name="slug"
						render={({ field }) => (
							<FormItem>
								<FormLabel>Slug</FormLabel>
								<FormControl>
									<Input
										placeholder="engineering"
										{...field}
										onChange={(e) => {
											slugTouchedRef.current = true
											field.onChange(e.target.value)
										}}
									/>
								</FormControl>
								<FormDescription className="text-xs text-muted-foreground/70">
									Lowercase letters, digits, and hyphens. Must be unique within
									the project.
								</FormDescription>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>

				<footer className="mt-auto flex flex-row items-center justify-between gap-2 border-t px-4 py-2.5">
					<Button
						type="button"
						variant="outline"
						size="xs"
						className="h-7 px-3"
						onClick={onClose}
					>
						Cancel
					</Button>
					<div className="flex items-center justify-end gap-2">
						<Button
							type="submit"
							size="xs"
							className="h-7 px-3"
							disabled={updateMutation.isPending}
						>
							{updateMutation.isPending ? "Saving..." : "Save"}
						</Button>
					</div>
				</footer>
			</form>
		</Form>
	)
}
