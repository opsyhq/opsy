// Package staleplan detects when a stored plan diverges from a fresh re-plan,
// mirroring terraform's checkPlannedChange logic.
package staleplan

import (
	"encoding/json"

	"github.com/hashicorp/terraform-plugin-go/tfprotov6"
	"github.com/hashicorp/terraform-plugin-go/tftypes"
)

// Action represents the intended change for a resource.
type Action string

const (
	ActionNoop    Action = "noop"
	ActionCreate  Action = "create"
	ActionUpdate  Action = "update"
	ActionDelete  Action = "delete"
	ActionReplace Action = "replace"
)

// DeriveAction infers an action from JSON prior/planned state payloads.
// Mirrors terraform's getAction() logic.
func DeriveAction(priorState, plannedState json.RawMessage) Action {
	priorNull := IsNullJSON(priorState)
	plannedNull := IsNullJSON(plannedState)

	switch {
	case priorNull && plannedNull:
		return ActionNoop
	case priorNull && !plannedNull:
		return ActionCreate
	case !priorNull && plannedNull:
		return ActionDelete
	default:
		return ActionUpdate
	}
}

// DeriveActionFromDV infers an action from DynamicValue prior/planned states
// and the requires_replace attribute paths from a PlanResourceChange response.
func DeriveActionFromDV(priorState, plannedState *tfprotov6.DynamicValue, requiresReplace []*tftypes.AttributePath) Action {
	priorNull := isDynamicValueNull(priorState)
	plannedNull := isDynamicValueNull(plannedState)

	switch {
	case priorNull && plannedNull:
		return ActionNoop
	case priorNull && !plannedNull:
		return ActionCreate
	case !priorNull && plannedNull:
		return ActionDelete
	default:
		if len(requiresReplace) > 0 {
			return ActionReplace
		}
		return ActionUpdate
	}
}

// Diverged returns true when the re-planned action is incompatible with the
// stored action. Mirrors terraform's checkPlannedChange semantics:
//   - update → noop is allowed (unknowns resolved to matching values)
//   - any other transition is a divergence
func Diverged(stored, rePlanned Action) bool {
	if stored == rePlanned {
		return false
	}
	// update→noop is the one allowed transition.
	if stored == ActionUpdate && rePlanned == ActionNoop {
		return false
	}
	return true
}

// IsNullJSON returns true if the raw message is absent, empty, or "null".
func IsNullJSON(raw json.RawMessage) bool {
	return len(raw) == 0 || string(raw) == "null"
}

// isDynamicValueNull returns true if the DynamicValue decodes to a null or
// zero-length msgpack value, or if dv itself is nil.
func isDynamicValueNull(dv *tfprotov6.DynamicValue) bool {
	if dv == nil {
		return true
	}
	// A null DynamicValue has empty or nil MsgPack bytes, or JSON "null".
	if len(dv.MsgPack) == 0 && len(dv.JSON) == 0 {
		return true
	}
	// msgpack nil is 0xc0
	if len(dv.MsgPack) == 1 && dv.MsgPack[0] == 0xc0 {
		return true
	}
	return false
}
