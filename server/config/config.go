package config

import (
	"errors"
	"fmt"
	"github.com/joho/godotenv"
	"os"
	"reflect"
	"strconv"
)

const envTag = "env"

type Config struct {
	Server struct {
		Port int `env:"PORT"`
	}
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

	err := godotenv.Load(".env")
	if err != nil {
		return err
	}

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
