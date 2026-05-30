package provider

// v5adapter implements tfprotov5.ProviderServer by wrapping a tfplugin5.ProviderClient
// (the raw gRPC client generated from the Terraform plugin protocol v5 proto file).
//
// This is the client-side mirror of tf5server.GRPCProviderPlugin, which only
// implements the server side. All conversions are inlined because the upstream
// fromproto/toproto packages are internal.

import (
	"context"

	"github.com/hashicorp/terraform-plugin-go/tfprotov5"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
	"github.com/opsydev/opsy/bridge/internal/tfplugin5"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type v5Adapter struct {
	client tfplugin5.ProviderClient
}

// ---- DynamicValue ----

func dvToProto(dv *tfprotov5.DynamicValue) *tfplugin5.DynamicValue {
	if dv == nil {
		return nil
	}
	return &tfplugin5.DynamicValue{Msgpack: dv.MsgPack, Json: dv.JSON}
}

func dvFromProto(dv *tfplugin5.DynamicValue) *tfprotov5.DynamicValue {
	if dv == nil {
		return nil
	}
	return &tfprotov5.DynamicValue{MsgPack: dv.Msgpack, JSON: dv.Json}
}

// ---- ResourceIdentityData ----

func identityToProto(id *tfprotov5.ResourceIdentityData) *tfplugin5.ResourceIdentityData {
	if id == nil {
		return nil
	}
	return &tfplugin5.ResourceIdentityData{IdentityData: dvToProto(id.IdentityData)}
}

func identityFromProto(id *tfplugin5.ResourceIdentityData) *tfprotov5.ResourceIdentityData {
	if id == nil {
		return nil
	}
	return &tfprotov5.ResourceIdentityData{IdentityData: dvFromProto(id.IdentityData)}
}

// ---- Diagnostics ----

func diagsFromProto(in []*tfplugin5.Diagnostic) []*tfprotov5.Diagnostic {
	if len(in) == 0 {
		return nil
	}
	out := make([]*tfprotov5.Diagnostic, 0, len(in))
	for _, d := range in {
		if d == nil {
			continue
		}
		out = append(out, &tfprotov5.Diagnostic{
			Severity:  tfprotov5.DiagnosticSeverity(d.Severity),
			Summary:   d.Summary,
			Detail:    d.Detail,
			Attribute: attrPathFromProto(d.Attribute),
		})
	}
	return out
}

// ---- AttributePath ----

func attrPathFromProto(p *tfplugin5.AttributePath) *tftypes.AttributePath {
	if p == nil {
		return nil
	}
	path := tftypes.NewAttributePath()
	for _, step := range p.Steps {
		switch s := step.Selector.(type) {
		case *tfplugin5.AttributePath_Step_AttributeName:
			path = path.WithAttributeName(s.AttributeName)
		case *tfplugin5.AttributePath_Step_ElementKeyInt:
			path = path.WithElementKeyInt(int(s.ElementKeyInt))
		case *tfplugin5.AttributePath_Step_ElementKeyString:
			path = path.WithElementKeyString(s.ElementKeyString)
		}
	}
	return path
}

func attrPathsFromProto(ps []*tfplugin5.AttributePath) []*tftypes.AttributePath {
	if len(ps) == 0 {
		return nil
	}
	out := make([]*tftypes.AttributePath, 0, len(ps))
	for _, p := range ps {
		out = append(out, attrPathFromProto(p))
	}
	return out
}

// ---- Schema ----

func schemaFromProto(s *tfplugin5.Schema) *tfprotov5.Schema {
	if s == nil {
		return nil
	}
	return &tfprotov5.Schema{
		Version: s.Version,
		Block:   schemaBlockFromProto(s.Block),
	}
}

func schemaBlockFromProto(b *tfplugin5.Schema_Block) *tfprotov5.SchemaBlock {
	if b == nil {
		return nil
	}
	attrs := make([]*tfprotov5.SchemaAttribute, 0, len(b.Attributes))
	for _, a := range b.Attributes {
		if a != nil {
			attrs = append(attrs, schemaAttrFromProto(a))
		}
	}
	blocks := make([]*tfprotov5.SchemaNestedBlock, 0, len(b.BlockTypes))
	for _, nb := range b.BlockTypes {
		if nb != nil {
			blocks = append(blocks, schemaNestedBlockFromProto(nb))
		}
	}
	return &tfprotov5.SchemaBlock{
		Version:            b.Version,
		Attributes:         attrs,
		BlockTypes:         blocks,
		Description:        b.Description,
		DescriptionKind:    tfprotov5.StringKind(b.DescriptionKind),
		Deprecated:         b.Deprecated,
		DeprecationMessage: b.DeprecationMessage,
	}
}

func schemaAttrFromProto(a *tfplugin5.Schema_Attribute) *tfprotov5.SchemaAttribute {
	var typ tftypes.Type
	if len(a.Type) > 0 {
		var err error
		typ, err = tftypes.ParseJSONType(a.Type) //nolint:staticcheck
		if err != nil {
			typ = tftypes.DynamicPseudoType
		}
	}
	return &tfprotov5.SchemaAttribute{
		Name:               a.Name,
		Type:               typ,
		Description:        a.Description,
		DescriptionKind:    tfprotov5.StringKind(a.DescriptionKind),
		Required:           a.Required,
		Optional:           a.Optional,
		Computed:           a.Computed,
		Sensitive:          a.Sensitive,
		Deprecated:         a.Deprecated,
		DeprecationMessage: a.DeprecationMessage,
		WriteOnly:          a.WriteOnly,
	}
}

func schemaNestedBlockFromProto(nb *tfplugin5.Schema_NestedBlock) *tfprotov5.SchemaNestedBlock {
	return &tfprotov5.SchemaNestedBlock{
		TypeName: nb.TypeName,
		Block:    schemaBlockFromProto(nb.Block),
		Nesting:  tfprotov5.SchemaNestedBlockNestingMode(nb.Nesting),
		MinItems: nb.MinItems,
		MaxItems: nb.MaxItems,
	}
}

// ---- ServerCapabilities / Deferred ----

func serverCapsFromProto(c *tfplugin5.ServerCapabilities) *tfprotov5.ServerCapabilities {
	if c == nil {
		return nil
	}
	return &tfprotov5.ServerCapabilities{
		GetProviderSchemaOptional: c.GetProviderSchemaOptional,
		MoveResourceState:         c.MoveResourceState,
		PlanDestroy:               c.PlanDestroy,
		GenerateResourceConfig:    c.GenerateResourceConfig,
	}
}

func deferredFromProto(d *tfplugin5.Deferred) *tfprotov5.Deferred {
	if d == nil {
		return nil
	}
	return &tfprotov5.Deferred{Reason: tfprotov5.DeferredReason(d.Reason)}
}

// ---- RawState ----

func rawStateToProto(rs *tfprotov5.RawState) *tfplugin5.RawState {
	if rs == nil {
		return nil
	}
	return &tfplugin5.RawState{Json: rs.JSON, Flatmap: rs.Flatmap}
}

// ======= ProviderServer methods =======

func (a *v5Adapter) GetMetadata(ctx context.Context, _ *tfprotov5.GetMetadataRequest) (*tfprotov5.GetMetadataResponse, error) {
	resp, err := a.client.GetMetadata(ctx, &tfplugin5.GetMetadata_Request{})
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &tfprotov5.GetMetadataResponse{}, nil
		}
		return nil, err
	}
	out := &tfprotov5.GetMetadataResponse{
		Diagnostics:        diagsFromProto(resp.Diagnostics),
		ServerCapabilities: serverCapsFromProto(resp.ServerCapabilities),
	}
	for _, ds := range resp.DataSources {
		out.DataSources = append(out.DataSources, tfprotov5.DataSourceMetadata{TypeName: ds.TypeName})
	}
	for _, r := range resp.Resources {
		out.Resources = append(out.Resources, tfprotov5.ResourceMetadata{TypeName: r.TypeName})
	}
	return out, nil
}

