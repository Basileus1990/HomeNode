package config

import (
	"errors"
	"fmt"
	"github.com/joho/godotenv"
	"os"
	"reflect"
	"strconv"
)

// TODO: Refactor this so it doesn't use global value

const envTag = "env"

type ServerCfg struct {
	Port int `env:"PORT"`
}

type WebsocketCfg struct {
	BatchSize int `env:"BATCH_SIZE"`
}

type FrontendCfg struct {
	StreamerInactivityTimeout int  `env:"FRONTEND_STREAMER_INACTIVITY_TIMEOUT" json:"streamer_inactivity_timeout"`
	StreamerCleanupInterval   int  `env:"FRONTEND_STREAMER_CLEANUP_INTERVAL" json:"streamer_cleanup_interval"`
	UseLittleEndian           bool `env:"FRONTEND_USE_LITTLE_ENDIAN" json:"use_little_endian"`

	// Websocket endpoints
	ServerWSURL         string `env:"FRONTEND_SERVER_WS_URL" json:"server_ws_url"`
	RecordInfoWSURL     string `env:"FRONTEND_RECORD_INFO_WS_URL" json:"record_info_ws_url"`
	RecordDownloadWSURL string `env:"FRONTEND_RECORD_DOWNLOAD_WS_URL" json:"record_download_ws_url"`

	// Cryptography
	PBKDF2Iterations int `env:"FRONTEND_PBKDF2_ITERATIONS" json:"pbkdf2_iterations"`
	AESKeyLength     int `env:"FRONTEND_AES_KEY_LENGTH" json:"aes_key_length"`
	AESIVBytes       int `env:"FRONTEND_AES_IV_BYTES" json:"aes_iv_bytes"`
	SaltBytes        int `env:"FRONTEND_SALT_BYTES" json:"salt_bytes"`
}

type Config struct {
	Server    ServerCfg
	Websocket WebsocketCfg
	Frontend  FrontendCfg
}

var cfg *Config

func Get() *Config {
	if cfg == nil {
		panic("Config not loaded")
	}

	return cfg
}

func LoadConfig() error {
	if cfg != nil {
		return nil
	}

	_ = godotenv.Load()
	//if err != nil {
	//	return err
	//}

	return loadFromEnv(nil)
}

func loadFromEnv(value *reflect.Value) error {
	if value == nil {
		cfg = new(Config)
		v := reflect.ValueOf(cfg).Elem()
		value = &v
	}

	kind := value.Kind()
	if kind != reflect.Struct {
		panic("value has to ba a struct in loadFromEnv")
	}

	for i := 0; i < value.NumField(); i++ {
		field := value.Field(i)

		if field.Kind() == reflect.Struct {
			err := loadFromEnv(&field)
			if err != nil {
				return err
			}

			continue
		}

		envField := value.Type().Field(i).Tag.Get(envTag)
		if envField == "" {
			return errors.New("\"env\" tag has to be set")
		}

		envValue := os.Getenv(envField)
		if envValue == "" {
			return errors.New(fmt.Sprintf("field \"%s\" has not been set", envField))
		}

		switch field.Kind() {
		case reflect.Int:
			envInt, err := strconv.Atoi(envValue)
			if err != nil {
				return errors.New(fmt.Sprintf("field \"%s\" value has to be an int", envField))
			}
			field.SetInt(int64(envInt))

		case reflect.Float32:
			envFloat, err := strconv.ParseFloat(envValue, 32)
			if err != nil {
				return errors.New(fmt.Sprintf("field \"%s\" value has to be a float", envField))
			}
			field.SetFloat(envFloat)
		case reflect.Float64:
			envFloat, err := strconv.ParseFloat(envValue, 64)
			if err != nil {
				return errors.New(fmt.Sprintf("field \"%s\" value has to be a float", envField))
			}
			field.SetFloat(envFloat)

		case reflect.Bool:
			envBool, err := strconv.ParseBool(envValue)
			if err != nil {
				return errors.New(fmt.Sprintf("field \"%s\" value has to be a bool", envField))
			}
			field.SetBool(envBool)

		case reflect.String:
			field.SetString(envValue)

		default:
			panic("unsupported config type")
		}
	}

	return nil
}
