import * as React from "react";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { DetailCompositeView } from "./components/DetailCompositeView";

interface FieldPart {
    fieldname: string;
    displayname?: string;
    suffix?: string;
}

type LegacyRow = Record<string, FieldPart[]>;

interface CompositeConfig {
    source?: string;         // Source entity (defaults to target entity from context)
    sourcefield?: string;    // Join field on source entity (required when source != target)

    separator?: string;      // Separator between rows (default: "\n")
    truncateWith?: string;   // Truncation indicator (default: "...")
    top?: number;            // Max records for retrieveMultiple (default: 1)
    orderBy?: string;        // e.g. "createdon desc"

    // Recommended format
    rows?: FieldPart[][];

    // Legacy format
    fields?: LegacyRow[];

    // Template output: use {{fieldname}} placeholders
    formattedoutput?: string;

    // Auto-save after computation (default: true)
    autoSave?: boolean;

    // Environment variable name containing the actual JSON config
    EnvironmentJson?: string;
}

// Field attribute metadata type
interface AttributeMetadata {
    MaxLength?: number;
    maxLength?: number;
}

// Generic type for Dataverse records
type DataverseRecord = Record<string, unknown>;

// Type for retrieveMultipleRecords response
interface RetrieveMultipleResponse {
    entities: DataverseRecord[];
}

// Type for environment variable definition
interface EnvironmentVariableDefinition {
    environmentvariabledefinitionid: string;
    schemaname: string;
    defaultvalue?: string;
}

// Type for environment variable value
interface EnvironmentVariableValue {
    value: string;
}

