"use client"

import { Autocomplete as AutocompletePrimitive } from "@base-ui/react/autocomplete"
import { ChevronDownIcon, XIcon } from "lucide-react"
import * as React from "react"
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

const Autocomplete = AutocompletePrimitive.Root

function AutocompleteTrigger({
	className,
	children,
	...props
}: AutocompletePrimitive.Trigger.Props) {
	return (
		<AutocompletePrimitive.Trigger
			data-slot="autocomplete-trigger"
			className={cn("[&_svg:not([class*='size-'])]:size-4", className)}
			{...props}
		>
			{children}
			<ChevronDownIcon
				data-slot="autocomplete-trigger-icon"
				className="pointer-events-none size-4 text-muted-foreground"
			/>
		</AutocompletePrimitive.Trigger>
	)
}

function AutocompleteClear({
	className,
	...props
}: AutocompletePrimitive.Clear.Props) {
	return (
		<AutocompletePrimitive.Clear
			data-slot="autocomplete-clear"
			render={<InputGroupButton variant="ghost" size="icon-xs" />}
			className={cn(className)}
			{...props}
		>
			<XIcon className="pointer-events-none" />
		</AutocompletePrimitive.Clear>
	)
}

function AutocompleteInput({
	className,
	children,
	disabled = false,
	showTrigger = false,
	showClear = false,
	...props
}: AutocompletePrimitive.Input.Props & {
	showTrigger?: boolean
	showClear?: boolean
}) {
	return (
		<InputGroup className={cn("w-auto", className)}>
			<AutocompletePrimitive.Input
				render={<InputGroupInput disabled={disabled} />}
				{...props}
			/>
			{(showTrigger || showClear) && (
				<InputGroupAddon align="inline-end">
					{showTrigger && (
						<InputGroupButton
							size="icon-xs"
							variant="ghost"
							asChild
							data-slot="input-group-button"
							className="group-has-data-[slot=autocomplete-clear]/input-group:hidden data-pressed:bg-transparent"
							disabled={disabled}
						>
							<AutocompleteTrigger />
						</InputGroupButton>
					)}
					{showClear && <AutocompleteClear disabled={disabled} />}
				</InputGroupAddon>
			)}
			{children}
		</InputGroup>
	)
}

function AutocompleteContent({
	className,
	side = "bottom",
	sideOffset = 0,
	align = "start",
	alignOffset = 0,
	anchor,
	...props
}: AutocompletePrimitive.Popup.Props &
	Pick<
		AutocompletePrimitive.Positioner.Props,
		"side" | "align" | "sideOffset" | "alignOffset" | "anchor"
	>) {
	return (
		<AutocompletePrimitive.Portal>
			<AutocompletePrimitive.Positioner
				side={side}
				sideOffset={sideOffset}
				align={align}
				alignOffset={alignOffset}
				anchor={anchor}
				className="isolate z-50"
			>
				<AutocompletePrimitive.Popup
					data-slot="autocomplete-content"
					className={cn(
						"group/autocomplete-content relative max-h-96 w-(--anchor-width) max-w-(--available-width) min-w-(--anchor-width) origin-(--transform-origin) overflow-hidden rounded-lg border border-input bg-background text-popover-foreground shadow-sm duration-100 data-[side=bottom]:rounded-t-none data-[side=bottom]:border-t-0 data-[side=top]:rounded-b-none data-[side=top]:border-b-0 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
						className,
					)}
					{...props}
				/>
			</AutocompletePrimitive.Positioner>
		</AutocompletePrimitive.Portal>
	)
}

function AutocompleteList({
	className,
	...props
}: AutocompletePrimitive.List.Props) {
	return (
		<AutocompletePrimitive.List
			data-slot="autocomplete-list"
			className={cn(
				"max-h-[min(calc(--spacing(96)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto",
				className,
			)}
			{...props}
		/>
	)
}

function AutocompleteItem({
	className,
	children,
	...props
}: AutocompletePrimitive.Item.Props) {
	return (
		<AutocompletePrimitive.Item
			data-slot="autocomplete-item"
			className={cn(
				"relative flex min-h-9 w-full cursor-default items-center gap-2 px-3 text-sm outline-hidden select-none data-highlighted:bg-accent/60 data-highlighted:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		>
			{children}
		</AutocompletePrimitive.Item>
	)
}

function AutocompleteGroup({
	className,
	...props
}: AutocompletePrimitive.Group.Props) {
	return (
		<AutocompletePrimitive.Group
			data-slot="autocomplete-group"
			className={cn(className)}
			{...props}
		/>
	)
}

function AutocompleteGroupLabel({
	className,
	...props
}: AutocompletePrimitive.GroupLabel.Props) {
	return (
		<AutocompletePrimitive.GroupLabel
			data-slot="autocomplete-group-label"
			className={cn(
				"px-2 py-1.5 text-xs text-muted-foreground pointer-coarse:px-3 pointer-coarse:py-2 pointer-coarse:text-sm",
				className,
			)}
			{...props}
		/>
	)
}

function AutocompleteCollection({
	...props
}: AutocompletePrimitive.Collection.Props) {
	return (
		<AutocompletePrimitive.Collection
			data-slot="autocomplete-collection"
			{...props}
		/>
	)
}

function AutocompleteEmpty({
	className,
	...props
}: AutocompletePrimitive.Empty.Props) {
	return (
		<AutocompletePrimitive.Empty
			data-slot="autocomplete-empty"
			className={cn(
				"hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/autocomplete-content:flex",
				className,
			)}
			{...props}
		/>
	)
}

function AutocompleteSeparator({
	className,
	...props
}: AutocompletePrimitive.Separator.Props) {
	return (
		<AutocompletePrimitive.Separator
			data-slot="autocomplete-separator"
			className={cn("-mx-1 my-1 h-px bg-border", className)}
			{...props}
		/>
	)
}

function useAutocompleteAnchor() {
	return React.useRef<HTMLDivElement | null>(null)
}

export {
	Autocomplete,
	AutocompleteCollection,
	AutocompleteContent,
	AutocompleteEmpty,
	AutocompleteGroup,
	AutocompleteGroupLabel,
	AutocompleteInput,
	AutocompleteItem,
	AutocompleteList,
	AutocompleteSeparator,
	AutocompleteTrigger,
	useAutocompleteAnchor,
}
