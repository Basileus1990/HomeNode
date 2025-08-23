package helpers

import (
	"encoding/binary"
	"encoding/hex"
	"testing"
)

func TestUint16ToBytesBE(t *testing.T) {
	tests := []struct {
		name string
		v    uint16
		want string // hex
	}{
		{"zero", 0x0000, "0000"},
		{"one", 1, "0001"},
		{"mid", 0xABCD, "abcd"},
		{"max", 0xFFFF, "ffff"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b := Uint16ToBinary(tc.v)
			if len(b) != 2 {
				t.Fatalf("len = %d; want 2", len(b))
			}

			if hex.EncodeToString(b) != tc.want {
				t.Fatalf("hex = %s; want %s", hex.EncodeToString(b), tc.want)
			}

			if got := binary.BigEndian.Uint16(b); got != tc.v {
				t.Fatalf("roundtrip = %d; want %d", got, tc.v)
			}
		})
	}
}

func TestUint32ToBytesBE(t *testing.T) {
	tests := []struct {
		name string
		v    uint32
		want string // hex
	}{
		{"zero", 0x00000000, "00000000"},
		{"one", 1, "00000001"},
		{"mid", 0xAABBCCDD, "aabbccdd"},
		{"max", 0xFFFFFFFF, "ffffffff"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b := Uint32ToBinary(tc.v)
			if len(b) != 4 {
				t.Fatalf("len = %d; want 4", len(b))
			}
			
			if hex.EncodeToString(b) != tc.want {
				t.Fatalf("hex = %s; want %s", hex.EncodeToString(b), tc.want)
			}

			if got := binary.BigEndian.Uint32(b); got != tc.v {
				t.Fatalf("roundtrip = %d; want %d", got, tc.v)
			}
		})
	}
}
