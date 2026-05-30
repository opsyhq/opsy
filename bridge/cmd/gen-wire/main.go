// gen-wire reads bridge/types/*.go and emits TypeScript type declarations +
// Zod schemas to stdout. Redirect to packages/bridge-client/src/wire.generated.ts.
//
// Usage (from bridge/ dir): go run ./cmd/gen-wire
// Usage (from repo root):   go run ./bridge/cmd/gen-wire bridge/types
package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"reflect"
	"sort"
	"strings"
)

// fieldInfo holds the parsed info for a single struct field.
type fieldInfo struct {
	jsonName string
	goType   string
	optional bool // true if omitempty or pointer
	nullable bool // true for non-omitempty json.RawMessage and []byte fields
}

// structInfo holds parsed info for a single exported struct.
type structInfo struct {
	name     string
	fields   []fieldInfo
	embedded []string // names of embedded structs (flattened)
	skip     bool     // true if we cannot codegen this struct
	skipNote string   // reason for skip
	// deps are the names of other structs this one directly references (for topo sort)
	deps []string
}

// knownSkip lists structs that need manual handling (mutual recursion, etc).
var knownSkip = map[string]string{
	"SchemaAttribute":   "depended on by SchemaBlock/SchemaNestedBlock — kept in wire-lazy.ts to avoid circular imports",
	"SchemaBlock":       "mutually recursive with SchemaNestedBlock — requires z.lazy()",
	"SchemaNestedBlock": "mutually recursive with SchemaBlock — requires z.lazy()",
}

func main() {
	// Accept an optional first argument to override the types dir.
	// Default is "types" (relative to cwd), so run from bridge/.
	dir := "types"
	if len(os.Args) > 1 {
		dir = os.Args[1]
	}

	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, dir, nil, parser.ParseComments)
	if err != nil {
		fmt.Fprintf(os.Stderr, "parse error: %v\n", err)
		os.Exit(1)
	}

	// Collect all exported structs in deterministic order (sorted by filename then pos).
	var structs []structInfo
	for _, pkg := range pkgs {
		var fileNames []string
		for name := range pkg.Files {
			fileNames = append(fileNames, name)
		}
		sort.Strings(fileNames)

		for _, fileName := range fileNames {
			file := pkg.Files[fileName]
			for _, decl := range file.Decls {
				gd, ok := decl.(*ast.GenDecl)
				if !ok || gd.Tok != token.TYPE {
					continue
				}
				for _, spec := range gd.Specs {
					ts, ok := spec.(*ast.TypeSpec)
					if !ok || !ts.Name.IsExported() {
						continue
					}
					st, ok := ts.Type.(*ast.StructType)
					if !ok {
						continue
					}
					si := parseStruct(ts.Name.Name, st)
					structs = append(structs, si)
				}
			}
		}
	}

	// Topologically sort so that dependencies appear before dependents.
	structs = topoSort(structs)

	// Emit output.
	out := &strings.Builder{}
	fmt.Fprintln(out, "// @generated — DO NOT EDIT. Run `make gen-wire`.")
	fmt.Fprintln(out, `import { z } from "zod"`)
	// Import the hand-written lazy schema used by ResourceSchema. The skipped
	// recursive structs stay documented below, but their schemas are not imported
	// unless a generated struct references them directly.
	fmt.Fprintf(out, "import type { SchemaBlock } from \"./wire-lazy\"\n")
	fmt.Fprintf(out, "import { SchemaBlockSchema } from \"./wire-lazy\"\n")
	fmt.Fprintln(out)

	for _, si := range structs {
		if si.skip {
			fmt.Fprintf(out, "// TODO: codegen - %s\n", si.skipNote)
			fmt.Fprintf(out, "// %sSchema and %s are hand-written in wire-lazy.ts\n\n", si.name, si.name)
			continue
		}
		emitStruct(out, si, structs)
	}

	fmt.Print(strings.TrimRight(out.String(), "\n") + "\n")
}