export class DetailComposite implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    private notifyOutputChanged!: () => void;
    private context!: ComponentFramework.Context<IInputs>;

    private _value = "";
    private _isLoading = false;
    private _error?: string;

    private _lastConfigRaw = "__init__";
    private _lastEntityId = "__init__";
    private _lastEntityName = "__init__";
    private _requestId = 0;
    private _hasSavedOnce = false;

    // Cache for environment variable config
    private _envConfigCache = new Map<string, string>();

    /**
     * LIFECYCLE: Called once when the control is initialized.
     * Sets up the notification callback and reads the initial bound value.
     */
    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state?: ComponentFramework.Dictionary,
        container?: HTMLDivElement
    ): void {
        this.context = context;
        this.notifyOutputChanged = notifyOutputChanged;

        // Show current field value immediately before recomputation
        const valueParam = context.parameters.value as { raw?: unknown };
        const rawValue = (valueParam && typeof valueParam.raw === "string")
            ? valueParam.raw
            : "";
        this._value = rawValue ?? "";
    }

    /**
     * LIFECYCLE: Called every time any property changes or the framework needs to re-render.
     * This is the main rendering entry point.
     */
    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        this.context = context;

        const configRaw = String(context.parameters.configJson.raw ?? "");

        // Get entity ID and entity name from PCF context
        const entityId = this.getEntityIdFromContext(context);
        const entityName = this.getEntityNameFromContext(context);

        // Sync if bound value changes externally
        const boundRaw = String(context.parameters.value.raw ?? "");
        if (!this._isLoading && boundRaw !== this._value) {
            this._value = boundRaw;
        }

        const shouldRecompute =
            configRaw !== this._lastConfigRaw ||
            entityId !== this._lastEntityId ||
            entityName !== this._lastEntityName;

        if (shouldRecompute) {
            this._lastConfigRaw = configRaw;
            this._lastEntityId = entityId;
            this._lastEntityName = entityName;

            this._isLoading = true;
            this._error = undefined;

            // Request re-render to show loading state
            this.notifyOutputChanged();

            void this.computeAndSetValue(context, configRaw, entityId, entityName);
        }

        return React.createElement(DetailCompositeView, {
            value: this._value,
            isLoading: this._isLoading,
            error: this._error,
            onRefresh: () => this.handleRefresh(),
        });
    }

    /**
     * LIFECYCLE: Called by the framework to get the current output values.
     * Returns the computed composite value to be saved to the bound field.
     */
    public getOutputs(): IOutputs {
        return { value: this._value };
    }

    /**
     * LIFECYCLE: Called when the control is removed from the DOM.
     * Used for cleanup (event listeners, timers, etc.)
     */
    public destroy(): void {
        // Clear cache
        this._envConfigCache.clear();
    }

    // -------------------------
    // Refresh & Save handlers
    // -------------------------

    /**
     * Handles the refresh button click.
     * Forces recomputation by resetting the cache keys.
     */
    private handleRefresh(): void {
        // Reset cache to force recomputation
        this._lastConfigRaw = "__refresh__";
        this._lastEntityId = "__refresh__";
        this._lastEntityName = "__refresh__";
        this._hasSavedOnce = false;

        // Clear environment variable cache to force re-fetch
        this._envConfigCache.clear();

        // Trigger updateView
        this.notifyOutputChanged();
    }

    /**
     * Triggers an async save of the current record.
     * Uses Xrm.Page or formContext to save the form.
     */
    private async triggerAsyncSave(): Promise<void> {
        try {
            // Try using Xrm.Page.data.save() for model-driven apps
            const xrm = (window as unknown as { Xrm?: { Page?: { data?: { save?: () => Promise<void> } } } }).Xrm;
            if (xrm?.Page?.data?.save) {
                await xrm.Page.data.save();
                return;
            }

            // Try using formContext from navigation API
            const contextMode = this.context.mode as { 
                contextInfo?: { 
                    formContext?: { 
                        data?: { 
                            save?: () => Promise<void> 
                        } 
                    } 
                } 
            };
            const formContext = contextMode.contextInfo?.formContext;
            if (formContext?.data?.save) {
                await formContext.data.save();
                return;
            }

            // Fallback: notify output changed to let the platform handle it
            this.notifyOutputChanged();
        } catch (error) {
            console.warn("DetailComposite: Auto-save failed:", error);
        }
    }

    // -------------------------
    // Environment Variable helpers
    // -------------------------

    /**
     * Fetches the value of an environment variable from Dataverse.
     * Environment variables are stored in environmentvariabledefinition and environmentvariablevalue tables.
     */
    private async getEnvironmentVariableValue(
        context: ComponentFramework.Context<IInputs>,
        schemaName: string
    ): Promise<string | null> {
        // Check cache first
        if (this._envConfigCache.has(schemaName)) {
            return this._envConfigCache.get(schemaName) ?? null;
        }

        try {
            // Step 1: Get the environment variable definition by schema name
            const defQuery = `?$select=environmentvariabledefinitionid,schemaname,defaultvalue&$filter=schemaname eq '${schemaName}'`;
            const defResult = await context.webAPI.retrieveMultipleRecords(
                "environmentvariabledefinition",
                defQuery
            ) as RetrieveMultipleResponse;

            const definitions = defResult.entities as unknown as EnvironmentVariableDefinition[];
            if (!definitions || definitions.length === 0) {
                throw new Error(`Environment variable '${schemaName}' not found.`);
            }

            const definition = definitions[0];
            const definitionId = definition.environmentvariabledefinitionid;
            const defaultValue = definition.defaultvalue ?? "";

            // Step 2: Get the current value (if exists)
            const valQuery = `?$select=value&$filter=_environmentvariabledefinitionid_value eq ${definitionId}`;
            const valResult = await context.webAPI.retrieveMultipleRecords(
                "environmentvariablevalue",
                valQuery
            ) as RetrieveMultipleResponse;

            const values = valResult.entities as unknown as EnvironmentVariableValue[];
            
            // Use current value if exists, otherwise use default value
            const finalValue = (values && values.length > 0 && values[0].value)
                ? values[0].value
                : defaultValue;

            // Cache the result
            this._envConfigCache.set(schemaName, finalValue);

            return finalValue;
        } catch (error) {
            console.error("DetailComposite: Failed to fetch environment variable:", error);
            throw new Error(`Failed to fetch environment variable '${schemaName}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Resolves the configuration JSON.
     * If EnvironmentJson is specified, fetches the config from the environment variable.
     */
    private async resolveConfig(
        context: ComponentFramework.Context<IInputs>,
        configRaw: string
    ): Promise<CompositeConfig> {
        // First, parse the initial config to check for EnvironmentJson
        const initialConfig = this.parseConfig(configRaw);

        // If EnvironmentJson is specified, fetch the config from the environment variable
        if (initialConfig.EnvironmentJson) {
            const envSchemaName = initialConfig.EnvironmentJson.trim();
            if (!envSchemaName) {
                throw new Error("EnvironmentJson is specified but empty.");
            }

            const envConfigJson = await this.getEnvironmentVariableValue(context, envSchemaName);
            if (!envConfigJson) {
                throw new Error(`Environment variable '${envSchemaName}' has no value.`);
            }

            // Parse the environment variable JSON as the actual config
            const envConfig = this.parseConfig(envConfigJson);
            
            // Merge: environment config takes precedence, but keep autoSave from initial if not in env
            return {
                ...initialConfig,  // Keep any properties from initial config as defaults
                ...envConfig,      // Override with environment config
            };
        }

        // No EnvironmentJson, use the config as-is
        return initialConfig;
    }

    // -------------------------
    // Context helpers
    // -------------------------

    /**
     * Gets the primary key (entity ID) from PCF context.
     */
    private getEntityIdFromContext(context: ComponentFramework.Context<IInputs>): string {
        const contextInfo = (context.mode as { contextInfo?: { entityId?: string } }).contextInfo;
        if (contextInfo?.entityId) {
            return this.sanitizeGuid(contextInfo.entityId);
        }

        const page = (context as unknown as { page?: { entityId?: string } }).page;
        if (page?.entityId) {
            return this.sanitizeGuid(page.entityId);
        }

        const entityIdParam = context.parameters.entityId as { raw?: unknown } | undefined;
        if (entityIdParam?.raw && typeof entityIdParam.raw === "string") {
            return this.sanitizeGuid(entityIdParam.raw);
        }

        return "";
    }

    /**
     * Gets the entity logical name from PCF context.
     */
    private getEntityNameFromContext(context: ComponentFramework.Context<IInputs>): string {
        const contextInfo = (context.mode as { contextInfo?: { entityTypeName?: string } }).contextInfo;
        if (contextInfo?.entityTypeName) {
            return contextInfo.entityTypeName.toLowerCase();
        }

        const page = (context as unknown as { page?: { entityTypeName?: string } }).page;
        if (page?.entityTypeName) {
            return page.entityTypeName.toLowerCase();
        }

        const entityNameParam = context.parameters.entityName as { raw?: unknown } | undefined;
        if (entityNameParam?.raw && typeof entityNameParam.raw === "string") {
            return entityNameParam.raw.toLowerCase();
        }

        return "";
    }

    // -------------------------
    // Core logic
    // -------------------------

    /**
     * Main computation function.
     * Fetches data from Dataverse, builds the composite string, and triggers save.
     */
    private async computeAndSetValue(
        context: ComponentFramework.Context<IInputs>,
        configRaw: string,
        entityId: string,
        entityName: string
    ): Promise<void> {
        const requestId = ++this._requestId;

        try {
            if (!configRaw?.trim()) {
                throw new Error("configJson is empty: paste a JSON configuration in the control properties.");
            }
            if (!entityId?.trim()) {
                throw new Error("Entity ID not available from context. Ensure the control is placed on a form.");
            }
            if (!entityName?.trim()) {
                throw new Error("Entity name not available from context. Ensure the control is placed on a form.");
            }

            // Resolve config (may fetch from environment variable)
            const config = await this.resolveConfig(context, configRaw);

            // Target entity is always from context
            const target = entityName.toLowerCase();
            // Source entity defaults to target if not specified
            const source = (config.source ?? target).toLowerCase();
            const separator = config.separator ?? "\n";
            const truncateWith = config.truncateWith ?? "...";
            const autoSave = config.autoSave !== false; // Default: true

            const rows = this.normalizeRows(config);

            // Collect all field names needed (from rows and formattedoutput template)
            const fieldsFromRows = rows.flat().map(p => p.fieldname).filter(Boolean);
            const fieldsFromTemplate = this.extractFieldsFromTemplate(config.formattedoutput);
            const allFields = this.unique([...fieldsFromRows, ...fieldsFromTemplate]);

            if (allFields.length === 0) {
                throw new Error("No field names found: use 'rows' or 'formattedoutput' with {{fieldname}} placeholders.");
            }

            let record: DataverseRecord | null = null;

            if (source === target) {
                // Same entity: retrieve single record using primary key from context
                const query = `?$select=${allFields.join(",")}`;
                record = await context.webAPI.retrieveRecord(source, entityId, query) as DataverseRecord;
            } else {
                // Different source entity: use sourcefield as join key
                if (!config.sourcefield) {
                    throw new Error("sourcefield is required when source entity differs from target.");
                }

                const filterExpr = `${config.sourcefield} eq ${this.toODataLiteral(entityId)}`;
                const filterParam = encodeURIComponent(filterExpr);

                let query = `?$select=${allFields.join(",")}&$filter=${filterParam}`;

                if (config.orderBy) {
                    query += `&$orderby=${encodeURIComponent(config.orderBy)}`;
                }

                const top = config.top ?? 1;
                query += `&$top=${top}`;

                const res = await context.webAPI.retrieveMultipleRecords(source, query) as RetrieveMultipleResponse;
                const entities = res.entities ?? [];
                record = entities[0] ?? null;
            }

            const maxLen = this.getMaxLen(context);

            let composite = "";
            if (record) {
                if (config.formattedoutput) {
                    composite = this.buildFromTemplate(record, config.formattedoutput, rows);
                } else {
                    composite = this.buildComposite(record, rows, separator);
                }
            }

            composite = this.truncate(composite, maxLen, truncateWith);

            // Discard stale responses if context changed
            if (requestId !== this._requestId) return;

            // Check if value actually changed
            const valueChanged = this._value !== composite;
            
            this._value = composite;
            this._isLoading = false;
            this._error = undefined;
            this.notifyOutputChanged();

            // Trigger async save if value changed and autoSave is enabled
            if (valueChanged && autoSave && !this._hasSavedOnce) {
                this._hasSavedOnce = true;
                // Small delay to ensure the output is registered
                setTimeout(() => {
                    void this.triggerAsyncSave();
                }, 500);
            }
        } catch (e: unknown) {
            if (requestId !== this._requestId) return;

            this._isLoading = false;
            this._error = e instanceof Error ? e.message : String(e);
            this.notifyOutputChanged();
        }
    }

    private parseConfig(raw: string): CompositeConfig {
        try {
            return JSON.parse(raw) as CompositeConfig;
        } catch {
            throw new Error("configJson is not valid JSON (JSON.parse failed).");
        }
    }

    /**
     * Extracts field names from a template string.
     */
    private extractFieldsFromTemplate(template?: string): string[] {
        if (!template) return [];
        const regex = /\{\{(\w+)\}\}/g;
        const fields: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = regex.exec(template)) !== null) {
            fields.push(match[1]);
        }
        return fields;
    }

    /**
     * Builds output from template string.
     */
    private buildFromTemplate(record: DataverseRecord, template: string, rows: FieldPart[][]): string {
        const fieldPartMap = new Map<string, FieldPart>();
        for (const row of rows) {
            for (const part of row) {
                if (part.fieldname) {
                    fieldPartMap.set(part.fieldname, part);
                }
            }
        }

        return template.replace(/\{\{(\w+)\}\}/g, (_, fieldname: string) => {
            const value = this.getFieldValue(record, fieldname);
            if (!value) return "";

            const part = fieldPartMap.get(fieldname);
            const displayname = part?.displayname ?? "";
            const suffix = part?.suffix ?? "";

            return `${displayname}${value}${suffix}`;
        });
    }

    /**
     * Normalizes rows configuration.
     */
    private normalizeRows(config: CompositeConfig): FieldPart[][] {
        if (Array.isArray(config.rows) && config.rows.length > 0) {
            return config.rows;
        }

        if (Array.isArray(config.fields) && config.fields.length > 0) {
            const rows: FieldPart[][] = [];

            for (const legacy of config.fields) {
                if (!legacy || typeof legacy !== "object") continue;

                const parts: FieldPart[] = [];
                for (const k of Object.keys(legacy)) {
                    const arr = legacy[k];
                    if (!Array.isArray(arr) || arr.length === 0) continue;

                    const item: FieldPart = arr[0];
                    parts.push({
                        fieldname: item.fieldname ?? "",
                        displayname: item.displayname ?? "",
                        suffix: item.suffix ?? "",
                    });
                }
                if (parts.length > 0) rows.push(parts);
            }

            return rows;
        }

        return [];
    }

    /**
     * Builds composite string from rows.
     */
    private buildComposite(record: DataverseRecord, rows: FieldPart[][], separator: string): string {
        const lines: string[] = [];

        for (const row of rows) {
            let line = "";

            for (const part of row) {
                if (!part?.fieldname) continue;

                const value = this.getFieldValue(record, part.fieldname);
                if (!value) continue;

                const display = part.displayname ?? "";
                const suffix = part.suffix ?? "";

                line += `${display}${value}${suffix}`;
            }

            if (line.trim().length > 0) {
                lines.push(line);
            }
        }

        return lines.join(separator);
    }

    /**
     * Safely converts an unknown value to string.
     */
    private safeStringify(value: unknown): string {
        if (value === undefined || value === null) return "";
        if (typeof value === "string") return value;
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        if (Array.isArray(value)) {
            return value.map((v: unknown) => this.safeStringify(v)).join(", ");
        }
        if (typeof value === "object") {
            try {
                return JSON.stringify(value);
            } catch {
                return "[object]";
            }
        }
        try {
            return JSON.stringify(value);
        } catch {
            return "[unknown]";
        }
    }

    /**
     * Gets field value from record.
     */
    private getFieldValue(record: DataverseRecord, fieldLogicalName: string): string {
        if (!record) return "";

        const formattedKey = `${fieldLogicalName}@OData.Community.Display.V1.FormattedValue`;
        const formatted = record[formattedKey];
        if (formatted !== undefined && formatted !== null) {
            return this.safeStringify(formatted);
        }

        const raw = record[fieldLogicalName];
        if (raw === undefined || raw === null) return "";

        return this.safeStringify(raw);
    }

    /**
     * Gets max length of target field.
     */
    private getMaxLen(context: ComponentFramework.Context<IInputs>): number | undefined {
        const valueParam = context.parameters.value as { attributes?: AttributeMetadata };
        const attrs = valueParam.attributes;
        const max = attrs?.MaxLength ?? attrs?.maxLength;
        if (typeof max === "number" && max > 0) return max;
        return undefined;
    }

    /**
     * Truncates text to max length.
     */
    private truncate(text: string, maxLen?: number, indicator = "..."): string {
        if (!maxLen || maxLen <= 0) return text;
        if (text.length <= maxLen) return text;

        if (maxLen <= indicator.length) return indicator.slice(0, maxLen);
        return text.slice(0, maxLen - indicator.length) + indicator;
    }

    private unique(items: string[]): string[] {
        return Array.from(new Set(items));
    }

    private sanitizeGuid(id: string): string {
        return id.replace(/[{}]/g, "");
    }

    private isGuid(value: string): boolean {
        const v = value.replace(/[{}]/g, "");
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
    }

    private toODataLiteral(value: string): string {
        const trimmed = value.trim();
        if (this.isGuid(trimmed)) return this.sanitizeGuid(trimmed);

        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed;

        const escaped = trimmed.replace(/'/g, "''");
        return `'${escaped}'`;
    }
}