func (a *v5Adapter) GetProviderSchema(ctx context.Context, _ *tfprotov5.GetProviderSchemaRequest) (*tfprotov5.GetProviderSchemaResponse, error) {
	resp, err := a.client.GetSchema(ctx, &tfplugin5.GetProviderSchema_Request{})
	if err != nil {
		return nil, err
	}
	resourceSchemas := make(map[string]*tfprotov5.Schema, len(resp.ResourceSchemas))
	for name, s := range resp.ResourceSchemas {
		resourceSchemas[name] = schemaFromProto(s)
	}
	dataSourceSchemas := make(map[string]*tfprotov5.Schema, len(resp.DataSourceSchemas))
	for name, s := range resp.DataSourceSchemas {
		dataSourceSchemas[name] = schemaFromProto(s)
	}
	return &tfprotov5.GetProviderSchemaResponse{
		Provider:           schemaFromProto(resp.Provider),
		ProviderMeta:       schemaFromProto(resp.ProviderMeta),
		ResourceSchemas:    resourceSchemas,
		DataSourceSchemas:  dataSourceSchemas,
		Diagnostics:        diagsFromProto(resp.Diagnostics),
		ServerCapabilities: serverCapsFromProto(resp.ServerCapabilities),
	}, nil
}

func (a *v5Adapter) GetResourceIdentitySchemas(ctx context.Context, _ *tfprotov5.GetResourceIdentitySchemasRequest) (*tfprotov5.GetResourceIdentitySchemasResponse, error) {
	resp, err := a.client.GetResourceIdentitySchemas(ctx, &tfplugin5.GetResourceIdentitySchemas_Request{})
	if err != nil {
		if status.Code(err) == codes.Unimplemented {
			return &tfprotov5.GetResourceIdentitySchemasResponse{}, nil
		}
		return nil, err
	}
	schemas := make(map[string]*tfprotov5.ResourceIdentitySchema, len(resp.IdentitySchemas))
	for name, s := range resp.IdentitySchemas {
		schemas[name] = resourceIdentitySchemaFromProto(s)
	}
	return &tfprotov5.GetResourceIdentitySchemasResponse{
		IdentitySchemas: schemas,
		Diagnostics:     diagsFromProto(resp.Diagnostics),
	}, nil
}