// parseStruct extracts field info from an ast.StructType.
func parseStruct(name string, st *ast.StructType) structInfo {
	si := structInfo{name: name}
	if note, bad := knownSkip[name]; bad {
		si.skip = true
		si.skipNote = note
		return si
	}

	for _, field := range st.Fields.List {
		// Handle embedded structs (anonymous fields).
		if len(field.Names) == 0 {
			embName := typeName(field.Type)
			if embName != "" {
				si.embedded = append(si.embedded, embName)
			}
			continue
		}

		tag := ""
		if field.Tag != nil {
			tag = field.Tag.Value
		}
		jsonName, omitempty := parseJSONTag(tag, field.Names[0].Name)
		if jsonName == "-" {
			continue
		}

		// Pointer → optional (and note the base type)
		isPtr := false
		goT := field.Type
		if star, ok := goT.(*ast.StarExpr); ok {
			isPtr = true
			goT = star.X
		}

		rawType := typeExpr(goT)

		// Determine nullable:
		// json.RawMessage (nil → JSON null) and []byte (nil → JSON null)
		// are nullable when NOT omitempty. With omitempty, nil is omitted entirely.
		nullable := false
		if !omitempty && !isPtr {
			if rawType == "json.RawMessage" || rawType == "[]byte" {
				nullable = true
			}
		}

		fi := fieldInfo{
			jsonName: jsonName,
			goType:   rawType,
			optional: omitempty || isPtr,
			nullable: nullable,
		}
		si.fields = append(si.fields, fi)

		// Record named type dependencies for topo sort.
		dep := namedTypeDep(rawType)
		if dep != "" {
			si.deps = append(si.deps, dep)
		}
	}
	return si
}

// namedTypeDep returns the named struct dependency inside a type expression, if any.
func namedTypeDep(goType string) string {
	// Strip slice/map/pointer wrappers.
	for strings.HasPrefix(goType, "[]") {
		goType = goType[2:]
	}
	if strings.HasPrefix(goType, "map[") {
		bracket := strings.Index(goType, "]")
		if bracket >= 0 {
			goType = goType[bracket+1:]
		}
	}
	for strings.HasPrefix(goType, "*") {
		goType = goType[1:]
	}
	// If it's a plain identifier (not pkg.Name, not a builtin), it's a local named type.
	if strings.Contains(goType, ".") {
		return "" // external type
	}
	switch goType {
	case "string", "bool", "int", "int8", "int16", "int32", "int64",
		"uint", "uint8", "uint16", "uint32", "uint64",
		"float32", "float64", "byte", "interface{}":
		return ""
	}
	if goType == "" {
		return ""
	}
	return goType
}

// topoSort returns structs ordered so that every dependency comes before
// the struct that references it. Cycles (e.g., SchemaBlock/SchemaNestedBlock)
// are broken by the knownSkip list which marks them as skipped before this runs.
func topoSort(structs []structInfo) []structInfo {
	// Build name → index map.
	idx := make(map[string]int, len(structs))
	for i, s := range structs {
		idx[s.name] = i
	}

	visited := make([]bool, len(structs))
	order := make([]int, 0, len(structs))

	var visit func(i int)
	visit = func(i int) {
		if visited[i] {
			return
		}
		visited[i] = true
		si := structs[i]
		// Visit embedded deps first.
		for _, emb := range si.embedded {
			if j, ok := idx[emb]; ok {
				visit(j)
			}
		}
		// Visit field type deps.
		for _, dep := range si.deps {
			if j, ok := idx[dep]; ok {
				visit(j)
			}
		}
		order = append(order, i)
	}

	for i := range structs {
		visit(i)
	}

	result := make([]structInfo, len(order))
	for k, i := range order {
		result[k] = structs[i]
	}
	return result
}

// emitStruct writes the TS type and Zod schema for a struct.
func emitStruct(out *strings.Builder, si structInfo, all []structInfo) {
	// Collect all fields: embedded first, then own.
	allFields := collectAllFields(si, all)

	// TS type
	fmt.Fprintf(out, "export type %s = {\n", si.name)
	for _, f := range allFields {
		tsT := goTypeToTS(f.goType, f.nullable)
		if f.optional {
			fmt.Fprintf(out, "\t%s?: %s\n", f.jsonName, tsT)
		} else {
			fmt.Fprintf(out, "\t%s: %s\n", f.jsonName, tsT)
		}
	}
	fmt.Fprintln(out, "}")
	fmt.Fprintln(out)

	// Zod schema
	fmt.Fprintf(out, "export const %sSchema = z.object({\n", si.name)
	for _, f := range allFields {
		zodT := goTypeToZod(f.goType, f.nullable)
		if f.optional {
			fmt.Fprintf(out, "\t%s: %s.optional(),\n", f.jsonName, zodT)
		} else {
			fmt.Fprintf(out, "\t%s: %s,\n", f.jsonName, zodT)
		}
	}
	fmt.Fprintln(out, "})")
	fmt.Fprintln(out)
}

