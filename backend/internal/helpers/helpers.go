package helpers

import (
	"encoding/binary"
	"github.com/google/uuid"
)

func Uint16ToBinary(v uint16) []byte {
	b := make([]byte, 2)
	binary.BigEndian.PutUint16(b, v)
	return b
}

func Uint32ToBinary(v uint32) []byte {
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, v)
	return b
}

func UUIDToBinary(u uuid.UUID) []byte {
	b := make([]byte, 16)
	copy(b, u[:])
	return b
}