func resourceIdentitySchemaFromProto(s *tfplugin5.ResourceIdentitySchema) *tfprotov5.ResourceIdentitySchema {
	if s == nil {
		return nil
	}
	attrs := make([]*tfprotov5.ResourceIdentitySchemaAttribute, 0, len(s.IdentityAttributes))
	for _, a := range s.IdentityAttributes {
		var typ tftypes.Type
		if len(a.Type) > 0 {
			var err error
			typ, err = tftypes.ParseJSONType(a.Type) //nolint:staticcheck
			if err != nil {
				typ = tftypes.DynamicPseudoType
			}
		}
		attrs = append(attrs, &tfprotov5.ResourceIdentitySchemaAttribute{
			Name:              a.Name,
			Type:              typ,
			RequiredForImport: a.RequiredForImport,
			OptionalForImport: a.OptionalForImport,
			Description:       a.Description,
		})
	}
	return &tfprotov5.ResourceIdentitySchema{
		Version:            s.Version,
		IdentityAttributes: attrs,
	}
}

func (a *v5Adapter) PrepareProviderConfig(ctx context.Context, req *tfprotov5.PrepareProviderConfigRequest) (*tfprotov5.PrepareProviderConfigResponse, error) {
	resp, err := a.client.PrepareProviderConfig(ctx, &tfplugin5.PrepareProviderConfig_Request{
		Config: dvToProto(req.Config),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.PrepareProviderConfigResponse{
		PreparedConfig: dvFromProto(resp.PreparedConfig),
		Diagnostics:    diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) ConfigureProvider(ctx context.Context, req *tfprotov5.ConfigureProviderRequest) (*tfprotov5.ConfigureProviderResponse, error) {
	resp, err := a.client.Configure(ctx, &tfplugin5.Configure_Request{
		Config:           dvToProto(req.Config),
		TerraformVersion: req.TerraformVersion,
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.ConfigureProviderResponse{
		Diagnostics: diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) StopProvider(ctx context.Context, _ *tfprotov5.StopProviderRequest) (*tfprotov5.StopProviderResponse, error) {
	resp, err := a.client.Stop(ctx, &tfplugin5.Stop_Request{})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.StopProviderResponse{Error: resp.Error}, nil
}

// ---- ResourceServer ----

func (a *v5Adapter) ValidateResourceTypeConfig(ctx context.Context, req *tfprotov5.ValidateResourceTypeConfigRequest) (*tfprotov5.ValidateResourceTypeConfigResponse, error) {
	resp, err := a.client.ValidateResourceTypeConfig(ctx, &tfplugin5.ValidateResourceTypeConfig_Request{
		TypeName: req.TypeName,
		Config:   dvToProto(req.Config),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.ValidateResourceTypeConfigResponse{
		Diagnostics: diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) UpgradeResourceState(ctx context.Context, req *tfprotov5.UpgradeResourceStateRequest) (*tfprotov5.UpgradeResourceStateResponse, error) {
	resp, err := a.client.UpgradeResourceState(ctx, &tfplugin5.UpgradeResourceState_Request{
		TypeName: req.TypeName,
		Version:  req.Version,
		RawState: rawStateToProto(req.RawState),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.UpgradeResourceStateResponse{
		UpgradedState: dvFromProto(resp.UpgradedState),
		Diagnostics:   diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) ReadResource(ctx context.Context, req *tfprotov5.ReadResourceRequest) (*tfprotov5.ReadResourceResponse, error) {
	resp, err := a.client.ReadResource(ctx, &tfplugin5.ReadResource_Request{
		TypeName:     req.TypeName,
		CurrentState: dvToProto(req.CurrentState),
		Private:      req.Private,
		ProviderMeta: dvToProto(req.ProviderMeta),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.ReadResourceResponse{
		NewState:    dvFromProto(resp.NewState),
		Diagnostics: diagsFromProto(resp.Diagnostics),
		Private:     resp.Private,
		Deferred:    deferredFromProto(resp.Deferred),
	}, nil
}

func (a *v5Adapter) PlanResourceChange(ctx context.Context, req *tfprotov5.PlanResourceChangeRequest) (*tfprotov5.PlanResourceChangeResponse, error) {
	resp, err := a.client.PlanResourceChange(ctx, &tfplugin5.PlanResourceChange_Request{
		TypeName:         req.TypeName,
		PriorState:       dvToProto(req.PriorState),
		ProposedNewState: dvToProto(req.ProposedNewState),
		Config:           dvToProto(req.Config),
		PriorPrivate:     req.PriorPrivate,
		ProviderMeta:     dvToProto(req.ProviderMeta),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.PlanResourceChangeResponse{
		PlannedState:    dvFromProto(resp.PlannedState),
		RequiresReplace: attrPathsFromProto(resp.RequiresReplace),
		PlannedPrivate:  resp.PlannedPrivate,
		Diagnostics:     diagsFromProto(resp.Diagnostics),
		Deferred:        deferredFromProto(resp.Deferred),
	}, nil
}

func (a *v5Adapter) ApplyResourceChange(ctx context.Context, req *tfprotov5.ApplyResourceChangeRequest) (*tfprotov5.ApplyResourceChangeResponse, error) {
	resp, err := a.client.ApplyResourceChange(ctx, &tfplugin5.ApplyResourceChange_Request{
		TypeName:       req.TypeName,
		PriorState:     dvToProto(req.PriorState),
		PlannedState:   dvToProto(req.PlannedState),
		Config:         dvToProto(req.Config),
		PlannedPrivate: req.PlannedPrivate,
		ProviderMeta:   dvToProto(req.ProviderMeta),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.ApplyResourceChangeResponse{
		NewState:    dvFromProto(resp.NewState),
		Private:     resp.Private,
		Diagnostics: diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) ImportResourceState(ctx context.Context, req *tfprotov5.ImportResourceStateRequest) (*tfprotov5.ImportResourceStateResponse, error) {
	resp, err := a.client.ImportResourceState(ctx, &tfplugin5.ImportResourceState_Request{
		TypeName: req.TypeName,
		Id:       req.ID,
		Identity: identityToProto(req.Identity),
	})
	if err != nil {
		return nil, err
	}
	imported := make([]*tfprotov5.ImportedResource, 0, len(resp.ImportedResources))
	for _, r := range resp.ImportedResources {
		imported = append(imported, &tfprotov5.ImportedResource{
			TypeName: r.TypeName,
			State:    dvFromProto(r.State),
			Private:  r.Private,
			Identity: identityFromProto(r.Identity),
		})
	}
	return &tfprotov5.ImportResourceStateResponse{
		ImportedResources: imported,
		Diagnostics:       diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) MoveResourceState(_ context.Context, _ *tfprotov5.MoveResourceStateRequest) (*tfprotov5.MoveResourceStateResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "MoveResourceState not supported")
}

func (a *v5Adapter) UpgradeResourceIdentity(_ context.Context, _ *tfprotov5.UpgradeResourceIdentityRequest) (*tfprotov5.UpgradeResourceIdentityResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "UpgradeResourceIdentity not supported")
}

func (a *v5Adapter) GenerateResourceConfig(_ context.Context, _ *tfprotov5.GenerateResourceConfigRequest) (*tfprotov5.GenerateResourceConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "GenerateResourceConfig not supported")
}

// ---- DataSourceServer ----

func (a *v5Adapter) ValidateDataSourceConfig(ctx context.Context, req *tfprotov5.ValidateDataSourceConfigRequest) (*tfprotov5.ValidateDataSourceConfigResponse, error) {
	resp, err := a.client.ValidateDataSourceConfig(ctx, &tfplugin5.ValidateDataSourceConfig_Request{
		TypeName: req.TypeName,
		Config:   dvToProto(req.Config),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.ValidateDataSourceConfigResponse{
		Diagnostics: diagsFromProto(resp.Diagnostics),
	}, nil
}

func (a *v5Adapter) ReadDataSource(ctx context.Context, req *tfprotov5.ReadDataSourceRequest) (*tfprotov5.ReadDataSourceResponse, error) {
	resp, err := a.client.ReadDataSource(ctx, &tfplugin5.ReadDataSource_Request{
		TypeName:     req.TypeName,
		Config:       dvToProto(req.Config),
		ProviderMeta: dvToProto(req.ProviderMeta),
	})
	if err != nil {
		return nil, err
	}
	return &tfprotov5.ReadDataSourceResponse{
		State:       dvFromProto(resp.State),
		Diagnostics: diagsFromProto(resp.Diagnostics),
	}, nil
}

// ---- FunctionServer ----

func (a *v5Adapter) GetFunctions(_ context.Context, _ *tfprotov5.GetFunctionsRequest) (*tfprotov5.GetFunctionsResponse, error) {
	// The bridge does not expose a function-call endpoint, so function schema
	// conversion is not implemented. Return an empty map so tf5to6server and
	// callers treat this provider as having no functions.
	return &tfprotov5.GetFunctionsResponse{Functions: map[string]*tfprotov5.Function{}}, nil
}

func (a *v5Adapter) CallFunction(_ context.Context, _ *tfprotov5.CallFunctionRequest) (*tfprotov5.CallFunctionResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "CallFunction not supported")
}

// ---- EphemeralResourceServer ----

func (a *v5Adapter) ValidateEphemeralResourceConfig(_ context.Context, _ *tfprotov5.ValidateEphemeralResourceConfigRequest) (*tfprotov5.ValidateEphemeralResourceConfigResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "ValidateEphemeralResourceConfig not supported")
}

func (a *v5Adapter) OpenEphemeralResource(_ context.Context, _ *tfprotov5.OpenEphemeralResourceRequest) (*tfprotov5.OpenEphemeralResourceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "OpenEphemeralResource not supported")
}

func (a *v5Adapter) RenewEphemeralResource(_ context.Context, _ *tfprotov5.RenewEphemeralResourceRequest) (*tfprotov5.RenewEphemeralResourceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "RenewEphemeralResource not supported")
}

func (a *v5Adapter) CloseEphemeralResource(_ context.Context, _ *tfprotov5.CloseEphemeralResourceRequest) (*tfprotov5.CloseEphemeralResourceResponse, error) {
	return nil, status.Errorf(codes.Unimplemented, "CloseEphemeralResource not supported")
}