// collectAllFields flattens embedded struct fields into the parent's field list.
func collectAllFields(si structInfo, all []structInfo) []fieldInfo {
	var result []fieldInfo
	for _, embName := range si.embedded {
		for _, other := range all {
			if other.name == embName && !other.skip {
				embedded := collectAllFields(other, all)
				result = append(result, embedded...)
				break
			}
		}
	}
	result = append(result, si.fields...)
	return result
}

// typeName returns the string name of a simple type expression (for embedded fields).
func typeName(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		return t.Sel.Name
	}
	return ""
}

// typeExpr returns a string representation of a Go type for further mapping.
func typeExpr(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		return t.Name
	case *ast.SelectorExpr:
		pkg := ""
		if id, ok := t.X.(*ast.Ident); ok {
			pkg = id.Name
		}
		return pkg + "." + t.Sel.Name
	case *ast.ArrayType:
		if t.Len == nil {
			elem := typeExpr(t.Elt)
			// Special case: []byte is its own type.
			if elem == "byte" {
				return "[]byte"
			}
			return "[]" + elem
		}
		return "[]" + typeExpr(t.Elt)
	case *ast.MapType:
		key := typeExpr(t.Key)
		val := typeExpr(t.Value)
		return "map[" + key + "]" + val
	case *ast.StarExpr:
		return "*" + typeExpr(t.X)
	case *ast.InterfaceType:
		return "interface{}"
	}
	return "unknown"
}

// parseJSONTag extracts the JSON field name and omitempty flag.
func parseJSONTag(tag, fieldName string) (name string, omitempty bool) {
	value := reflect.StructTag(strings.Trim(tag, "`")).Get("json")
	if value == "" {
		return strings.ToLower(fieldName), false
	}
	jsonName, opts, _ := strings.Cut(value, ",")
	if jsonName == "" {
		jsonName = strings.ToLower(fieldName)
	}
	for opts != "" {
		var opt string
		opt, opts, _ = strings.Cut(opts, ",")
		if opt == "omitempty" {
			omitempty = true
		}
	}
	return jsonName, omitempty
}

// goTypeToTS maps a Go type string to a TypeScript type string.
func goTypeToTS(goType string, nullable bool) string {
	base := goTypeToTSBase(goType)
	if nullable {
		return base + " | null"
	}
	return base
}

func goTypeToTSBase(goType string) string {
	switch goType {
	case "string":
		return "string"
	case "bool":
		return "boolean"
	case "int", "int8", "int16", "int32", "int64",
		"uint", "uint8", "uint16", "uint32", "uint64":
		return "number"
	case "float32", "float64":
		return "number"
	case "time.Time":
		return "string"
	case "json.RawMessage":
		return "unknown"
	case "interface{}":
		return "unknown"
	case "[]byte":
		return "string"
	}

	if strings.HasPrefix(goType, "[]") {
		inner := goType[2:]
		return goTypeToTSBase(inner) + "[]"
	}
	if strings.HasPrefix(goType, "map[") {
		rest := goType[4:]
		bracket := strings.Index(rest, "]")
		if bracket >= 0 {
			valType := rest[bracket+1:]
			return "Record<string, " + goTypeToTSBase(valType) + ">"
		}
	}
	if strings.HasPrefix(goType, "*") {
		return goTypeToTSBase(goType[1:])
	}
	return goType
}

// goTypeToZod maps a Go type string to a Zod expression string.
func goTypeToZod(goType string, nullable bool) string {
	base := goTypeToZodBase(goType)
	if nullable {
		return base + ".nullable()"
	}
	return base
}

func goTypeToZodBase(goType string) string {
	switch goType {
	case "string":
		return "z.string()"
	case "bool":
		return "z.boolean()"
	case "int", "int8", "int16", "int32", "int64",
		"uint", "uint8", "uint16", "uint32", "uint64":
		return "z.number().int()"
	case "float32", "float64":
		return "z.number()"
	case "time.Time":
		return "z.string()"
	case "json.RawMessage":
		return "z.unknown()"
	case "interface{}":
		return "z.unknown()"
	case "[]byte":
		return "z.string()"
	}

	if strings.HasPrefix(goType, "[]") {
		inner := goType[2:]
		return "z.array(" + goTypeToZodBase(inner) + ")"
	}
	if strings.HasPrefix(goType, "map[") {
		rest := goType[4:]
		bracket := strings.Index(rest, "]")
		if bracket >= 0 {
			valType := rest[bracket+1:]
			return "z.record(z.string(), " + goTypeToZodBase(valType) + ")"
		}
	}
	if strings.HasPrefix(goType, "*") {
		return goTypeToZodBase(goType[1:])
	}
	return goType + "Schema"
}
