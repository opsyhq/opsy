export declare const REF_GLOBAL_PATTERN: RegExp;
export declare const VARS_REF_PATTERN: RegExp;
export declare const ORG_REF_PATTERN: RegExp;
export declare const IMPORT_ALIAS_REF_PATTERN: RegExp;
export type VarsRef = {
    kind: "vars";
    raw: string;
    key: string;
};
export type OrgRef = {
    kind: "org";
    raw: string;
    key: string;
};
export type ImportAliasRef = {
    kind: "import_alias";
    raw: string;
    alias: string;
};
export type ParsedRef = VarsRef | OrgRef | ImportAliasRef;
export declare function parseRef(rawRef: string): ParsedRef | null;
export declare function extractRefsFromValue(value: unknown): ParsedRef[];
//# sourceMappingURL=refs.d.ts.map