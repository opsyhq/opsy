package staleplan_test

import (
	"encoding/json"
	"testing"

	"github.com/opsydev/opsy/bridge/internal/staleplan"
)

func TestDeriveAction(t *testing.T) {
	null := json.RawMessage("null")
	nonNull := json.RawMessage(`{"id":"abc"}`)

	tests := []struct {
		prior, planned json.RawMessage
		want           staleplan.Action
	}{
		{null, null, staleplan.ActionNoop},
		{null, nonNull, staleplan.ActionCreate},
		{nonNull, null, staleplan.ActionDelete},
		{nonNull, nonNull, staleplan.ActionUpdate},
	}

	for _, tc := range tests {
		got := staleplan.DeriveAction(tc.prior, tc.planned)
		if got != tc.want {
			t.Errorf("DeriveAction(%s, %s) = %q, want %q", tc.prior, tc.planned, got, tc.want)
		}
	}
}

func TestDiverged(t *testing.T) {
	tests := []struct {
		stored, rePlanned staleplan.Action
		want              bool
	}{
		{staleplan.ActionCreate, staleplan.ActionCreate, false},
		{staleplan.ActionUpdate, staleplan.ActionUpdate, false},
		{staleplan.ActionUpdate, staleplan.ActionNoop, false}, // allowed transition
		{staleplan.ActionCreate, staleplan.ActionUpdate, true},
		{staleplan.ActionDelete, staleplan.ActionCreate, true},
		{staleplan.ActionUpdate, staleplan.ActionDelete, true},
		{staleplan.ActionCreate, staleplan.ActionNoop, true},
	}

	for _, tc := range tests {
		got := staleplan.Diverged(tc.stored, tc.rePlanned)
		if got != tc.want {
			t.Errorf("Diverged(%q, %q) = %v, want %v", tc.stored, tc.rePlanned, got, tc.want)
		}
	}
}
