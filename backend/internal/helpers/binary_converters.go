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

func BinaryToUint16(data []byte) uint16 {
	return binary.BigEndian.Uint16(data)
}

func Uint32ToBinary(v uint32) []byte {
	b := make([]byte, 4)
	binary.BigEndian.PutUint32(b, v)
	return b
}

func BinaryToUint32(data []byte) uint32 {
	return binary.BigEndian.Uint32(data)
}

func UUIDToBinary(u uuid.UUID) []byte {
	b := make([]byte, 16)
	copy(b, u[:])
	return b
}

func ByteToBinary(v uint8) []byte {
	b := make([]byte, 1)
	b[0] = v
	return b
}
