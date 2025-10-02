package helpers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

const randomKeyLength = 32

func GetRandomKey() string {
	bytes := make([]byte, randomKeyLength)
	_, err := rand.Read(bytes)
	if err != nil {
		panic(err)
	}
	return base64.URLEncoding.EncodeToString(bytes)
}

func HashString(s string) string {
	hash := sha256.Sum256([]byte(s))
	return base64.URLEncoding.EncodeToString(hash[:])
}

func AddNullCharToString(s string) string {
	return s + "\000"
}
