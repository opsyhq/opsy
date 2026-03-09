export const REF_GLOBAL_PATTERN = /\$\{([^}]+)\}/g;
export const VARS_REF_PATTERN = /^\$\{vars\.([A-Za-z_][A-Za-z0-9_]*)\}$/;
export const ORG_REF_PATTERN = /^\$\{org\.([A-Za-z_][A-Za-z0-9_]*)\}$/;
export const IMPORT_ALIAS_REF_PATTERN = /^\$\{import\.([a-zA-Z0-9_-]+)\}$/;
export function parseRef(rawRef) {
    const importAlias = rawRef.match(IMPORT_ALIAS_REF_PATTERN);
    if (importAlias) {
        return { kind: "import_alias", raw: rawRef, alias: importAlias[1] };
    }
    const vars = rawRef.match(VARS_REF_PATTERN);
    if (vars) {
        return { kind: "vars", raw: rawRef, key: vars[1] };
    }
    const org = rawRef.match(ORG_REF_PATTERN);
    if (org) {
        return { kind: "org", raw: rawRef, key: org[1] };
    }
    return null;
}
export function extractRefsFromValue(value) {
    const refs = [];
    const walk = (current) => {
        if (typeof current === "string") {
            const re = new RegExp(REF_GLOBAL_PATTERN.source, "g");
            let match = re.exec(current);
            while (match) {
                const parsed = parseRef(match[0]);
                if (parsed) {
                    refs.push(parsed);
                }
                match = re.exec(current);
            }
            return;
        }
        if (Array.isArray(current)) {
            for (const item of current) {
                walk(item);
            }
            return;
        }
        if (current && typeof current === "object") {
            for (const item of Object.values(current)) {
                walk(item);
            }
        }
    };
    walk(value);
    return refs;
}
//# sourceMappingURL=refs.js.map