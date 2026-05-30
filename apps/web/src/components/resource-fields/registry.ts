import {
	BoolKind,
	JsonKind,
	KvKind,
	ListKind,
	NumberKind,
	ObjectArrayKind,
	ObjectKind,
	ObjectMapKind,
	PasswordKind,
	TextKind,
} from "./kinds"
import type { FieldKind, FieldKindEntry } from "./types"

export const FIELD_KIND_REGISTRY: Record<FieldKind, FieldKindEntry> = {
	text: { kind: "text", Renderer: TextKind },
	password: { kind: "password", Renderer: PasswordKind },
	number: { kind: "number", Renderer: NumberKind },
	bool: { kind: "bool", Renderer: BoolKind },
	list: { kind: "list", Renderer: ListKind },
	kv: { kind: "kv", Renderer: KvKind },
	json: { kind: "json", Renderer: JsonKind },
	object: { kind: "object", Renderer: ObjectKind },
	"object-array": { kind: "object-array", Renderer: ObjectArrayKind },
	"object-map": { kind: "object-map", Renderer: ObjectMapKind },
}
